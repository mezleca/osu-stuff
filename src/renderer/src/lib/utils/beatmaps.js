import { get } from "svelte/store";
import { get_beatmap_status_code, get_code_by_mode, osu_beatmaps } from "../store/beatmaps";
import { access_token } from "../store/config";
import { show_notification } from "../store/notifications";
import { collections } from "../store/collections";

const MAX_STAR_RATING_VALUE = 10; // lazer

const RENAME_MAP = {
    difficulty_rating: "star",
    hit_length: "length",
    version: "difficulty",
    id: "difficulty_id",
    checksum: "md5",
    accuracy: "od",
    drain: "hp",
    creator: "mapper"
};

const get_beatmap = async (id, is_unique_id) => {
    const cached = osu_beatmaps.get(id);

    if (cached) {
        return cached;
    }

    const result = await window.osu.get_beatmap(id, is_unique_id);

    if (!result) {
        return {};
    }

    osu_beatmaps.add(id, result.beatmap);
    return result.beatmap;
};

export const get_beatmap_data = async (md5) => {
    if (typeof md5 == "object") return md5; // discover
    return await get_beatmap(md5, false);
};

export const get_by_unique_id = async (id) => {
    return await get_beatmap(id, true);
};

export const get_missing_beatmaps = async () => {
    const invalid_beatmaps = [];

    try {
        for (const collection of get(collections.all_collections)) {
            // search for missing beatmaps on the current collection
            const invalid = await window.osu.missing_beatmaps(collection.maps);

            if (invalid.length > 0) {
                invalid_beatmaps.push({ name: collection.name, beatmaps: invalid });
            }
        }

        // update missing data
        collections.missing_beatmaps.set(invalid_beatmaps);
    } catch (err) {
        show_notification({ type: "error", text: "failed to get missing beatmaps..." });
        console.error(err);
    }
};

export const convert_beatmap_keys = (beatmap) => {
    const processed = beatmap;

    // its possible we're dealing with something from the osu! api
    // so lets ensure we have everything in the right place
    // normally first place shit
    if (beatmap?.beatmap && beatmap?.beatmapset && beatmap?.pp) {
        Object.assign(processed, { ...beatmap.beatmapset, ...beatmap.beatmap });

        // not needed
        delete processed.beatmapset;
        delete processed.beatmap;
    }

    const mode = get_code_by_mode(processed.mode);

    for (const [old_key, new_key] of Object.entries(RENAME_MAP)) {
        if (processed.hasOwnProperty(old_key)) {
            // hack for sr
            if (old_key == "difficulty_rating") {
                processed.star_rating = new Array(4).fill({ pair: [], nm: -1 });
                processed.star_rating[mode] = {
                    nm: processed.difficulty_rating,
                    pair: [0, processed.difficulty_rating]
                };
            } else {
                processed[new_key] = processed[old_key];
            }

            // delete old key
            delete processed[old_key];
        }
    }

    // set status if possible
    if (isNaN(Number(processed.status))) {
        processed.status = get_beatmap_status_code(processed.status) || 0;
    }

    // set extra options
    processed.mode = mode;
    processed.local = true;
    processed.downloaded = true;

    return processed;
};

// get osu beatmaps from osu! api
export const fetch_osu_beatmaps = async (base_url, limit = 999) => {
    const maps = [];
    let offset = 0;

    for (let i = 0; i < limit; i++) {
        // ensure whe dont surpass the limit
        if (offset >= limit) {
            break;
        }

        // setup url
        const url = new URL(base_url);

        // setup pagination
        url.searchParams.append("limit", "50");
        url.searchParams.append("offset", offset.toString());

        const response = await fetch({ url: url.toString() });
        const data = await response.json();

        // add new beatmap chunk
        maps.push(...data);
        offset += data.length;
    }

    // ensure all beatmaps are vaid
    return maps.filter((b) => b != undefined);
};

export const validate_star_rating = (sr, min, max) => {
    if (sr < min) {
        return false;
    }

    if (max == MAX_STAR_RATING_VALUE) {
        return true;
    }

    return sr <= max;
};

export const get_player_data = async (options) => {
    const { player_name, beatmap_options, beatmap_status, star_rating } = options;

    if (!player_name) {
        show_notification({ type: "error", text: "invalid player name!" });
        return null;
    }

    const fetch_config = {
        method: "GET",
        headers: { Authorization: `Bearer ${get(access_token)}` }
    };

    try {
        // get player data
        const player_response = await fetch({
            url: `https://osu.ppy.sh/api/v2/users/${player_name}`,
            ...fetch_config
        });

        if (player_response.status != 200) {
            show_notification({ type: "error", text: player_response.statusText });
            return null;
        }

        const player = await player_response.json();

        if (!player?.id) {
            return null;
        }

        // get extra data for counts
        const extra_response = await fetch({
            url: `https://osu.ppy.sh/users/${player.id}/extra-pages/top_ranks?mode=osu`,
            ...fetch_config
        });

        if (!extra_response) {
            show_notification({ type: "error", text: extra_response.statusText });
            return null;
        }

        const extra = await extra_response.json();

        const has_option = (name) => beatmap_options.has(name) || beatmap_options.has("all");
        const has_status = (status) => beatmap_status.has(status) || beatmap_status.has("all");

        // build promises for fetching beatmaps
        const beatmap_promises = [];

        // first place scores
        if (extra.firsts?.count && has_option("first place")) {
            beatmap_promises.push({
                key: "firsts",
                promise: fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/scores/firsts?mode=osu`, extra.firsts.count)
            });
        }

        // best performance scores
        if (extra.best?.count && has_option("best performance")) {
            beatmap_promises.push({
                key: "bests",
                promise: fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/scores/best?mode=osu`, extra.best.count)
            });
        }

        // favourite beatmaps
        if (player.favourite_beatmapset_count && has_option("favourites")) {
            beatmap_promises.push({
                key: "favs",
                promise: fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/favourite`, player.favourite_beatmapset_count)
            });
        }

        // created beatmaps by status
        const should_fetch_created = has_option("created maps");

        if (should_fetch_created) {
            if (player.ranked_beatmapset_count && has_status("ranked")) {
                beatmap_promises.push({
                    key: "ranked",
                    promise: fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/ranked`, player.ranked_beatmapset_count)
                });
            }

            if (player.loved_beatmapset_count && has_status("loved")) {
                beatmap_promises.push({
                    key: "loved",
                    promise: fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/loved`, player.loved_beatmapset_count)
                });
            }

            if (player.pending_beatmapset_count && has_status("pending")) {
                beatmap_promises.push({
                    key: "pending",
                    promise: fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/pending`, player.pending_beatmapset_count)
                });
            }

            if (player.graveyard_beatmapset_count && has_status("graveyard")) {
                beatmap_promises.push({
                    key: "grave",
                    promise: fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/graveyard`, player.graveyard_beatmapset_count)
                });
            }
        }

        // execute all promises
        const beatmap_results = await Promise.all(beatmap_promises.map((p) => p.promise));

        // organize results by key
        const beatmap_data = {};
        const all_keys = ["firsts", "bests", "favs", "ranked", "loved", "pending", "grave"];

        // initialize all keys with empty arrays
        all_keys.forEach((key) => (beatmap_data[key] = []));

        // populate with actual data
        beatmap_promises.forEach((p, index) => {
            beatmap_data[p.key] = beatmap_results[index] || [];
        });

        // filter beatmaps
        const filter_maps = (maps) => {
            return maps.filter((map) => {
                // score with beatmap property
                if (map?.beatmap?.difficulty_rating != undefined) {
                    const b = map.beatmap;

                    if (!has_status(b.status)) {
                        return false;
                    }

                    return validate_star_rating(b.difficulty_rating, star_rating.min, star_rating.max);
                }

                // beatmapset with multiple beatmaps
                if (map?.beatmaps != undefined) {
                    if (!has_status(map?.status)) {
                        return false;
                    }

                    // check if at least one difficulty passes the star rating filter
                    return map.beatmaps.some((b) => validate_star_rating(b.difficulty_rating, star_rating.min, star_rating.max));
                }

                // single beatmap
                if (!has_status(map?.status)) {
                    return false;
                }

                const sr = map?.difficulty_rating;
                return sr != undefined && validate_star_rating(sr, star_rating.min, star_rating.max);
            });
        };

        // filter each category separately
        const filtered_data = {
            firsts: filter_maps(beatmap_data.firsts),
            bests: filter_maps(beatmap_data.bests),
            favs: filter_maps(beatmap_data.favs),
            ranked: filter_maps(beatmap_data.ranked),
            loved: filter_maps(beatmap_data.loved),
            pending: filter_maps(beatmap_data.pending),
            grave: filter_maps(beatmap_data.grave)
        };

        // combine all filtered maps
        const all_filtered_maps = new Set([
            ...filtered_data.firsts,
            ...filtered_data.bests,
            ...filtered_data.favs,
            ...filtered_data.ranked,
            ...filtered_data.loved,
            ...filtered_data.pending,
            ...filtered_data.grave
        ]);

        const expanded_maps = [];

        for (const map of Array.from(all_filtered_maps)) {
            if (map?.beatmaps && Array.isArray(map.beatmaps)) {
                // for beatmapsets, only include difficulties that pass the sr filter
                for (const diff of map.beatmaps) {
                    if (validate_star_rating(diff.difficulty_rating, star_rating.min, star_rating.max)) {
                        const merged = { ...map, ...diff };
                        delete merged.beatmaps;
                        expanded_maps.push(merged);
                    }
                }
            } else {
                expanded_maps.push(map);
            }
        }

        // convert all maps to consistent format
        const converted_maps = expanded_maps.map((map) => convert_beatmap_keys(map));

        // deduplicate by md5 or difficulty_id
        const unique_maps = converted_maps
            .filter((map) => map.md5 || map.difficulty_id)
            .reduce((acc, map) => {
                const key = map.md5 || map.difficulty_id;
                if (!acc.has(key)) {
                    acc.set(key, map);
                }
                return acc;
            }, new Map());

        const final_maps = Array.from(unique_maps.values());

        return {
            player: {
                id: player.id,
                username: player.username,
                country: player.country_code,
                avatar: player.avatar_url,
                cover: player.cover_url,
                stats: player.statistics,
                rank_history: player.rank_history
            },
            counts: {
                firsts: filtered_data.firsts.length,
                bests: filtered_data.bests.length,
                favs: filtered_data.favs.length,
                ranked: filtered_data.ranked.length,
                loved: filtered_data.loved.length,
                pending: filtered_data.pending.length,
                grave: filtered_data.grave.length,
                total: final_maps.length
            },
            maps: final_maps,
            filters: {
                sr_range: star_rating,
                options: Array.from(beatmap_options),
                status: Array.from(beatmap_status)
            }
        };
    } catch (error) {
        console.error("[get_player_data] error:", error);
        return null;
    }
};
