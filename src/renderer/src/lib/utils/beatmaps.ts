import { get } from "svelte/store";
import { show_notification } from "../store/notifications";
import { collections } from "../store/collections";
import { quick_confirm } from "./modal";
import { downloader } from "../store/downloader";
import type { BeatmapSetResult, IBeatmapResult, IMinimalBeatmapResult } from "@shared/types";

const MAX_STAR_RATING_VALUE = 10; // lazer

// cached beatmap / beatmapsets
export const beatmap_cache: Map<string, IBeatmapResult> = new Map();
export const beatmapset_cache: Map<number, BeatmapSetResult> = new Map();

// temp hack to prevent cards spam
const invalid_beatmaps: Set<string> = new Set();
const invalid_beatmapsets: Set<number> = new Set();

export const get_beatmap = async (id: string): Promise<IBeatmapResult | undefined> => {
    if (invalid_beatmaps.has(id)) {
        return undefined;
    }

    if (beatmap_cache.has(id)) {
        return beatmap_cache.get(id);
    }

    const beatmap = await window.api.invoke("driver:get_beatmap_by_md5", id);

    if (!beatmap) {
        invalid_beatmaps.add(id);
        return undefined;
    }

    beatmap_cache.set(id, beatmap);
    return beatmap;
};

export const invalidate_beatmap = (id: string) => {
    beatmap_cache.delete(id);
    invalid_beatmaps.delete(id);
};

export const get_beatmapset = async (id: number): Promise<BeatmapSetResult | undefined> => {
    if (invalid_beatmapsets.has(id)) {
        return undefined;
    }

    if (beatmapset_cache.has(id)) {
        return beatmapset_cache.get(id);
    }

    const beatmapset = await window.api.invoke("driver:get_beatmapset", id);

    if (!beatmapset) {
        // TODO: remove invalid beatmapset on download
        invalid_beatmapsets.add(id);
        return undefined;
    }

    beatmapset_cache.set(id, beatmapset);
    return beatmapset;
};

export const get_missing_beatmaps = async () => {
    const invalid_beatmaps = new Set();

    let target_name: string = "";

    try {
        for (const collection of get(collections.all_collections)) {
            // search for missing beatmaps on the current collection
            const invalid = await window.api.invoke("driver:get_missing_beatmaps", collection.name);

            if (invalid.length > 0) {
                invalid_beatmaps.add({ name: collection.name, beatmaps: invalid });
                target_name += collection.name + ", ";
            }
        }

        // asks for use consent...
        const confirmation = await quick_confirm("download missing beatmaps?", { submit: "yep", cancel: "nah" });

        if (!confirmation) {
            show_notification({ type: "info", text: "k" });
            return;
        }

        downloader.add({ id: target_name, beatmaps: Array.from(invalid_beatmaps.keys()) });
    } catch (err) {
        show_notification({ type: "error", text: "failed to get missing beatmaps..." });
        console.error(err);
    }
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

export interface IPlayerOptions {
    player_name: string;
    options: Set<string>;
    statuses: Set<string>;
    star_rating: { min: number; max: number };
}

const build_score_beatmap = (score: any): IMinimalBeatmapResult => {
    return {
        beatmap_id: score.beatmap?.id,
        beatmapset_id: score.beatmapset?.id,
        difficulty_rating: score.beatmap?.difficulty_rating,
        status: score.beatmap?.status,
        md5: score.beatmap?.checksum,
        version: score.beatmap?.version,
        artist: score.beatmapset?.artist,
        title: score.beatmapset?.title,
        creator: score.beatmapset?.creator,
        _raw: score
    };
};

const build_user_beatmaps = (beatmap: any): IMinimalBeatmapResult[] => {
    if (beatmap.beatmaps && Array.isArray(beatmap.beatmaps)) {
        return beatmap.beatmaps.map((diff) => ({
            beatmap_id: diff.id,
            beatmapset_id: beatmap.id,
            difficulty_rating: diff.difficulty_rating,
            status: diff.status,
            md5: diff.checksum,
            version: diff.version,
            artist: beatmap.artist,
            title: beatmap.title,
            creator: beatmap.creator,
            _raw: { ...beatmap, ...diff }
        }));
    }

    return [
        {
            beatmap_id: beatmap.beatmap_id || beatmap.id,
            beatmapset_id: beatmap.id,
            difficulty_rating: beatmap.beatmap?.difficulty_rating,
            status: beatmap.status,
            md5: beatmap.beatmap?.checksum,
            version: beatmap.beatmap?.version,
            artist: beatmap.artist,
            title: beatmap.title,
            creator: beatmap.creator,
            _raw: beatmap
        }
    ];
};

export const get_player_data = async (data: IPlayerOptions) => {
    let { player_name, options, statuses, star_rating } = data;

    if (!player_name) {
        show_notification({ type: "error", text: "invalid player name!!!" });
        return null;
    }

    // handle multiple players
    const player_names = player_name
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    // lookup all players
    const lookup_result = await window.api.invoke("web:players_lookup", { ids: player_names });

    if (lookup_result.error || !Array.isArray(lookup_result) || lookup_result.length == 0) {
        show_notification({ type: "error", text: "failed to find any players..." });
        return null;
    }

    // store all found maps here
    const all_found_maps: IMinimalBeatmapResult[] = [];

    // process each player
    for (const player of lookup_result) {
        if (!player) continue;

        try {
            const has_option = (name: string) => options.has(name) || options.has("all");
            const has_status = (status: string) => statuses.has(status) || statuses.has("all");

            const beatmap_promises: Array<{
                key: string;
                promise: Promise<IMinimalBeatmapResult[]>;
            }> = [];

            // Helper to fetch all pages
            const fetch_all_user_beatmaps = async (
                type: "ranked" | "loved" | "pending" | "graveyard" | "favourite" | "guest" | "most_played" | "nominated"
            ): Promise<IMinimalBeatmapResult[]> => {
                let all_beatmaps: IMinimalBeatmapResult[] = [];
                let offset = 0;
                const limit = 100; // API usually allows up to 100
                let has_more = true;

                while (has_more) {
                    const result = await window.api.invoke("web:user_beatmaps", {
                        type,
                        id: player.id,
                        limit,
                        offset
                    });

                    if (!Array.isArray(result) || result.length === 0) {
                        has_more = false;
                        break;
                    }

                    const built_maps = result.flatMap(build_user_beatmaps);
                    all_beatmaps = [...all_beatmaps, ...built_maps];

                    if (result.length < limit) {
                        has_more = false;
                    } else {
                        offset += limit;
                    }
                }
                return all_beatmaps;
            };

            if (has_option("first place")) {
                beatmap_promises.push({
                    key: "firsts",
                    promise: window.api
                        .invoke("web:score_list_user_firsts", { type: "user_firsts", user_id: player.id })
                        .then((scores) => scores.map(build_score_beatmap))
                });
            }

            if (has_option("best performance")) {
                beatmap_promises.push({
                    key: "bests",
                    promise: window.api
                        .invoke("web:score_list_user_best", { type: "user_best", user_id: player.id })
                        .then((scores) => scores.map(build_score_beatmap))
                });
            }

            if (has_option("favourites")) {
                beatmap_promises.push({
                    key: "favs",
                    promise: fetch_all_user_beatmaps("favourite")
                });
            }

            const should_fetch_created = has_option("created maps");

            if (should_fetch_created) {
                if (has_status("ranked")) {
                    beatmap_promises.push({
                        key: "ranked",
                        promise: fetch_all_user_beatmaps("ranked")
                    });
                }

                if (has_status("loved")) {
                    beatmap_promises.push({
                        key: "loved",
                        promise: fetch_all_user_beatmaps("loved")
                    });
                }

                if (has_status("pending")) {
                    beatmap_promises.push({
                        key: "pending",
                        promise: fetch_all_user_beatmaps("pending")
                    });
                }

                if (has_status("graveyard")) {
                    beatmap_promises.push({
                        key: "graveyard",
                        promise: fetch_all_user_beatmaps("graveyard")
                    });
                }
            }

            // execute all promises for this player
            const beatmap_results = await Promise.all(beatmap_promises.map((p) => p.promise));

            // combine results given filter
            beatmap_results.forEach((maps) => {
                all_found_maps.push(...maps);
            });
        } catch (error) {
            console.error(`[get_player_data] error processing player ${player.username}:`, error);
        }
    }

    // After processing all players, filter and unique-ify the maps
    const filter_maps = (maps: IMinimalBeatmapResult[]) => {
        return maps.filter((map) => {
            if (!statuses.has("all") && !statuses.has(map.status)) {
                return false;
            }

            const sr = map.difficulty_rating;
            return sr != undefined && validate_star_rating(sr, star_rating.min, star_rating.max);
        });
    };

    const final_filtered_maps = filter_maps(all_found_maps);

    // remove duplicated hashes
    const unique_maps = final_filtered_maps.reduce((acc, map) => {
        const key = map.md5 || map.beatmap_id;
        if (key && !acc.has(key)) {
            acc.set(key, map);
        }
        return acc;
    }, new Map<string | number, IMinimalBeatmapResult>());

    const final_maps = Array.from(unique_maps.values());

    return {
        // Return first player metadata if available, or a generic placeholder
        player: lookup_result[0]
            ? {
                  id: lookup_result[0].id,
                  username: lookup_result.map((p) => p.username).join(", "),
                  country: lookup_result[0].country_code,
                  avatar: lookup_result[0].avatar_url,
                  cover: lookup_result[0].cover.url
              }
            : null,
        counts: {
            firsts: 0, // Stats are hard to aggregate meaningfully without complex logic, so we omit specific counts
            bests: 0,
            favs: 0,
            ranked: 0,
            loved: 0,
            pending: 0,
            grave: 0,
            total: final_maps.length
        },
        maps: final_maps,
        filters: {
            sr_range: star_rating,
            options: Array.from(options),
            status: Array.from(statuses)
        }
    };
};

export const remove_beatmap = async (md5: string, collection_name?: string) => {
    if (collection_name) {
        collections.remove_beatmap(collection_name, md5);
        await window.api.invoke("driver:delete_beatmap", { md5, collection: collection_name });
    } else {
        await window.api.invoke("driver:delete_beatmap", { md5 });
    }
};
