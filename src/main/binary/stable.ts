import { get_common_bpm } from "../beatmaps/beatmaps.js";
import { BinaryReader } from "./binary.js";
import { config } from "../database/config.js";
import { GenericResult } from "@shared/types/basic.js";
import {
    ILegacyDatabase,
    IStableBeatmap,
    IStableTimingPoint,
    LEGACY_DATABASE_VERSION,
    ICollectionResult,
    IStableBeatmapset,
    WriteCollectionParams
} from "@shared/types.js";

import path from "path";
import fs from "fs";

export class StableParser extends BinaryReader {
    constructor() {
        super();
    }

    cleanup(): void {
        if (this.buffer) this.buffer.fill(0);
        this.offset = 0;
    }

    get_osu_data = (location: string): GenericResult<ILegacyDatabase> => {
        // remove cached stuff on new buffer
        this.cleanup();

        if (!fs.existsSync(location)) {
            return { success: false, reason: `file not found at ${location}` };
        }

        const buffer = fs.readFileSync(location);
        this.set_buffer(buffer);

        const beatmaps = new Map();
        const beatmapsets: Map<number, IStableBeatmapset> = new Map();

        const version = this.int();
        const folders = this.int();
        const account_unlocked = this.bool();
        const last_unlocked_time = this.long();
        const player_name = this.string();
        const beatmaps_count = this.int();

        for (let i = 0; i < beatmaps_count; i++) {
            const beatmap = this.read_beatmap(version);

            // create new beatmapset
            // otherwise add the new difficulty to the set
            if (!beatmapsets.has(beatmap.beatmapset_id)) {
                const beatmapset: IStableBeatmapset = {
                    title: beatmap.title,
                    artist: beatmap.artist,
                    creator: beatmap.creator,
                    online_id: beatmap.beatmapset_id,
                    beatmaps: new Set([beatmap.md5])
                };

                beatmapsets.set(beatmap.beatmapset_id, beatmapset);
            } else {
                const beatmapset = beatmapsets.get(beatmap.beatmapset_id);

                if (beatmapset) {
                    beatmapset.beatmaps.add(beatmap.md5);
                }
            }

            // add to beatmaps
            beatmaps.set(beatmap.md5, beatmap);
        }

        // ignore: permission
        this.int();

        const db: ILegacyDatabase = {
            version,
            folders,
            account_unlocked,
            last_unlocked_time,
            player_name,
            beatmaps_count,
            beatmaps,
            beatmapsets
        };

        return { success: true, data: db };
    };

    get_beatmap_status = () => {};

    read_beatmap = (version: number): IStableBeatmap => {
        const data = {} as IStableBeatmap;
        const is_old_version = version < 20140609;

        data.entry = version < 20191106 ? this.int() : 0;
        data.artist = this.string();
        data.artist_unicode = this.string();
        data.title = this.string();
        data.title_unicode = this.string();
        data.creator = this.string();
        data.difficulty = this.string();
        data.audio_file_name = this.string();
        data.md5 = this.string();
        data.file = this.string();
        data.status = this.byte();
        data.hitcircle = this.short();
        data.sliders = this.short();
        data.spinners = this.short();
        data.last_modification = this.long();

        data.ar = is_old_version ? this.byte() : this.single();
        data.cs = is_old_version ? this.byte() : this.single();
        data.hp = is_old_version ? this.byte() : this.single();
        data.od = is_old_version ? this.byte() : this.single();

        data.slider_velocity = this.double();

        const is_new_version = version >= 20250107;
        const star_rating: number[] = [];

        // loop through each ruleset
        for (let i = 0; i < 4; i++) {
            const length = this.int();

            this.byte(); // skip
            this.int(); // mod
            this.byte(); // skip

            // NOTE: theres no reason to store the actual sr pair (for each mod comb)
            // so star_rating is nomod only
            const diff = is_new_version ? this.single() : this.double();
            star_rating.push(diff);

            // since we dont need the rest
            // skip remaining bytes
            const skip_bytes = is_new_version ? 10 : 14;
            this.offset += skip_bytes * (length - 1);
        }

        data.star_rating = star_rating;
        data.drain_time = this.int();
        data.length = this.int();
        data.audio_preview = this.int();

        // get timing points
        const timing_points_length = this.int();
        const timing_points: IStableTimingPoint[] = [];

        for (let i = 0; i < timing_points_length; i++) {
            timing_points[i] = {
                beat_length: this.double(),
                offset: this.double(),
                inherited: this.bool()
            };
        }

        data.bpm = get_common_bpm(timing_points, data.length);

        // read rest of the metadata
        data.difficulty_id = this.int();
        data.beatmapset_id = this.int();
        data.thread_id = this.int();
        data.grade_standard = this.byte();
        data.grade_taiko = this.byte();
        data.grade_ctb = this.byte();
        data.grade_mania = this.byte();
        data.local_offset = this.short();
        data.stack_leniency = this.single();
        data.mode = this.byte();
        data.source = this.string();
        data.tags = this.string();
        data.online_offset = this.short();
        data.font = this.string();
        data.unplayed = this.bool();
        data.last_played = this.long();
        data.is_osz2 = this.bool();
        data.folder_name = this.string();
        data.last_checked = this.long();
        data.ignore_sounds = this.bool();
        data.ignore_skin = this.bool();
        data.disable_storyboard = this.bool();
        data.disable_video = this.bool();
        data.visual_override = this.bool();

        if (version < 20140609) {
            data.unknown = this.short();
        }

        // skip: last_modification
        this.skip(4);

        data.mania_scroll_speed = this.byte();
        data.temp = false;

        // unique audio id
        data.unique_id = `${data.beatmapset_id}_${data.audio_file_name}`;

        // extra stuff
        data.audio_path = path.join(data.folder_name, data.audio_file_name);
        data.file_path = path.join(data.folder_name, data.file);
        data.image_path = ""; // processor will handle ts

        return data;
    };

    get_collections_data = (location: string): GenericResult<Map<string, ICollectionResult>> => {
        if (!fs.existsSync(location)) {
            return { success: false, reason: `collections file not found at ${location}` };
        }

        const buffer = fs.readFileSync(location);

        this.cleanup();
        this.set_buffer(buffer);

        const collections: Map<string, ICollectionResult> = new Map();
        this.int(); // version
        const count = this.int();

        for (let i = 0; i < count; i++) {
            const name = this.string();
            const bm_count = this.int();
            const checksums: string[] = [];

            for (let j = 0; j < bm_count; j++) {
                checksums.push(this.string());
            }

            const collection: ICollectionResult = {
                name: name,
                beatmaps: checksums
            };

            collections.set(name, collection);
        }

        return { success: true, data: collections };
    };

    create_collection_backup = () => {
        const old_collection_path = path.resolve(config.get().stable_path, "collection.db");
        const new_collection_path = path.resolve(config.get().stable_path, `collection_${Date.now()}.db`);

        if (!fs.existsSync(old_collection_path)) {
            console.log("failed to get old colletion file");
            return;
        }

        fs.renameSync(old_collection_path, new_collection_path);
    };

    write_collections_data = (collections: ICollectionResult[]): GenericResult<Buffer> => {
        const buffer: Buffer<ArrayBuffer>[] = [];

        buffer.push(this.writeInt(LEGACY_DATABASE_VERSION));
        buffer.push(this.writeInt(collections.length));

        for (const collection of collections) {
            const name = collection.name;

            buffer.push(this.writeString(name));
            buffer.push(this.writeInt(collection.beatmaps.length));

            for (const map of collection.beatmaps) {
                if (!map) {
                    return { success: false, reason: `one of the hashes from ${name} is invalid` };
                }

                buffer.push(this.writeString(map));
            }
        }

        return { success: true, data: this.join_buffer(buffer) };
    };

    update_collections_data = (collections: ICollectionResult[]): GenericResult<string> => {
        const write_result = this.write_collections_data(collections);

        if (!write_result.success) {
            return { success: false, reason: "failed to write collection data..." };
        }

        const buffer = write_result.data;
        const collection_path = path.resolve(config.get().stable_path, "collection.db");

        // create a backup and save the new file (no undo)
        this.create_collection_backup();
        fs.writeFileSync(collection_path, buffer);

        return { success: true, data: ":)" };
    };

    get_beatmap_section = (beatmap: IStableBeatmap, section: string) => {
        try {
            const file_path = this.get_file_location(beatmap);

            if (!file_path || !fs.existsSync(file_path)) {
                return null;
            }

            const content = fs.readFileSync(file_path, "utf-8");

            if (!content) {
                return null;
            }

            return this.parse_osu_section(content, section);
        } catch (err) {
            console.log(`[reader] get_beatmap_section error for ${section}:`, err);
            return null;
        }
    };

    parse_osu_section = (content: string, section: string) => {
        const section_start = content.indexOf(`[${section}]`);

        if (section_start == -1) {
            return null;
        }

        const content_start = section_start + section.length + 2;
        const next_section = content.indexOf("[", content_start);
        const section_content = content.substring(content_start, next_section != -1 ? next_section : undefined);

        if (this.is_key_value_section(section)) {
            return this.parse_key_value_section(section_content);
        }

        return this.parse_section(section_content);
    };

    is_key_value_section = (section: string) => {
        const KEY_VALUE_SECTIONS = ["General", "Editor", "Metadata", "Difficulty"];
        return KEY_VALUE_SECTIONS.includes(section);
    };

    parse_key_value_section = (section_content: string) => {
        const result = {};
        const lines = section_content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith("//")) {
                continue;
            }

            const colon_index = trimmed.indexOf(":");

            if (colon_index == -1) {
                continue;
            }

            const key = trimmed.substring(0, colon_index).trim();
            const value = trimmed.substring(colon_index + 1).trim();

            // @ts-ignore
            result[key] = value;
        }

        return result;
    };

    parse_section = (section_content: string) => {
        const lines = section_content.split("\n");
        const result: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith("//")) {
                continue;
            }

            result.push(trimmed);
        }

        return result;
    };

    get_file_location = (beatmap: IStableBeatmap) => {
        return path.resolve(config.get().stable_songs_path, beatmap.file_path);
    };

    get_section_data = (beatmap: IStableBeatmap, section: string) => {
        return this.get_beatmap_section(beatmap, section);
    };
}

export const stable_parser = new StableParser();

export const read_legacy_db = (location: string): GenericResult<ILegacyDatabase> => {
    return stable_parser.get_osu_data(location);
};

export const read_legacy_collection = (location: string): GenericResult<Map<string, ICollectionResult>> => {
    return stable_parser.get_collections_data(location);
};

export const write_legacy_collection = (params: WriteCollectionParams): GenericResult<string> => {
    const result = stable_parser.write_collections_data(params.data);

    if (!result.success) {
        return { success: false, reason: result.reason };
    }

    fs.writeFileSync(params.location, result.data);

    return { success: true, data: params.location };
};
