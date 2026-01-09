import { get, writable } from "svelte/store";
import { show_notification } from "../store/notifications";
import { collections } from "../store/collections";
import { quick_confirm } from "./modal";
import { downloader } from "../store/downloader";
import type { BeatmapSetResult, IBeatmapResult, IMinimalBeatmapResult, UsersDetailsResponse } from "@shared/types";
import LRU from "quick-lru";

const MAX_STAR_RATING_VALUE = 10; // lazer

// beatmap result that will be used on preview
export const beatmap_preview = writable<IBeatmapResult | null>(null);

// cached beatmap / beatmapsets
export const beatmap_cache = new LRU<string, IBeatmapResult>({ maxSize: 512 });
export const beatmapset_cache = new LRU<number, BeatmapSetResult>({ maxSize: 256 });

export const get_beatmap = async (id: string): Promise<IBeatmapResult | undefined> => {
    const cached = beatmap_cache.get(id);

    if (cached) {
        return cached;
    }

    const beatmap = await window.api.invoke("driver:get_beatmap_by_md5", id);

    if (!beatmap) {
        return undefined;
    }

    beatmap_cache.set(id, beatmap);
    return beatmap;
};

export const invalidate_beatmap = (id: string) => {
    beatmap_cache.delete(id);
};

export const invalidate_beatmapset = (id: number) => {
    beatmapset_cache.delete(id);
};

export const get_beatmapset = async (id: number): Promise<BeatmapSetResult | undefined> => {
    const cached = beatmapset_cache.get(id);

    if (cached) {
        return cached;
    }

    const beatmapset = await window.api.invoke("driver:get_beatmapset", id);

    if (!beatmapset) {
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

const build_score_beatmap = (score: any): IMinimalBeatmapResult => ({
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
});

const build_user_beatmaps = (beatmap: any): IMinimalBeatmapResult[] => {
    if (beatmap.beatmaps && Array.isArray(beatmap.beatmaps)) {
        // for beatmaps that contain difficulty variants (e.g. from beatmapset lookup)
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

    // for direct beatmap objects or single difficulty
    return [
        {
            beatmap_id: beatmap.beatmap_id || beatmap.id,
            beatmapset_id: beatmap.id,
            difficulty_rating: beatmap.beatmap?.difficulty_rating ?? beatmap.difficulty_rating,
            status: beatmap.status,
            md5: beatmap.beatmap?.checksum ?? beatmap.checksum,
            version: beatmap.beatmap?.version ?? beatmap.version,
            artist: beatmap.artist,
            title: beatmap.title,
            creator: beatmap.creator,
            _raw: beatmap
        }
    ];
};

export interface IPlayerDataResult {
    players: UsersDetailsResponse[];
    counts: {
        firsts: number;
        bests: number;
        favs: number;
        ranked: number;
        loved: number;
        pending: number;
        grave: number;
        total: number;
    };
    maps: IMinimalBeatmapResult[];
    filters: {
        sr_range: { min: number; max: number };
        options: string[];
        status: string[];
    };
}

export const get_player_data = async (data: IPlayerOptions): Promise<IPlayerDataResult | null> => {
    const { player_name, options, statuses, star_rating } = data;

    if (!player_name) {
        show_notification({ type: "error", text: "invalid player name!!!" });
        return null;
    }

    // handle multiple players
    const player_names = player_name
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    const all_found_maps: IMinimalBeatmapResult[] = [];
    const players_found: UsersDetailsResponse[] = [];

    // process each player
    for (const name of player_names) {
        try {
            // first fetch detailed user info to get counts
            const player = await window.api.invoke("web:users_details", { user: name });

            // basic validation properties that usually exist on a valid user object
            if (!player || player.error || player.is_restricted) {
                console.warn(`[get_player_data] player not found or restricted: ${name}`);
                continue;
            }

            players_found.push(player);

            const has_option = (name: string) => options.has(name) || options.has("all");
            const has_status = (status: string) => statuses.has(status) || statuses.has("all");

            const beatmap_promises: Promise<IMinimalBeatmapResult[]>[] = [];

            const fetch_listing_maps = async (
                type: "ranked" | "loved" | "pending" | "graveyard" | "favourite" | "guest" | "most_played" | "nominated",
                expected_count?: number
            ): Promise<IMinimalBeatmapResult[]> => {
                if (expected_count !== undefined && expected_count === 0) return [];

                let all_beatmaps: IMinimalBeatmapResult[] = [];
                let offset = 0;
                const limit = 100;
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

                    // stop if we reached or exceeded the expected count (if provided)
                    if (expected_count && all_beatmaps.length >= expected_count) {
                        has_more = false;
                    }
                }
                return all_beatmaps;
            };

            // 1. first places
            if (has_option("first place") && player.scores_first_count > 0) {
                // fetch all pages for first places
                const fetch_firsts = async () => {
                    let collected: any[] = [];
                    let offset = 0;
                    const limit = 100;
                    const total = player.scores_first_count;

                    while (collected.length < total) {
                        const scores = await window.api.invoke("web:score_list_user_firsts", {
                            type: "user_firsts",
                            user_id: player.id,
                            limit,
                            offset
                        });

                        if (!Array.isArray(scores) || scores.length === 0) break;
                        collected = [...collected, ...scores];
                        if (scores.length < limit) break;
                        offset += limit;
                    }
                    return collected.map(build_score_beatmap);
                };

                beatmap_promises.push(fetch_firsts());
            }

            // 2. best performance
            if (has_option("best performance") && player.scores_best_count > 0) {
                const fetch_bests = async () => {
                    let collected: any[] = [];
                    let offset = 0;
                    const limit = 100;
                    const total = player.scores_best_count;

                    while (collected.length < total) {
                        const scores = await window.api.invoke("web:score_list_user_best", {
                            type: "user_best",
                            user_id: player.id,
                            limit,
                            offset
                        });

                        if (!Array.isArray(scores) || scores.length === 0) break;
                        collected = [...collected, ...scores];

                        if (scores.length < limit) break;
                        offset += limit;
                    }
                    return collected.map(build_score_beatmap);
                };

                beatmap_promises.push(fetch_bests());
            }

            if (has_option("favourites")) {
                beatmap_promises.push(fetch_listing_maps("favourite", player.favourite_beatmapset_count));
            }

            const should_fetch_created = has_option("created maps");

            if (should_fetch_created) {
                if (has_status("ranked")) {
                    beatmap_promises.push(fetch_listing_maps("ranked", player.ranked_beatmapset_count));
                }

                if (has_status("loved")) {
                    beatmap_promises.push(fetch_listing_maps("loved", player.loved_beatmapset_count));
                }

                if (has_status("pending")) {
                    beatmap_promises.push(fetch_listing_maps("pending", player.pending_beatmapset_count));
                }

                if (has_status("graveyard")) {
                    beatmap_promises.push(fetch_listing_maps("graveyard", player.graveyard_beatmapset_count));
                }
            }

            const beatmap_results = await Promise.all(beatmap_promises);

            beatmap_results.forEach((maps) => {
                all_found_maps.push(...maps);
            });
        } catch (error) {
            console.error(`[get_player_data] error processing player ${name}:`, error);
        }
    }

    if (players_found.length === 0) {
        show_notification({ type: "error", text: "no players found" });
        return null;
    }

    // filter and deduplicate
    const unique_maps = new Map<string, IMinimalBeatmapResult>();

    all_found_maps.forEach((map) => {
        // status check
        if (!statuses.has("all") && !statuses.has(map.status)) {
            return;
        }

        // star rating check
        const sr = map.difficulty_rating;

        if (sr != undefined && !validate_star_rating(sr, star_rating.min, star_rating.max)) {
            return;
        }

        const key = map.md5 || String(map.beatmap_id);

        if (key && !unique_maps.has(key)) {
            unique_maps.set(key, map);
        }
    });

    const final_maps = Array.from(unique_maps.values());

    return {
        players: players_found,
        counts: {
            firsts: players_found.reduce((acc, p) => acc + (p.scores_first_count || 0), 0),
            bests: players_found.reduce((acc, p) => acc + (p.scores_best_count || 0), 0),
            favs: players_found.reduce((acc, p) => acc + (p.favourite_beatmapset_count || 0), 0),
            ranked: players_found.reduce((acc, p) => acc + (p.ranked_beatmapset_count || 0), 0),
            loved: players_found.reduce((acc, p) => acc + (p.loved_beatmapset_count || 0), 0),
            pending: players_found.reduce((acc, p) => acc + (p.pending_beatmapset_count || 0), 0),
            grave: players_found.reduce((acc, p) => acc + (p.graveyard_beatmapset_count || 0), 0),
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
