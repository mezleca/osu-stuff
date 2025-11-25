import {
    ICollectionResult,
    IBeatmapResult,
    BeatmapSetResult,
    IBeatmapFilter,
    BeatmapFile,
    ILegacyDatabase,
    IStableBeatmap,
    beatmap_status_from_code,
    gamemode_from_code,
    IStableBeatmapset,
    ISearchResponse,
    IBeatmapSetFilter,
    IFilteredBeatmapSet,
    IFilteredBeatmap,
    ISearchSetResponse
} from "@shared/types";
import { BaseDriver } from "./base";
import { stable_parser } from "../../binary/stable";
import { config } from "../config";

import fs from "fs";
import path from "path";

const build_beatmap = (beatmap: IStableBeatmap, temp: boolean = false): IBeatmapResult => {
    return {
        md5: beatmap.md5 || "",
        online_id: beatmap.difficulty_id,
        beatmapset_id: beatmap.beatmapset_id,
        title: beatmap.title || "unknown",
        artist: beatmap.artist || "unknown",
        creator: beatmap.creator || "unknown",
        difficulty: beatmap.difficulty || "unknown",
        source: beatmap.source || "",
        tags: beatmap.tags || "",
        star_rating: beatmap.star_rating[beatmap.mode],
        bpm: beatmap.bpm,
        length: beatmap.length,
        last_modified: String(beatmap.last_modification), // :3
        ar: beatmap.ar,
        cs: beatmap.cs,
        hp: beatmap.hp,
        od: beatmap.od,
        status: beatmap_status_from_code(beatmap.status),
        mode: gamemode_from_code(beatmap.mode),
        local: true,
        temp: temp
    };
};

const build_beamapset = (beatmapset: IStableBeatmapset, temp: boolean = false): BeatmapSetResult => {
    return {
        online_id: beatmapset.online_id,
        metadata: {
            artist: beatmapset.artist,
            title: beatmapset.title,
            creator: beatmapset.creator
        },
        beatmaps: Array.from(beatmapset.beatmaps),
        temp: temp
    };
};

class StableBeatmapDriver extends BaseDriver {
    osu!: ILegacyDatabase;

    constructor() {
        super();
    }

    initialize = async (force: boolean = false): Promise<void> => {
        if (this.initialized && !force) {
            return;
        }

        const osu_database_file = path.resolve(config.get().stable_path, "osu!.db");
        const collection_database_file = path.resolve(config.get().stable_path, "collection.db");

        if (!fs.existsSync(osu_database_file) || !fs.existsSync(collection_database_file)) {
            console.error("failed to initialize stable driver (failed to get osu.db file)");
            return;
        }

        const osu_result = stable_parser.get_osu_data(osu_database_file);

        if (!osu_result.success) {
            console.error("failed to parse osu!.db:", osu_result.reason);
            return;
        }

        const collection_result = stable_parser.get_collections_data(collection_database_file);

        if (!collection_result.success) {
            console.error("failed to parse collection.db:", collection_result.reason);
            return;
        }

        this.osu = osu_result.data;

        // populate base driver maps
        this.collections = collection_result.data;
        this.beatmaps.clear();
        this.beatmapsets.clear();

        for (const [md5, beatmap] of this.osu.beatmaps) {
            this.beatmaps.set(md5, build_beatmap(beatmap));
        }

        for (const [id, beatmapset] of this.osu.beatmapsets) {
            this.beatmapsets.set(id, build_beamapset(beatmapset));
        }

        this.initialized = true;
    };

    get_player_name = (): string => {
        return this.osu.player_name;
    };

    add_collection = (name: string, beatmaps: string[]): boolean => {
        if (this.collections.has(name)) {
            return false;
        }

        this.collections.set(name, { name, beatmaps });
        this.should_update = true;

        return true;
    };

    rename_collection = (old_name: string, new_name: string): boolean => {
        const collection = this.collections.get(old_name);

        if (!collection) {
            return false;
        }

        if (this.collections.has(new_name)) {
            return false;
        }

        this.collections.delete(old_name);
        this.collections.set(new_name, { ...collection, name: new_name });
        this.should_update = true;

        return true;
    };

    delete_collection = (name: string): boolean => {
        const result = this.collections.delete(name);

        if (!result) {
            return false;
        }

        this.should_update = true;
        return true;
    };

    delete_beatmap = async (options: { md5: string; collection?: string }): Promise<boolean> => {
        if (options.collection) {
            const collection = this.collections.get(options.collection);
            if (collection) {
                collection.beatmaps = collection.beatmaps.filter((b) => b != options.md5);
                this.should_update = true;
                return true;
            }
            return false;
        }

        return this.osu.beatmaps.delete(options.md5);
    };

    get_collection = (name: string): ICollectionResult | undefined => {
        return this.collections.get(name);
    };

    get_collections = (): ICollectionResult[] => {
        return Array.from(this.collections.values());
    };

    update_collection = (): boolean => {
        const result = stable_parser.write_collections_data(Array.from(this.collections.values()));

        if (!result.success) {
            console.error("failed to write shit:", result.reason);
            return false;
        }

        const target = path.resolve(config.get().stable_path, "collection.db");
        fs.writeFileSync(target, result.data);

        this.should_update = false;
        return result.success;
    };

    add_beatmap = (beatmap: IBeatmapResult): boolean => {
        this.temp_beatmaps.set(beatmap.md5, beatmap);
        return true;
    };

    has_beatmap(md5: string): boolean {
        return this.osu.beatmaps.has(md5);
    }

    has_beatmapset(id: number): boolean {
        return this.osu.beatmapsets.has(id);
    }

    has_beatmapsets(ids: number[]): boolean[] {
        return ids.map((id) => this.has_beatmapset(id));
    }

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        const beatmap = this.osu.beatmaps.get(md5);

        if (beatmap) {
            return build_beatmap(beatmap);
        }

        const temp_beatmap = this.temp_beatmaps.get(md5);

        if (temp_beatmap) {
            return temp_beatmap;
        }

        return undefined;
    };

    get_beatmap_by_id = async (id: number): Promise<IBeatmapResult | undefined> => {
        for (const [_, beatmap] of this.osu.beatmaps) {
            if (beatmap.difficulty_id == id) {
                return build_beatmap(beatmap);
            }
        }

        for (const [_, beatmap] of this.temp_beatmaps) {
            if (beatmap.online_id == id) {
                return beatmap;
            }
        }

        return undefined;
    };

    get_beatmapset = async (set_id: number): Promise<BeatmapSetResult | undefined> => {
        const beatmapset = this.osu.beatmapsets.get(set_id);

        if (beatmapset) {
            return build_beamapset(beatmapset);
        }

        for (const [_, cached] of this.temp_beatmapsets) {
            if (cached.online_id == set_id) {
                return cached;
            }
        }

        return undefined;
    };

    search_beatmaps = async (options: IBeatmapFilter): Promise<ISearchResponse> => {
        const checksums = new Set(
            options.collection ? this.get_collection(options.collection)?.beatmaps || [] : (await this.get_beatmaps()).map((b) => b.md5)
        );

        if (checksums.size == 0) {
            return { beatmaps: [], invalid: [] };
        }

        // get beatmaps on storage
        const { beatmaps, invalid } = await this.fetch_beatmaps(Array.from(checksums));
        const result = this.filter_beatmaps(beatmaps, options);

        // return filtered beatmaps
        return { beatmaps: result, invalid: invalid };
    };

    search_beatmapsets = async (options: IBeatmapSetFilter): Promise<ISearchSetResponse> => {
        let ids = Array.from(this.osu.beatmapsets.keys());

        if (ids.length == 0) {
            return { beatmapsets: [], invalid: [] };
        }

        if (options.query && options.query.trim() != "") {
            const query_lower = options.query.toLowerCase();
            const filtered_ids: number[] = [];

            for (const id of ids) {
                const beatmapset = this.osu.beatmapsets.get(id);
                if (!beatmapset) continue;

                // check metadata match
                const matches_metadata =
                    beatmapset.artist.toLowerCase().includes(query_lower) ||
                    beatmapset.title.toLowerCase().includes(query_lower) ||
                    beatmapset.creator.toLowerCase().includes(query_lower);

                // also check if any beatmap in the set matches
                let matches_beatmap = false;

                for (const md5 of beatmapset.beatmaps) {
                    const beatmap = this.osu.beatmaps.get(md5);
                    if (!beatmap) continue;

                    if (
                        beatmap.difficulty.toLowerCase().includes(query_lower) ||
                        beatmap.tags.toLowerCase().includes(query_lower) ||
                        beatmap.source.toLowerCase().includes(query_lower)
                    ) {
                        matches_beatmap = true;
                        break;
                    }
                }

                if (matches_metadata || matches_beatmap) {
                    filtered_ids.push(id);
                }
            }

            ids = filtered_ids;

            if (ids.length == 0) {
                return { beatmapsets: [], invalid: [] };
            }
        }

        // get beatmaps on storage
        const { beatmaps, invalid } = await this.fetch_beatmapsets(ids);
        const result = await this.filter_beatmapsets(beatmaps, options);

        // return filtered beatmaps
        return { beatmapsets: result, invalid };
    };

    get_beatmaps = async (): Promise<IFilteredBeatmap[]> => {
        const beatmaps = Array.from(this.osu.beatmaps.keys());

        for (const [md5, _] of this.temp_beatmaps) {
            if (md5) beatmaps.push(md5);
        }

        return beatmaps.map((md5) => ({ md5 }));
    };

    get_beatmapsets = async (): Promise<IFilteredBeatmapSet[]> => {
        const beatmapsets: IFilteredBeatmapSet[] = [];

        for (const beatmapset of this.osu.beatmapsets.values()) {
            beatmapsets.push({ id: beatmapset.online_id, beatmaps: Array.from(beatmapset.beatmaps) });
        }

        return beatmapsets;
    };

    get_beatmapset_files = async (id: number): Promise<BeatmapFile[]> => {
        const beatmapset = this.osu.beatmapsets.get(id);

        if (!beatmapset) {
            return [];
        }

        const files: BeatmapFile[] = [];

        for (const md5 of beatmapset.beatmaps) {
            const beatmap = this.osu.beatmaps.get(md5);

            if (!beatmap) {
                continue;
            }

            // TOFIX: missing background from processor
            files.push(
                {
                    name: beatmap.file,
                    location: path.join(config.get().stable_songs_path, beatmap.file_path)
                },
                {
                    name: beatmap.audio_file_name,
                    location: path.join(config.get().stable_songs_path, beatmap.audio_path)
                }
            );
        }

        return files;
    };

    fetch_beatmaps = async (checksums: string[]): Promise<{ beatmaps: IBeatmapResult[]; invalid: string[] }> => {
        const beatmaps: IBeatmapResult[] = [];
        const invalid: string[] = [];

        for (const md5 of checksums) {
            const beatmap = this.osu.beatmaps.get(md5);

            if (beatmap) {
                beatmaps.push(build_beatmap(beatmap));
                continue;
            }

            const temp_beatmap = this.temp_beatmaps.get(md5);

            // search on temp
            if (temp_beatmap) {
                beatmaps.push(temp_beatmap);
            } else {
                invalid.push(md5);
            }
        }

        return { beatmaps, invalid };
    };

    fetch_beatmapsets = async (ids: number[]): Promise<{ beatmaps: BeatmapSetResult[]; invalid: number[] }> => {
        const beatmapsets: BeatmapSetResult[] = [];
        const invalid: number[] = [];

        for (const id of ids) {
            const beatmapset = this.osu.beatmapsets.get(id);
            if (!beatmapset) {
                invalid.push(id);
                continue;
            }
            beatmapsets.push(build_beamapset(beatmapset));
        }

        return { beatmaps: beatmapsets, invalid };
    };

    dispose = async (): Promise<void> => {
        this.osu.beatmaps = new Map();
        this.osu.beatmapsets = new Map();
    };
}

export const stable_driver = new StableBeatmapDriver();
