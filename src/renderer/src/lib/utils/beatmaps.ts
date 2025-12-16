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
    const { player_name, options, statuses, star_rating } = data;

    if (!player_name) {
        show_notification({ type: "error", text: "invalid player name!!!" });
        return null;
    }

    const lookup_result = await window.api.invoke("web:players_lookup", { ids: [player_name] });

    if (lookup_result.error) {
        show_notification({ type: "error", text: "failed to find " + player_name });
        return null;
    }

    const player = lookup_result[0];

    try {
        const has_option = (name: string) => options.has(name) || options.has("all");
        const has_status = (status: string) => statuses.has(status) || statuses.has("all");

        const beatmap_promises: Array<{
            key: string;
            promise: Promise<IMinimalBeatmapResult[]>;
        }> = [];

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
                promise: window.api
                    .invoke("web:user_beatmaps", { type: "favourite", id: player.id })
                    .then((beatmaps) => beatmaps.flatMap(build_user_beatmaps))
            });
        }

        const should_fetch_created = has_option("created maps");

        if (should_fetch_created) {
            if (has_status("ranked")) {
                beatmap_promises.push({
                    key: "ranked",
                    promise: window.api
                        .invoke("web:user_beatmaps", { type: "ranked", id: player.id })
                        .then((beatmaps) => beatmaps.flatMap(build_user_beatmaps))
                });
            }

            if (has_status("loved")) {
                beatmap_promises.push({
                    key: "loved",
                    promise: window.api
                        .invoke("web:user_beatmaps", { type: "loved", id: player.id })
                        .then((beatmaps) => beatmaps.flatMap(build_user_beatmaps))
                });
            }

            if (has_status("pending")) {
                beatmap_promises.push({
                    key: "pending",
                    promise: window.api
                        .invoke("web:user_beatmaps", { type: "pending", id: player.id })
                        .then((beatmaps) => beatmaps.flatMap(build_user_beatmaps))
                });
            }

            if (has_status("graveyard")) {
                beatmap_promises.push({
                    key: "graveyard",
                    promise: window.api
                        .invoke("web:user_beatmaps", { type: "graveyard", id: player.id })
                        .then((beatmaps) => beatmaps.flatMap(build_user_beatmaps))
                });
            }
        }

        // execute all promises
        const beatmap_results = await Promise.all(beatmap_promises.map((p) => p.promise));
        const beatmap_data: Record<string, IMinimalBeatmapResult[]> = {
            firsts: [],
            bests: [],
            favs: [],
            ranked: [],
            loved: [],
            pending: [],
            grave: []
        };

        // populate beatmap data
        beatmap_promises.forEach((p, index) => (beatmap_data[p.key] = beatmap_results[index] || []));

        // filter beatmaps by status, star rating
        const filter_maps = (maps: IMinimalBeatmapResult[]) => {
            return maps.filter((map) => {
                if (!has_status(map.status)) {
                    return false;
                }

                const sr = map.difficulty_rating;
                return sr != undefined && validate_star_rating(sr, star_rating.min, star_rating.max);
            });
        };

        // filter each beaatmap category
        const filtered_data = {
            firsts: filter_maps(beatmap_data.firsts),
            bests: filter_maps(beatmap_data.bests),
            favs: filter_maps(beatmap_data.favs),
            ranked: filter_maps(beatmap_data.ranked),
            loved: filter_maps(beatmap_data.loved),
            pending: filter_maps(beatmap_data.pending),
            grave: filter_maps(beatmap_data.grave)
        };

        // combine everything
        const all_maps = [
            ...filtered_data.firsts,
            ...filtered_data.bests,
            ...filtered_data.favs,
            ...filtered_data.ranked,
            ...filtered_data.loved,
            ...filtered_data.pending,
            ...filtered_data.grave
        ];

        // remove duplicated hashes
        const unique_maps = all_maps.reduce((acc, map) => {
            const key = map.md5 || map.beatmap_id;
            if (key && !acc.has(key)) {
                acc.set(key, map);
            }
            return acc;
        }, new Map<string | number, IMinimalBeatmapResult>());

        const final_maps = Array.from(unique_maps.values());

        return {
            player: {
                id: player.id,
                username: player.username,
                country: player.country_code,
                avatar: player.avatar_url,
                cover: player.cover.url
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
                options: Array.from(options),
                status: Array.from(statuses)
            }
        };
    } catch (error) {
        console.error("[get_player_data] error:", error);
        return null;
    }
};

export const remove_beatmap = async (md5: string, collection_name?: string) => {
    if (collection_name) {
        collections.remove_beatmap(collection_name, md5);
        await window.api.invoke("driver:delete_beatmap", { md5, collection: collection_name });
    } else {
        await window.api.invoke("driver:delete_beatmap", { md5 });
    }
};
