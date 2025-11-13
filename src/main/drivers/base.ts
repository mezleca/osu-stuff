import {
    IOsuDriver,
    IBeatmapFilter,
    IBeatmapResult,
    BeatmapSetResult,
    ICollectionResult,
    IOSDBData,
    OsdbVersion,
    IOSDBCollection,
    ILegacyCollectionDatabase,
    LEGACY_DATABASE_VERSION,
    IStableCollection,
    BeatmapFile,
    gamemode_to_code,
    IExportCollectionsParams,
    IAddCollectionParams,
    IDeleteCollectionParams,
    IGetCollectionParams,
    IUpdateCollectionParams,
    IAddBeatmapParams,
    IGetBeatmapByMd5Params,
    IGetBeatmapByIdParams,
    IGetBeatmapsetParams,
    IGetBeatmapsetFilesParams,
    IFetchBeatmapsParams
} from "@shared/types";
import { check_beatmap_difficulty, filter_beatmap_by_query, sort_beatmaps } from "../beatmaps/beatmaps";
import { osdb_parser } from "../binary/osdb";
import { stable_parser } from "../binary/stable";
import { config } from "../database/config";

import path from "path";
import fs from "fs";

export abstract class BaseDriver implements IOsuDriver {
    protected temp_beatmaps: Map<string, IBeatmapResult> = new Map();
    protected initialized: boolean = false;

    protected add_to_temp = (beatmap: IBeatmapResult): void => {
        this.temp_beatmaps.set(beatmap.md5, beatmap);
    }

    protected remove_from_temp = (md5: string): boolean => {
        return this.temp_beatmaps.delete(md5);
    }

    protected get_from_temp_by_md5 = (md5: string): IBeatmapResult | null => {
        return this.temp_beatmaps.get(md5) || null;
    }

    protected get_from_temp_by_id = (id: number): IBeatmapResult | null => {
        for (const beatmap of this.temp_beatmaps.values()) {
            if (beatmap.online_id == id) {
                return beatmap;
            }
        }
        return null;
    }

    protected clear_temp = (): void => {
        this.temp_beatmaps.clear();
    }

    protected filter_beatmaps = (beatmaps: IBeatmapResult[], options: IBeatmapFilter): string[] => {
        const unique = new Set<string>();

        const filtered = beatmaps.filter((beatmap) => {
            if (options.status && beatmap.status != options.status) {
                return false;
            }

            if (options.unique) {
                if (!beatmap.unique_id || beatmap.unique_id == "") {
                    return false;
                }
                if (unique.has(beatmap.unique_id)) {
                    return false;
                }
                unique.add(beatmap.unique_id);
            }

            if (options.difficulty_range && !check_beatmap_difficulty(beatmap, options.difficulty_range)) {
                return false;
            }

            if (options.query && !filter_beatmap_by_query(beatmap, options.query)) {
                return false;
            }

            return true;
        });

        return sort_beatmaps(filtered, options.sort).map((b) => b.md5);
    }

    private write_osdb_collection = async (collections: ICollectionResult[]) => {
        const osdb_data: IOSDBData = {
            collections: [],
            count: 0,
            last_editor: this.get_player_name(),
            save_date: BigInt(new Date().getTime())
        };

        const output_name = collections.map((c) => c.name).join("-") + `.osdb`;

        for (const collection of collections) {
            // create new osdb collection
            const osdb_collection = {
                name: collection.name
            } as IOSDBCollection;

            // add data from previous collection
            for (const hash of collection.beatmaps) {
                const beatmap = await this.get_beatmap_by_md5({ md5: hash });

                if (!beatmap) {
                    continue;
                }

                osdb_collection.beatmaps.push({
                    difficulty_id: beatmap.online_id,
                    beatmapset_id: beatmap.beatmapset_id,
                    artist: beatmap.artist,
                    title: beatmap.title,
                    diff_name: beatmap.difficulty,
                    md5: beatmap.md5,
                    difficulty_rating: beatmap.star_rating,
                    mode: gamemode_to_code(beatmap.mode)
                });
            }

            osdb_data.collections.push(osdb_collection);
            osdb_data.count++;
            osdb_collection.hash_only_beatmaps = collection.beatmaps;
        }

        // get buffer
        const result = osdb_parser.write(OsdbVersion.O_DM8_MIN, osdb_data);

        if (!result.success) {
            console.log(result.reason);
            return false;
        }

        const buffer = result.data as Buffer;
        const location = path.resolve(config.get().export_path, output_name);

        if (!fs.existsSync(path.dirname(location))) {
            fs.mkdirSync(path.dirname(location));
        }

        fs.writeFileSync(location, buffer);
        return true;
    }

    private write_stable_collection(collections: ICollectionResult[]): boolean {
        const collection_data: ILegacyCollectionDatabase = {
            collections: [],
            version: LEGACY_DATABASE_VERSION,
            length: 0
        };

        const output_name = collections.map((c) => c.name).join("-") + `.db`;

        for (const collection of collections) {
            // create new osdb collection
            const stable_collection = {
                name: collection.name,
                maps: new Set(...collection.beatmaps)
            } as IStableCollection;

            collection_data.collections.push(stable_collection);
            collection_data.length++;
        }

        // get buffer
        const result = stable_parser.write_collections_data(collection_data);

        if (!result.success) {
            console.log(result.reason);
            return false;
        }

        const buffer = result.data;
        const location = path.resolve(config.get().export_path, output_name);

        if (!fs.existsSync(path.dirname(location))) {
            fs.mkdirSync(path.dirname(location));
        }

        fs.writeFileSync(location, buffer);
        return true;
    }

    export_collections = async (params: IExportCollectionsParams): Promise<boolean> => {
        return params.type == "osdb" ? 
            this.write_osdb_collection(params.collections) : 
            this.write_stable_collection(params.collections);
    }

    abstract initialize(): Promise<void>;
    abstract get_player_name(): string;
    abstract add_collection(params: IAddCollectionParams): boolean;
    abstract delete_collection(params: IDeleteCollectionParams): boolean;
    abstract get_collection(params: IGetCollectionParams): ICollectionResult | undefined;
    abstract get_collections(): ICollectionResult[];
    abstract update_collection(params: IUpdateCollectionParams): boolean;
    abstract add_beatmap(params: IAddBeatmapParams): boolean;
    abstract get_beatmap_by_md5(params: IGetBeatmapByMd5Params): Promise<IBeatmapResult | undefined>;
    abstract get_beatmap_by_id(params: IGetBeatmapByIdParams): Promise<IBeatmapResult | undefined>;
    abstract get_beatmapset(params: IGetBeatmapsetParams): Promise<BeatmapSetResult | undefined>;
    abstract search_beatmaps(options: IBeatmapFilter): Promise<string[]>;
    abstract get_all_beatmaps(): Promise<string[]>;
    abstract get_beatmapset_files(params: IGetBeatmapsetFilesParams): Promise<BeatmapFile[]>;
    abstract fetch_beatmaps(params: IFetchBeatmapsParams): Promise<IBeatmapResult[]>;
    abstract dispose(): Promise<void>;
};
