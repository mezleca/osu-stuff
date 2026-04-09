import { IBeatmapResult, BeatmapSetResult, GameMode, LAZER_DATABASE_VERSION, BeatmapFile, BeatmapRow, lazer_status_from_code } from "@shared/types";
import {
    BeatmapCollectionSchema,
    BeatmapDifficultySchema,
    BeatmapMetadataSchema,
    BeatmapSchema,
    BeatmapSetSchema,
    BeatmapUserSettingsSchema,
    FileSchema,
    RealmNamedFileUsageSchema,
    RealmUserSchema,
    RulesetSchema
} from "./schemas/lazer";
import { BaseClient } from "./base";
import { config } from "../../database/config";
import { get_lazer_file_location } from "../beatmaps";
import { get_audio_duration } from "../audio";
import { beatmap_processor } from "../../database/processor";

import { BeatmapParser } from "../parsers";
import Realm from "realm";
import fs from "fs";
import path from "path";

const get_beatmap_properties = async (file_location: string) => {
    const parser = new BeatmapParser();

    try {
        await parser.parse(file_location);
        const media = parser.get_media();

        return {
            AudioFilename: media.AudioFilename ?? "",
            Background: media.Background ?? "",
            Duration: media.Duration ?? 0
        };
    } finally {
        parser.free();
    }
};

const build_beatmap = (beatmap: BeatmapSchema, processed?: BeatmapRow, temp: boolean = false): IBeatmapResult => {
    return {
        md5: beatmap.MD5Hash || "",
        online_id: beatmap.OnlineID,
        beatmapset_id: beatmap.BeatmapSet.OnlineID,
        title: beatmap.Metadata.Title || "unknown",
        artist: beatmap.Metadata.Artist || "unknown",
        creator: beatmap.Metadata.Author?.Username || "unknown",
        difficulty: beatmap.DifficultyName || "unknown",
        source: beatmap.Metadata.Source || "",
        tags: beatmap.Metadata.Tags || "",
        star_rating: beatmap.StarRating,
        bpm: beatmap.BPM,
        last_modified: beatmap.LastLocalUpdate?.toString() || "",
        length: beatmap.Length,
        ar: beatmap.Difficulty.ApproachRate,
        cs: beatmap.Difficulty.CircleSize,
        hp: beatmap.Difficulty.DrainRate,
        od: beatmap.Difficulty.OverallDifficulty,
        status: lazer_status_from_code(beatmap.Status),
        mode: (beatmap.Ruleset.Name as GameMode) || GameMode.Osu,
        temp: temp,
        duration: processed?.duration || 0,
        background: processed?.background || "",
        audio: processed?.audio || ""
    };
};

const build_beatmapset = (beatmapset: BeatmapSetSchema, temp: boolean = false): BeatmapSetResult => {
    const ref_beatmap = beatmapset.Beatmaps[0];
    return {
        online_id: beatmapset.OnlineID,
        metadata: {
            artist: ref_beatmap.Metadata.Artist || "unknown",
            title: ref_beatmap.Metadata.Title || "unknown",
            creator: ref_beatmap.Metadata.Author?.Username || "unknown"
        },
        beatmaps: beatmapset.Beatmaps.map((b) => b.MD5Hash).filter((b) => b != undefined),
        temp: temp
    };
};

class LazerBeatmapClient extends BaseClient {
    instance!: Realm;

    constructor() {
        super();
    }

    initialize = async (force: boolean = false): Promise<boolean> => {
        if (this.instance && !force) {
            return true;
        }

        const lazer_path = config.get().lazer_path ?? "";
        const realm_location = path.resolve(lazer_path, "client.realm");

        if (!fs.existsSync(realm_location)) {
            console.warn("failed to find:", realm_location);
            return false;
        }

        if (!this.instance) {
            const schema = [
                BeatmapDifficultySchema,
                BeatmapMetadataSchema,
                BeatmapUserSettingsSchema,
                BeatmapCollectionSchema,
                BeatmapSetSchema,
                BeatmapSchema,
                RealmUserSchema,
                RulesetSchema,
                FileSchema,
                RealmNamedFileUsageSchema
            ] as unknown as NonNullable<Realm.Configuration["schema"]>;

            this.instance = new Realm({
                path: realm_location,
                schema,
                schemaVersion: LAZER_DATABASE_VERSION
            });
        }

        // populate base client maps
        this.collections.clear();
        this.beatmaps.clear();
        this.beatmapsets.clear();

        await this.process_beatmaps();
        this.initialized = true;

        return true;
    };

    private process_beatmaps = async (): Promise<void> => {
        beatmap_processor.show_on_renderer();

        const processed_rows = beatmap_processor.get_all_beatmaps();
        const processed_map = new Map<string, BeatmapRow>();

        for (const row of processed_rows) {
            processed_map.set(row.md5, row);
        }

        const to_insert: BeatmapRow[] = [];

        const collections = this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection");
        const beatmapsets = this.instance.objects<BeatmapSetSchema>("BeatmapSet");
        const beatmaps = this.instance.objects<BeatmapSchema>("Beatmap");

        const to_process = beatmaps.filter((b) => {
            if (!b.MD5Hash) return false;
            const processed = processed_map.get(b.MD5Hash);
            if (!processed) return true;
            return processed.last_modified != (b.LastLocalUpdate?.toString() ?? "");
        });

        console.log("[lazer] processing", to_process.length, "beatmaps");
        for (let i = 0; i < to_process.length; i++) {
            const beatmap = to_process[i];
            beatmap_processor.update_on_renderer(i, to_process.length);

            if (!beatmap.Hash || !beatmap.MD5Hash) {
                continue;
            }

            const last_modified = beatmap.LastLocalUpdate?.toString() ?? "";
            const cached = processed_map.get(beatmap.MD5Hash);

            if (!cached || cached.last_modified != last_modified) {
                const row = await this.process_single_beatmap(beatmap, last_modified);
                if (row) {
                    to_insert.push(row);
                    processed_map.set(row.md5, row);
                }
            }
        }

        if (to_insert.length > 0) {
            beatmap_processor.insert_beatmaps(to_insert);
        }

        beatmap_processor.hide_on_renderer();

        // populate in-memory map with processed data
        for (const beatmap of beatmaps) {
            if (beatmap.MD5Hash) {
                const processed = processed_map.get(beatmap.MD5Hash);
                this.beatmaps.set(beatmap.MD5Hash, build_beatmap(beatmap, processed));
            }
        }

        // populate in-memory collections
        for (const collection of collections) {
            const name = collection.Name || "";
            this.collections.set(name, {
                name,
                beatmaps: Array.from(collection.BeatmapMD5Hashes),
                last_modified: 0
            });
        }

        // populate in-memory sets
        let fallback_set_id = -1;

        for (const beatmapset of beatmapsets) {
            const mapped = build_beatmapset(beatmapset);
            const preferred_id = mapped.online_id;
            const resolved_id = preferred_id > 0 && !this.beatmapsets.has(preferred_id) ? preferred_id : fallback_set_id--;
            this.beatmapsets.set(resolved_id, { ...mapped, online_id: resolved_id });
        }
    };

    private process_single_beatmap = async (beatmap: BeatmapSchema, last_modified: string): Promise<BeatmapRow | null> => {
        const osu_file = beatmap.BeatmapSet.Files.find((file_usage) => {
            return file_usage.File?.Hash == beatmap.Hash;
        });

        if (!osu_file || !osu_file.File?.Hash) {
            return null;
        }

        try {
            const file_location = get_lazer_file_location(osu_file.File.Hash);

            if (!fs.existsSync(file_location)) {
                console.error("failed to find .osu (not found) for:", beatmap.Hash);
                return null;
            }

            const beatmap_properties = await get_beatmap_properties(file_location);

            const background_location = beatmap_properties.Background
                ? get_lazer_file_location(
                      beatmap.BeatmapSet.Files.find((file_usage) => {
                          return file_usage.Filename == beatmap_properties.Background;
                      })?.File?.Hash ?? ""
                  )
                : "";

            const audio_location = beatmap_properties.AudioFilename
                ? get_lazer_file_location(
                      beatmap.BeatmapSet.Files.find((file_usage) => {
                          return file_usage.Filename == beatmap_properties.AudioFilename;
                      })?.File?.Hash ?? ""
                  )
                : "";
            const audio_duration = get_audio_duration(audio_location);

            return {
                md5: beatmap?.MD5Hash ?? "",
                last_modified,
                background: background_location,
                audio: audio_location,
                video: "",
                duration: audio_duration > 0 ? audio_duration : (beatmap_properties.Duration ?? 0)
            };
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    get_player_name = (): string => {
        return "lazer";
    };

    update_collection = async (): Promise<boolean> => {
        if (!this.instance) {
            return false;
        }

        try {
            this.instance.write(() => {
                const existing = this.instance.objects<BeatmapCollectionSchema>("BeatmapCollection");

                for (const realm_collection of existing) {
                    if (realm_collection.Name && !this.collections.has(realm_collection.Name)) {
                        this.instance.delete(realm_collection);
                    }
                }

                for (const [name, collection] of this.collections) {
                    const realm_collection = existing.filtered(`Name == $0`, name)[0];

                    if (realm_collection) {
                        realm_collection.BeatmapMD5Hashes = collection.beatmaps;
                        realm_collection.LastModified = new Date();
                    } else {
                        this.instance.create<BeatmapCollectionSchema>("BeatmapCollection", {
                            ID: new Realm.BSON.UUID(),
                            Name: name,
                            BeatmapMD5Hashes: collection.beatmaps,
                            LastModified: new Date()
                        });
                    }
                }
            });

            this.reset_collection_modifications();
            this.should_update = false;
            return true;
        } catch (error) {
            console.error("[LazerDriver] update_collection error:", error);
            return false;
        }
    };

    delete_beatmap = async (options: { md5: string; collection?: string }): Promise<boolean> => {
        if (options.collection) {
            return this.remove_beatmap_from_collection(options.collection, options.md5);
        }

        this.pending_deletion.add(options.md5);
        return true;
    };

    get_beatmap_files = async (md5: string): Promise<BeatmapFile[]> => {
        const beatmap = this.instance.objects<BeatmapSchema>("Beatmap").find((b) => b.MD5Hash == md5);

        if (!beatmap) {
            console.warn("get_beatmap_files: failed to get beatmap...");
            return [];
        }

        // get files from beatmapset
        const files: BeatmapFile[] = [];
        const realm_osu_file = beatmap.BeatmapSet.Files.find((f) => f.File?.Hash === beatmap.Hash);

        if (!realm_osu_file) {
            console.error("failed to find .osu for:", beatmap.Hash);
            return [];
        }

        const file_location = get_lazer_file_location(realm_osu_file.File?.Hash as string);

        if (!fs.existsSync(file_location)) {
            console.error("failed to find .osu (not found) for:", beatmap.Hash);
            return [];
        }

        const properties = await get_beatmap_properties(file_location);

        files.push({ name: realm_osu_file.Filename as string, location: file_location });

        // get the other files
        let found_background = false,
            found_audio = false;

        for (const realm_file of beatmap.BeatmapSet.Files) {
            const filename = realm_file.Filename;
            const hash = realm_file.File?.Hash as string;

            if (found_background && found_audio) break;

            if (filename && !found_background && properties.Background == filename) {
                const location = get_lazer_file_location(hash);

                if (!fs.existsSync(location)) {
                    console.warn("background file doenst exists...");
                } else {
                    files.push({ name: filename, location });
                }

                found_background = true;
            }

            if (filename && !found_audio && properties.AudioFilename == filename) {
                const location = get_lazer_file_location(hash);

                if (!fs.existsSync(location)) {
                    console.warn("audio file doenst exists...");
                } else {
                    files.push({ name: filename, location });
                }

                found_audio = true;
            }
        }

        return files;
    };

    get_beatmapset_files = async (id: number): Promise<BeatmapFile[]> => {
        const files: BeatmapFile[] = [];
        const beatmapset = this.instance.objects<BeatmapSetSchema>("BeatmapSet").find((b) => b.OnlineID == id);

        if (!beatmapset) {
            return files;
        }

        for (const file of beatmapset.Files) {
            if (!file.File || !file.Filename || !file.File.Hash) {
                console.warn("skipping invalid file:", file);
                continue;
            }

            files.push({
                name: file.Filename,
                location: get_lazer_file_location(file.File.Hash)
            });
        }

        return files;
    };

    dispose = async (): Promise<void> => {
        this.instance.close();
    };
}

export const lazer_client = new LazerBeatmapClient();
