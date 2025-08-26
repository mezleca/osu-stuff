import { get } from "svelte/store";
import { get_beatmap_status_code, get_code_by_mode, osu_beatmaps } from "../store/beatmaps";
import { access_token } from "../store/config";

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

export const convert_beatmap_keys = (beatmap) => {
    const processed = { ...beatmap };
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

    processed.status = get_beatmap_status_code(processed.status) || 0;
    processed.mode = mode;

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

// @NOTE: same func from main proc
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
        return null;
    }

    const fetch_config = {
        method: "GET",
        headers: { 'Authorization': `Bearer ${get(access_token)}` }
    };

    try {
        // get player data
        const player_response = await fetch({ url: `https://osu.ppy.sh/api/v2/users/${player_name}`, ...fetch_config });
        console.log(player_response);
        const player = await player_response.json();
        console.log(player);

        if (!player?.id) {
            console.log("[get_player_data] player not found:", player_name);
            return null;
        }

        // get extra data
        const extra_response = await fetch({ url: `https://osu.ppy.sh/users/${player.id}/extra-pages/top_ranks?mode=osu`, ...fetch_config });
        const extra = await extra_response.json();

        if (!extra) {
            return null;
        }

        const has_option = (name) => beatmap_options.has(name) || beatmap_options.has("all");
        const has_status = (status) => beatmap_status.has(status) || beatmap_status.has("all");

        // fetch beatmaps
        const beatmaps = await Promise.all([
            extra.firsts?.count && has_option("first place") 
                ? fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/scores/firsts?mode=osu`, extra.firsts.count, star_rating) 
                : [],
            
            extra.best?.count && has_option("best performance") 
                ? fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/scores/best?mode=osu`, extra.best.count, star_rating) 
                : [],
            
            player.favourite_beatmapset_count && has_option("favourites") 
                ? fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/favourite`, player.favourite_beatmapset_count, star_rating) 
                : [],
            
            player.ranked_beatmapset_count && has_status("ranked") && has_option("created maps") 
                ? fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/ranked`, player.ranked_beatmapset_count, star_rating) 
                : [],
            
            player.loved_beatmapset_count && has_status("loved") && has_option("created maps") 
                ? fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/loved`, player.loved_beatmapset_count, star_rating) 
                : [],
            
            player.pending_beatmapset_count && has_status("pending") && has_option("created maps") 
                ? fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/pending`, player.pending_beatmapset_count, star_rating) 
                : [],
            
            player.graveyard_beatmapset_count && has_status("graveyard") && has_option("created maps") 
                ? fetch_osu_beatmaps(`https://osu.ppy.sh/users/${player.id}/beatmapsets/graveyard`, player.graveyard_beatmapset_count, star_rating) 
                : []
        ]);

        const [firsts, bests, favs, ranked, loved, pending, grave] = beatmaps;

        // filter beatmaps
        const filter_maps = (maps) => {
            return maps.filter((map) => {
                // score with beatmap property
                if (map?.beatmap?.difficulty_rating != undefined) {
                    const b = map.beatmap;
                    if (!has_status(b.status)) {
                        console.log("map does not have status", b.status);
                        return false;
                    }
                    return validate_star_rating(b.difficulty_rating, star_rating.min, star_rating.max);
                }
                
                // beatmapset with multiple beatmaps
                if (map?.beatmaps != undefined) {
                    if (!has_status(map?.status)) {
                        console.log("map does not have status", map.status);
                        return false;
                    }
                    return map.beatmaps.some(b => validate_star_rating(b.difficulty_rating, star_rating.min, star_rating.max));
                }
                
                // single beatmap
                if (!has_status(map?.status)) {
                    console.log("map does not have status", map.status);
                    return false;
                }

                const sr = map?.difficulty_rating;
                return sr != undefined && validate_star_rating(sr, star_rating.min, star_rating.max);
            });
        };

        // combine and filter all maps
        const all_maps = new Set([...firsts, ...bests, ...favs, ...ranked, ...loved, ...pending, ...grave]);
        const filtered_maps = filter_maps(Array.from(all_maps));

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
                firsts: firsts.length,
                bests: bests.length,
                favs: favs.length,
                ranked: ranked.length,
                loved: loved.length,
                pending: pending.length,
                grave: grave.length,
                total: filtered_maps.length
            },
            maps: filtered_maps,
            filters: {
                sr_range: star_rating,
                options: Array.from(beatmap_options),
                statuses: Array.from(beatmap_status)
            }
        };

    } catch (error) {
        console.error("[get_player_data] error:", error);
        return null;
    }
};