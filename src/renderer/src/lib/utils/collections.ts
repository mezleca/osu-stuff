import { reset_beatmap_lists } from "../store/beatmaps";
import { reset_audio_manager } from "../store/audio";
import { collections } from "../store/collections";
import { config } from "../store/config";
import { custom_fetch, string_is_valid } from "./utils";
import type { GenericResult, IBeatmapResult, ICollectionResult, IOsuCollectorCollection, IOsuCollectorTournament } from "@shared/types";
import { get_beatmap } from "./beatmaps";

export const get_osu_data = async (force_load: boolean = false) => {
    const stable_path = config.get("stable_path");
    const lazer_path = config.get("lazer_path");

    // dont show notification if we dont have a valid path
    if (!string_is_valid(stable_path) && !string_is_valid(lazer_path)) {
        return;
    }

    // initialize driver based on mode
    const driver = config.get("lazer_mode") == true ? "lazer" : "stable";

    // TOFIX: return generic result instead of void
    await window.api.invoke("driver:initialize", force_load, driver);

    // reset stuff
    reset_beatmap_lists();
    reset_audio_manager();

    // update data
    const result = await window.api.invoke("driver:get_collections", driver);

    // add new collections
    collections.set(result);

    // get update state
    const update_state = await window.api.invoke("driver:should_update", driver);
    collections.needs_update.set(update_state);
};

const get_tournament_maps = async (id: number): Promise<GenericResult<IBeatmapResult[]>> => {
    const response = await custom_fetch({ method: "GET", url: `https://osucollector.com/api/tournaments/${id}` });

    if (!response.success || response.status != 200) {
        return { success: false, reason: response.status_text };
    }

    const data = response.data as IOsuCollectorTournament;
    const beatmaps: IBeatmapResult[] = [];

    for (const round of data.rounds) {
        for (const mod of round.mods) {
            for (const beatmap of mod.maps) {
                beatmaps.push({
                    title: beatmap.beatmapset.title,
                    artist: beatmap.beatmapset.artist,
                    md5: beatmap.checksum,
                    online_id: beatmap.id,
                    beatmapset_id: beatmap.beatmapset.id,
                    creator: beatmap.beatmapset.creator,
                    difficulty: beatmap.version,
                    star_rating: beatmap.difficulty_rating,
                    tags: [],
                    ar: beatmap.ar,
                    cs: beatmap.cs,
                    hp: 5, // surely im blind
                    od: beatmap.accuracy,
                    bpm: beatmap.bpm,
                    length: beatmap.hit_length,
                    temp: true,
                    local: false,
                    status: beatmap.status,
                    mode: beatmap.mode,
                    last_modified: ""
                });
            }
        }
    }

    return { success: true, data: beatmaps };
};

const get_collection_maps = async (id: number): Promise<GenericResult<IBeatmapResult[]>> => {
    const response = await custom_fetch({
        method: "GET",
        url: `https://osucollector.com/api/collections/${id}/beatmapsv3?perPage=50`
    });

    if (!response.success || response.status != 200) {
        return { success: false, reason: response.status_text };
    }

    const data = response.data as IOsuCollectorCollection;
    const beatmaps: IBeatmapResult[] = [];
    const beatmapsets = new Map(data.beatmapsets.map((set) => [set.id, set]));

    for (const beatmap of data.beatmaps) {
        const set_data = beatmapsets.get(beatmap.beatmapset_id);

        if (!set_data) {
            console.warn(`skipping: ${beatmap.beatmapset_id} (beatmapset not fond)`);
            continue;
        }

        beatmaps.push({
            title: set_data.title,
            artist: set_data.artist,
            md5: beatmap.checksum,
            online_id: beatmap.id,
            beatmapset_id: set_data.id,
            creator: set_data.creator,
            difficulty: beatmap.version,
            star_rating: beatmap.difficulty_rating,
            tags: [],
            ar: beatmap.ar,
            cs: beatmap.cs,
            hp: 5, // surely im blind
            od: beatmap.accuracy,
            bpm: beatmap.bpm,
            length: beatmap.hit_length,
            temp: true,
            local: false,
            status: beatmap.status,
            mode: beatmap.mode,
            last_modified: ""
        });
    }

    return { success: true, data: beatmaps };
};

interface IOsuCollectorResult {
    name: string;
    beatmaps: IBeatmapResult[];
    checksums: string[];
}

export const get_from_osu_collector = async (url: string): Promise<GenericResult<IOsuCollectorResult>> => {
    if (url == "") {
        return { success: false, reason: "invalid url" };
    }

    const url_array = url.split("/");
    const collection_id = Number(url_array.find((part) => Number(part)));

    if (!collection_id || isNaN(collection_id)) {
        return { success: false, reason: "invaid collection id" };
    }

    const collection_name = decodeURIComponent(url_array[url_array.length - 1].split("?")[0]).replace(/-/g, " ");
    const result = url_array.includes("tournaments") ? await get_tournament_maps(collection_id) : await get_collection_maps(collection_id);

    if (!result.success) {
        return { success: false, reason: "collection not found..." };
    }

    const collection_result: IOsuCollectorResult = {
        name: collection_name,
        beatmaps: result.data,
        checksums: result.data.map((b) => b.md5)
    };

    return { success: true, data: collection_result };
};

export const get_osdb_data = async (location: string) => {
    return window.api.invoke("reader:read_osdb", location);
};

export const get_legacy_collection_data = async (location: string) => {
    return window.api.invoke("reader:read_legacy_collection", location);
};

export const export_collection = async (collection: ICollectionResult, type: string) => {
    return window.api.invoke("driver:export_collections", [collection], type);
};

export const export_collections = async (collections: ICollectionResult[], type: string) => {
    return window.api.invoke("driver:export_collections", collections, type);
};

// TODO: parallel
export const export_beatmaps = async (collections_name: string[]): Promise<GenericResult<number>> => {
    if (!collections_name || collections_name.length == 0) {
        return { success: false, reason: "no collections selected" };
    }

    let exported = 0;
    let found_any = false;

    for await (const name of collections_name) {
        const collection = collections.get(name);
        if (!collection) {
            console.warn("failed to find", name);
            continue;
        }

        found_any = true;

        for (const hash of collection.beatmaps) {
            const beatmap = await get_beatmap(hash);
            if (!beatmap) {
                console.warn(`skipping: ${hash} (not found)`);
                continue;
            }

            const result = await window.api.invoke("driver:export_beatmapset", beatmap.beatmapset_id);
            if (result) {
                exported++;
            }
        }
    }

    if (!found_any) {
        return { success: false, reason: "no valid collections found" };
    }

    if (exported == 0) {
        return { success: false, reason: "no beatmaps were exported" };
    }

    return { success: true, data: exported };
};
