import { osdb_versions } from "./models/stable.js";
import { get_common_bpm } from "../beatmaps/beatmaps.js";
import { get_realm_instance, lazer_to_osu_db, update_collection } from "./realm.js";
import { BinaryReader } from "./binary.js";
import { config } from "../database/config.js";
import { ALL_SCHEMAS } from "./models/lazer.js";

import path from "path";
import fs from "fs";
import zlib from "zlib";

export const stable_beatmap_status = {
    [-1]: "all",
    [0]: "unknown",
    [1]: "unsubmitted",
    [2]: "pending",
    [3]: "unused",
    [4]: "ranked",
    [5]: "approved",
    [6]: "qualified",
    [7]: "loved"
};

export class Reader extends BinaryReader {
    constructor() {
        super();
        this.offset = 0;
        this.pending_deletion = new Set();
        this.image_cache = new Map();
        this.audio_cache = new Map();
        this.beatmap_offset_start = 0;
        this.instance = null;
    }

    cleanup() {
        this.buffer = null;
        this.offset = 0;
        if (global.gc) {
            global.gc();
        }
    }

    get_instance = async (path, schemas) => {
        if (this.instance) return;
        this.instance = get_realm_instance(path, schemas);
    };

    get_osdb_data = async (location) => {
        const buffer = fs.readFileSync(location);

        if (buffer.byteLength == 0) {
            console.log("[osdb] invalid buffer");
            return false;
        }

        this.set_buffer(buffer);

        try {
            const data = {};
            const version_string = this.string2();
            const version = osdb_versions[version_string];

            if (!version) {
                throw new Error(`[osdb] invalid version (got: ${version_string})`);
            }

            const is_minimal = version_string.endsWith("min");

            if (version >= 7) {
                const compressed_data = this.buffer.subarray(this.offset);
                const decompressed_data = zlib.gunzipSync(compressed_data);

                this.set_buffer(decompressed_data);
                this.string2();
            }

            data.save_date = this.long();
            data.last_editor = this.string2();
            data.collections_count = this.int();
            data.collections = [];

            for (let i = 0; i < data.collections_count; i++) {
                const collection = {
                    name: this.string2(),
                    beatmaps: [],
                    hash_only_beatmaps: []
                };

                if (version >= 7) {
                    collection.online_id = this.int();
                }

                const beatmaps_count = this.int();

                for (let j = 0; j < beatmaps_count; j++) {
                    const beatmap = {
                        difficulty_id: this.int(),
                        beatmapset_id: version >= 2 ? this.int() : -1
                    };

                    if (!is_minimal) {
                        beatmap.artist = this.string2();
                        beatmap.title = this.string2();
                        beatmap.diff_name = this.string2();
                    }

                    beatmap.md5 = this.string2();

                    if (version >= 4) {
                        beatmap.user_comment = this.string2();
                    }

                    if (version >= 8 || (version >= 5 && !is_minimal)) {
                        beatmap.mode = this.byte();
                    }

                    if (version >= 8 || (version >= 6 && !is_minimal)) {
                        beatmap.difficulty_rating = this.double();
                    }

                    collection.beatmaps.push(beatmap);
                }

                if (version >= 3) {
                    const hash_count = this.int();
                    for (let j = 0; j < hash_count; j++) {
                        collection.hash_only_beatmaps.push(this.string2());
                    }
                }

                data.collections.push(collection);
            }

            const footer = this.string2();

            if (footer != "By Piotrekol") {
                throw new Error("[osdb] invalid file footer, this collection might be corrupted.");
            }

            return data;
        } catch (error) {
            console.log(error);
            return false;
        } finally {
            this.cleanup();
        }
    };

    write_osdb_data = (data, version_string) => {
        const result = { success: false, reason: "", buffer: null };

        try {
            if (!data || !data.collections) {
                result.reason = "invalid data structure";
                return reason;
            }

            const version = osdb_versions[version_string];

            if (!version) {
                result.reason = `[osdb] invalid osdb version: ${version_string}`;
                return result;
            }

            const is_minimal = version_string.endsWith("min");
            const buffers = [];
            const buffer = [];

            buffers.push(this.writeString2(version_string));

            if (version >= 7) {
                buffer.push(this.writeString2(version_string));
            }

            buffer.push(this.writeLong(data.save_date ?? new Date().getTime()));
            buffer.push(this.writeString2(data.last_editor ?? ""));
            buffer.push(this.writeInt(data.collections.length));

            for (let i = 0; i < data.collections.length; i++) {
                const collection = data.collections[i];

                buffer.push(this.writeString2(collection.name || ""));

                if (version >= 7) {
                    buffer.push(this.writeInt(collection.online_id || 0));
                }

                buffer.push(this.writeInt(collection.beatmaps.length || 0));

                for (let i = 0; i < collection.beatmaps.length; i++) {
                    const beatmap = collection.beatmaps[i];

                    buffer.push(this.writeInt(beatmap.difficulty_id || 0));

                    if (version >= 2) {
                        buffer.push(this.writeInt(beatmap.beatmapset_id || -1));
                    }

                    if (!is_minimal) {
                        buffer.push(this.writeString2(beatmap.artist || ""));
                        buffer.push(this.writeString2(beatmap.title || ""));
                        buffer.push(this.writeString2(beatmap.diff_name || ""));
                    }

                    buffer.push(this.writeString2(beatmap.md5 || ""));

                    if (version >= 4) {
                        buffer.push(this.writeString2(beatmap?.user_comment || ""));
                    }

                    if (version >= 8 || (version >= 5 && !is_minimal)) {
                        buffer.push(this.writeByte(beatmap?.mode || 0));
                    }

                    if (version >= 8 || (version >= 6 && !is_minimal)) {
                        buffer.push(this.writeDouble(beatmap?.difficulty_rating || 0.0));
                    }
                }

                if (version >= 3) {
                    const all_hashes = collection.hash_only_beatmaps;
                    buffer.push(this.writeInt(all_hashes.length));

                    for (let i = 0; i < all_hashes.length; i++) {
                        const hash = all_hashes[i];
                        buffer.push(this.writeString2(hash || ""));
                    }
                }
            }

            buffer.push(this.writeString2("By Piotrekol"));
            const content_buffer = this.join_buffer(buffer);

            if (version >= 7) {
                buffers.push(new Uint8Array(zlib.gzipSync(content_buffer)));
            } else {
                buffers.push(content_buffer);
            }

            result.success = true;
            result.buffer = this.join_buffer(buffers);

            return result;
        } catch (error) {
            result.reason = error;
            return result;
        }
    };

    get_osu_data = async (file_path) => {
        if (config.lazer_mode) {
            console.log("[reader] reading lazer data...");
            try {
                await this.get_instance(file_path, ALL_SCHEMAS);
                return lazer_to_osu_db(this.instance);
            } catch (err) {
                this.instance = null;
                console.log(err);
                return null;
            }
        }

        this.cleanup();

        if (!fs.existsSync(file_path)) {
            console.log(`[reader] file not found: ${file_path}`);
            return null;
        }

        const buffer = fs.readFileSync(file_path);
        this.set_buffer(buffer);

        console.log("[reader] reading osu! stable data...");

        const beatmaps = new Map();

        const version = this.int();
        const folders = this.int();
        const account_unlocked = this.bool();
        const last_unlocked_time = this.long();
        const player_name = this.string();
        const beatmaps_count = this.int();

        this.beatmap_offset_start = this.offset;

        for (let i = 0; i < beatmaps_count; i++) {
            const beatmap = this.read_beatmap(version);
            if (beatmap.md5) {
                beatmaps.set(beatmap.md5, beatmap);
            }
        }

        const extra_start = this.offset;
        const permission_id = this.int();

        this.cleanup();

        return {
            version,
            folders,
            account_unlocked,
            last_unlocked_time,
            player_name,
            beatmaps_count,
            beatmaps,
            extra_start,
            permission_id,
            file_path
        };
    };

    get_beatmap_status = () => {};

    read_beatmap = (version) => {
        const data = { star_rating: [] };
        const is_old_version = version < 20140609;

        data.beatmap_start = this.offset;
        data.entry = version < 20191106 ? this.int() : 0;
        data.artist = this.string();
        data.artist_unicode = this.string();
        data.title = this.string();
        data.title_unicode = this.string();
        data.mapper = this.string();
        data.difficulty = this.string();
        data.audio_file_name = this.string();
        data.md5 = this.string();
        data.file = this.string();
        data.status = this.byte();
        data.status_text = stable_beatmap_status[data.status];
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

        for (let i = 0; i < 4; i++) {
            const length = this.int();

            this.byte(); // skip
            const mod = this.int();
            this.byte(); // skip
            const diff = is_new_version ? this.single() : this.double();
            // update gamemode srp air
            data.star_rating[i] = {
                nm: Number(diff).toFixed(2),
                pair: [mod, diff]
            };
            // skip remaining bytes
            const skip_bytes = is_new_version ? 10 : 14;
            this.offset += skip_bytes * (length - 1);
        }

        data.drain_time = this.int();
        data.length = this.int();
        data.audio_preview = this.int();

        // get timing points
        const timing_points_length = this.int();
        data.timing_points_length = timing_points_length;
        data.timing_points = new Array(timing_points_length);

        for (let i = 0; i < timing_points_length; i++) {
            data.timing_points[i] = {
                beat_length: this.double(),
                offset: this.double(),
                inherited: this.bool()
            };
        }

        data.bpm = get_common_bpm(data);

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

        // no idea what this last_modification is
        this.skip(4);

        data.mania_scroll_speed = this.byte();
        data.beatmap_end = this.offset;
        data.local = true;
        data.downloaded = true;

        // unique audio id
        data.unique_id = `${data.beatmapset_id}_${data.audio_file_name}`;
        data.file_path = `${data.folder_name}/${data.file}`;
        data.duration = 0;
        data.image_path = "";
        data.audio_path = "";

        return data;
    };

    get_collections_data = async (file_path) => {
        if (config.lazer_mode) {
            try {
                await this.get_instance(file_path, ALL_SCHEMAS);

                const lazer_data = this.instance.objects("BeatmapCollection");
                const data = { collections: new Map() };

                for (let i = 0; i < lazer_data.length; i++) {
                    const collection = lazer_data[i];
                    data.collections.set(collection.Name, {
                        uuid: collection.ID.toString(),
                        name: collection.Name,
                        maps: Array.from(collection.BeatmapMD5Hashes)
                    });
                }

                return data;
            } catch (e) {
                this.instance = null;
                console.error(e);
                return false;
            }
        }

        if (!fs.existsSync(file_path)) {
            console.log(`[reader] collections file not found: ${file_path}`);
            return false;
        }

        const buffer = fs.readFileSync(file_path);

        this.cleanup();
        this.set_buffer(buffer);

        const collections = new Map();
        const version = this.int();
        const count = this.int();

        for (let i = 0; i < count; i++) {
            const name = this.string();
            const bm_count = this.int();
            const md5 = [];

            for (let j = 0; j < bm_count; j++) {
                md5.push(this.string());
            }

            collections.set(name, {
                name: name,
                maps: md5
            });
        }

        this.cleanup();

        return { version, length: count, collections };
    };

    create_collection_backup = () => {
        const old_collection_path = path.resolve(config.stable_path, "collection.db");
        const new_collection_path = path.resolve(config.stable_path, `collection_${Date.now()}.db`);

        if (!fs.existsSync(old_collection_path)) {
            console.log("failed to get old colletion file");
            return;
        }

        fs.renameSync(old_collection_path, new_collection_path);
    };

    write_collections_data = (data) => {
        const result = { success: false, reason: "", buffer: null };
        const buffer = [];

        buffer.push(this.writeInt(data.version));
        buffer.push(this.writeInt(data.collections.length));

        for (const collection of data.collections) {
            const name = collection.name;

            buffer.push(this.writeString(name));
            buffer.push(this.writeInt(collection.maps.length));

            for (const map of collection.maps) {
                if (!map) {
                    result.reason = `one of the hashes from ${name} is invalid`;
                    return result;
                }
                buffer.push(this.writeString(map));
            }
        }

        result.success = true;
        result.buffer = this.join_buffer(buffer);

        return result;
    };

    update_collections_data = async (data) => {
        const result = { success: false, reason: "" };

        if (config.lazer_mode) {
            if (!this.instance) {
                result.reason = "failed to get realm instance";
                return result;
            }

            update_collection(this.instance, data.collections);
            result.success = true;
            return result;
        }

        const { success, buffer, reason } = this.write_collections_data();

        if (!success) {
            result.reason = reason;
            return result;
        }

        const collection_path = path.resolve(config.stable_path, "collection.db");

        // create a backup and save the new file (no undo)
        this.create_collection_backup();
        fs.writeFileSync(collection_path, buffer);

        result.success = true;
        return result;
    };

    get_beatmap_section = (beatmap, section_name) => {
        try {
            const file_path = this.get_file_location(beatmap);

            if (!file_path || !fs.existsSync(file_path)) {
                return null;
            }

            const content = fs.readFileSync(file_path, "utf-8");

            if (!content) {
                return null;
            }

            return this.parse_osu_section(content, section_name);
        } catch (err) {
            console.log(`[reader] get_beatmap_section error for ${section_name}:`, err);
            return null;
        }
    };

    parse_osu_section = (content, section_name) => {
        const section_start = content.indexOf(`[${section_name}]`);
        if (section_start == -1) {
            return null;
        }

        const content_start = section_start + section_name.length + 2;
        const next_section = content.indexOf("[", content_start);
        const section_content = content.substring(content_start, next_section != -1 ? next_section : undefined);

        if (this.is_key_value_section(section_name)) {
            return this.parse_key_value_section(section_content);
        }

        return this.parse_section(section_content);
    };

    is_key_value_section = (section_name) => {
        const KEY_VALUE_SECTIONS = ["General", "Editor", "Metadata", "Difficulty"];
        return KEY_VALUE_SECTIONS.includes(section_name);
    };

    parse_key_value_section = (section_content) => {
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
            result[key] = value;
        }

        return result;
    };

    parse_section = (section_content) => {
        const lines = section_content.split("\n");
        const result = [];

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

    get_file_location = (beatmap) => {
        const songs_path = config.lazer_mode ? path.resolve(config.lazer_path, "files") : config.stable_songs_path;
        return path.resolve(songs_path, beatmap.file_path);
    };

    get_section_data = (beatmap, section) => {
        return this.get_beatmap_section(beatmap, section);
    };
}

export const reader = new Reader();
