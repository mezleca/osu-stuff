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
    IStableBeatmapset
} from "@shared/types";
import { BaseDriver } from "./base";
import { stable_parser } from "../binary/stable";
import { config } from "../database/config";

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
        beatmaps: Array.from(beatmapset.beatmaps)
    };
};

class StableBeatmapDriver extends BaseDriver {
    osu!: ILegacyDatabase;
    collections!: Map<string, ICollectionResult>;

    constructor() {
        super();
    }

    initialize = async (): Promise<void> => {
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
        this.collections = collection_result.data;

        console.log(this.collections);
    };

    get_player_name = (): string => {
        return this.osu.player_name;
    };

    add_collection = (name: string, beatmaps: string[]): boolean => {
        if (this.collections.has(name)) return false;
        this.collections.set(name, { name, beatmaps });
        return true;
    };

    delete_collection = (name: string): boolean => {
        return this.collections.delete(name);
    };

    get_collection = (name: string): ICollectionResult | undefined => {
        return this.collections.get(name);
    };

    get_collections = (): ICollectionResult[] => {
        return Array.from(this.collections.values());
    };

    update_collection = (collections: ICollectionResult[]): boolean => {
        if (collections.length == 0) {
            console.warn("skipped collection update, length == 0");
            return false;
        }

        const result = stable_parser.write_collections_data(collections);
        return result.success;
    };

    add_beatmap = (beatmap: IBeatmapResult): boolean => {
        if (!beatmap.md5 || beatmap.md5 == "") {
            console.error("failed to add beatmap, invalid md5");
            return false;
        }

        this.temp_beatmaps.set(beatmap.md5, beatmap);
        return true;
    };

    get_beatmap_by_md5 = async (md5: string): Promise<IBeatmapResult | undefined> => {
        const temp_beatmap = this.temp_beatmaps.get(md5);

        if (temp_beatmap) {
            return temp_beatmap;
        }

        const beatmap = this.osu.beatmaps.get(md5);

        if (!beatmap) {
            return undefined;
        }

        return build_beatmap(beatmap);
    };

    get_beatmap_by_id = async (id: number): Promise<IBeatmapResult | undefined> => {
        const temp_beatmap = this.get_from_temp_by_id(id);

        if (temp_beatmap) {
            return temp_beatmap;
        }

        for (const [_, beatmap] of this.osu.beatmaps) {
            if (beatmap.difficulty_id == id) {
                return build_beatmap(beatmap);
            }
        }

        return undefined;
    };

    get_beatmapset = async (set_id: number): Promise<BeatmapSetResult | undefined> => {
        const beatmapset = this.osu.beatmapsets.get(set_id);

        if (!beatmapset) {
            return undefined;
        }

        return build_beamapset(beatmapset);
    };

    search_beatmaps = async (options: IBeatmapFilter): Promise<string[]> => {
        const checksums = new Set(options.collection ? this.get_collection(options.collection)?.beatmaps || [] : await this.get_all_beatmaps());

        if (checksums.size == 0) {
            return [];
        }

        // get beatmaps on storage
        const beatmaps = await this.fetch_beatmaps(Array.from(checksums));

        // return filtered beatmaps
        return this.filter_beatmaps(beatmaps, options);
    };

    get_all_beatmaps = async (): Promise<string[]> => {
        const beatmaps = Array.from(this.osu.beatmaps.keys());

        for (const [md5, _] of this.temp_beatmaps) {
            if (md5) beatmaps.push(md5);
        }

        return beatmaps;
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

            beatmap.audio_file_name;
            beatmap.file_path;

            // TOFIX: obviously missing audio and background from processor
            files.push({
                name: beatmap.file,
                location: beatmap.file_path
            });
        }

        return files;
    };

    fetch_beatmaps = async (checksums: string[]): Promise<IBeatmapResult[]> => {
        const beatmaps: IBeatmapResult[] = [];

        // add temp beatmaps
        for (const [_, beatmap] of this.temp_beatmaps) {
            beatmaps.push(beatmap);
        }

        // add stored beatmaps
        for (const [_, beatmap] of this.osu.beatmaps) {
            beatmaps.push(build_beatmap(beatmap));
        }

        return beatmaps;
    };

    dispose = async (): Promise<void> => {
        this.osu.beatmaps = new Map();
        this.osu.beatmapsets = new Map();
    };
}

export const stable_driver = new StableBeatmapDriver();
