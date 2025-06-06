import { core } from "../../manager/manager.js";
import {
    osu_db,
    collections_db,
    osdb_schema,
    osdb_versions,
    beatmaps_schema,
    beatmap_status_reversed,
    lazer_status_reversed,
    beatmap_status,
    lazer_status,
} from "./models/stable.js";
import { fs, zlib, path } from "../global.js";
import { create_alert } from "../../popup/popup.js";
import {
    get_beatmap_bpm,
    get_beatmap_sr,
} from "../../manager/tools/beatmaps.js";
import { get_realm_instance, lazer_to_osu_db } from "./lazer.js";
import { is_lazer_mode } from "../config.js";
import { BinaryReader } from "./binary.js";

export class Reader extends BinaryReader {
    /** @type {collections_db} */
    collections;
    /** @type {osu_db} */
    osu;
    /** @type {Map} */
    image_cache;

    instance;

    constructor() {
        super();
        this.osu = new Map();
        this.pending_deletion = new Set();
        this.offset = 0;
        this.image_cache = new Map();
        this.beatmap_offset_start = 0;
    }

    create_instance = async (path, schemas) => {
        if (this.instance) {
            return;
        }

        this.instance = await get_realm_instance(path, schemas);
    };

    write_osu_data = (maps, p) => {
        return new Promise(async (res, rej) => {
            if (this.buffer?.byteLength == 0) {
                return rej(
                    new Error(
                        "invalid buffer. call set_buffer before write_osu_data.",
                    ),
                );
            }

            const buffer = [];

            buffer.push(this.writeInt(this.osu.version));
            buffer.push(this.writeInt(this.osu.folders));
            buffer.push(this.writeBool(this.osu.account_unlocked));
            buffer.push(this.writeLong(this.osu.last_unlocked_time));
            buffer.push(this.writeString(this.osu.player_name));
            buffer.push(this.writeInt(this.osu.beatmaps_count));

            let last_index = this.beatmap_offset_start;

            // sort to make end as last_index
            maps = maps.sort((a, b) => a.beatmap_start - b.beatmap_start);

            for (let i = 0; i < maps.length; i++) {
                // if the map object is invalid ignore it
                if (!maps[i].beatmap_start || !maps[i].beatmap_end) {
                    create_alert("failed to recreate osu!.db", {
                        type: "error",
                    });
                    return;
                }

                if (last_index < maps[i].beatmap_start) {
                    const bf = new Uint8Array(
                        this.buffer.slice(last_index, maps[i].beatmap_start),
                    );
                    buffer.push(bf);
                }

                last_index = maps[i].beatmap_end;
            }

            if (last_index < this.buffer.byteLength) {
                buffer.push(new Uint8Array(this.buffer.slice(last_index)));
            }

            fs.save_osu_file(this.join_buffer(buffer));
            res();
        });
    };

    write_stable_collection = () => {
        if (!this.collections) {
            console.log("[reader] no collections found");
            return;
        }

        const buffer = [];

        buffer.push(this.writeInt(this.collections.version));
        buffer.push(this.writeInt(this.collections.beatmaps.size));

        for (const [name, collection] of this.collections.beatmaps) {
            buffer.push(this.writeString(name));
            buffer.push(this.writeInt(collection.maps.size));

            for (const map of collection.maps) {
                if (!map) {
                    console.log(
                        "[reader] failed to get beatmap from collection!",
                    );
                    return;
                }

                buffer.push(this.writeString(map));
            }
        }

        return this.join_buffer(buffer);
    };

    write_collections_data = (_path) => {
        return new Promise(async (resolve, reject) => {
            const lazer_mode = is_lazer_mode();

            if (lazer_mode) {
                if (!this.instance) {
                    console.log(
                        "[reader] failed to get instance (cant write collection)",
                        this.instance,
                    );
                    return;
                }

                try {
                    // delete pending collections
                    for (const pending of this.pending_deletion) {
                        await window.realmjs.delete_collection(
                            this.instance,
                            pending.uuid,
                        );
                        this.pending_deletion.delete(pending);
                    }

                    // update/create the rest
                    // @NOTE: sometimes for some reason this fail saying the subject is null
                    // it only gave that error 1 time i cant seem to reproduce...
                    for (const [name, data] of Array.from(
                        this.collections.beatmaps,
                    )) {
                        const result = await window.realmjs.update_collection(
                            this.instance,
                            data.uuid,
                            name,
                            data.maps,
                        );

                        // true == new one
                        if (result.new) {
                            this.collections.beatmaps.get(name).uuid =
                                result.id;
                        }
                    }

                    return resolve();
                } catch (err) {
                    create_alert(
                        "failed to save collection, check logs for more info",
                        { type: "error" },
                    );
                    console.log("[reader] error while saving", err);
                    return reject(err);
                }
            }

            const buffers = this.write_stable_collection();
            fs.save_collection_file(buffers, _path);
            resolve();
        });
    };

    // update collections with extra information like bpm, etc...
    update_collections() {
        if (this.collections.beatmaps.size == 0) {
            console.log(
                "[reader] cant update collection cuz no beatmaps found",
            );
            return;
        }

        for (const [name] of this.collections.beatmaps) {
            this.update_collection(name);
        }
    }

    update_collection(name) {
        if (!this.collections.beatmaps.has(name)) {
            console.log("[reader] collection not found");
            return;
        }

        const collection = this.collections.beatmaps.get(name);

        collection.bpm_max = 0;
        collection.sr_max = 0;

        for (const md5 of collection.maps) {
            const map = this.osu.beatmaps.get(md5);

            if (!map) {
                continue;
            }

            const sr = map?.star || Number(get_beatmap_sr(map));
            const bpm = map?.bpm || Number(get_beatmap_bpm(map));

            // save to make sure
            if (!map?.bpm) {
                map.bpm = bpm;
            }

            if (!map?.star) {
                map.star = sr;
            }

            if (sr > collection.sr_max) collection.sr_max = sr;
            if (bpm > collection.bpm_max) collection.bpm_max = bpm;
        }

        // update the collection with extra info
        this.collections.beatmaps.set(name, collection);
    }

    /**
     *
     * @returns { Promise<osdb_schema> }
     * @link https://github.com/Piotrekol/CollectionManager/blob/master/CollectionManagerDll/Modules/FileIO/FileCollections/OsdbCollectionHandler.cs
     *
     */
    async get_osdb_data(buffer) {
        return new Promise(async (resolve, reject) => {
            if (buffer) {
                this.set_buffer(buffer);
            }

            if (this.buffer.byteLength == 0) {
                return reject(new Error("invalid buffer"));
            }

            try {
                const data = {};
                const version_string = this.string2();
                const version = osdb_versions[version_string];

                if (!version) {
                    throw new Error(
                        `invalid osdb version (got: ${version_string})`,
                    );
                }

                const is_minimal = version_string.endsWith("min");

                if (version >= 7) {
                    const compressed_data = this.buffer.buffer.slice(
                        this.offset,
                    );
                    const decompressed_data = zlib.gunzipSync(compressed_data);

                    this.set_buffer(decompressed_data);
                    this.offset = 0;

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
                        hash_only_beatmaps: [],
                    };

                    if (version >= 7) {
                        collection.online_id = this.int();
                    }

                    const beatmaps_count = this.int();

                    for (let j = 0; j < beatmaps_count; j++) {
                        const beatmap = {
                            map_id: this.int(),
                            map_set_id: version >= 2 ? this.int() : -1,
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
                            beatmap.play_mode = this.byte();
                        }

                        if (version >= 8 || (version >= 6 && !is_minimal)) {
                            beatmap.stars_nomod = this.double();
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
                    throw new Error(
                        "invalid file footer, this collection might be corrupted.",
                    );
                }

                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    }

    async write_osdb_data(data, version_string) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!data || !data.collections) {
                    return reject(new Error("[osdb] invalid data structure"));
                }

                const version = osdb_versions[version_string];

                if (!version) {
                    throw new Error(
                        `[osdb] invalid osdb version: ${version_string}`,
                    );
                }

                const is_minimal = version_string.endsWith("min");

                const buffers = [];
                const buffer = [];

                buffers.push(this.writeString2(version_string));

                if (version >= 7) {
                    buffer.push(this.writeString2(version_string));
                }

                buffer.push(
                    this.writeLong(data.save_date || new Date().getTime()),
                );
                buffer.push(this.writeString2(data.last_editor || ""));
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

                        buffer.push(this.writeInt(beatmap.map_id || 0));

                        if (version >= 2) {
                            buffer.push(
                                this.writeInt(beatmap.map_set_id || -1),
                            );
                        }

                        if (!is_minimal) {
                            buffer.push(
                                this.writeString2(beatmap.artist || ""),
                            );
                            buffer.push(this.writeString2(beatmap.title || ""));
                            buffer.push(
                                this.writeString2(beatmap.diff_name || ""),
                            );
                        }

                        buffer.push(this.writeString2(beatmap.md5 || ""));

                        if (version >= 4) {
                            buffer.push(
                                this.writeString2(beatmap?.user_comment || ""),
                            );
                        }

                        if (version >= 8 || (version >= 5 && !is_minimal)) {
                            buffer.push(
                                this.writeByte(beatmap?.play_mode || 0),
                            );
                        }

                        if (version >= 8 || (version >= 6 && !is_minimal)) {
                            buffer.push(
                                this.writeDouble(beatmap?.stars_nomod || 0.0),
                            );
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

                const final_buffer = this.join_buffer(buffers);
                resolve(final_buffer);
            } catch (error) {
                reject(error);
            }
        });
    }

    read_typed_value() {
        const type = this.byte();

        switch (type) {
            case 1:
                return this.bool();
            case 2:
                return this.byte();
            case 3:
                return this.short();
            case 4:
                return this.int();
            case 5:
                return this.long();
            case 6:
                return this.byte(true);
            case 7:
                return this.short(true);
            case 8:
                return this.int(true);
            case 9:
                return this.long(true);
            case 10:
                return String.fromCharCode(this.short());
            case 11:
                return this.string();
            case 12:
                return this.single();
            case 13:
                return this.double();
            case 14:
                return this.double();
            case 15:
                return this.long(true);
            case 16: {
                const num = this.int() - 4294967296;
                return num > 0 ? this.byte() : 0;
            }
            case 17: {
                const length = this.int(true);
                if (length > 0) {
                    const chars = new Array(length);
                    for (let i = 0; i < length; i++) {
                        chars[i] = this.byte();
                    }
                    return String.fromCharCode(...chars);
                }
                return "";
            }
            default:
                throw new Error(`unknown type: ${type}`);
        }
    }

    /**
     *
     * @returns { Promise<osu_db> }
     *
     */
    get_osu_data = (buffer) => {
        return new Promise(async (resolve, reject) => {
            if (this.osu.beatmaps?.size) {
                resolve(this.osu);
                return;
            }

            // @TODO: implement a way to use both stable and lazer data at the same time
            const lazer_mode = is_lazer_mode();

            if (lazer_mode) {
                console.log("[reader] reading lazer data...");

                try {
                    // get instance
                    await this.create_instance(
                        path.resolve(
                            core.config.get("lazer_path"),
                            "client.realm",
                        ),
                        ["All"],
                    );

                    // convert lazer data to match current osu! stable obj
                    this.osu = lazer_to_osu_db(this.instance);

                    return resolve();
                } catch (err) {
                    this.instance = null;
                    create_alert(
                        "[reader] failed to read lazer db file\ncheck logs for more info",
                        { type: "error" },
                    );
                    console.log(err);
                    return reject(err);
                }
            }

            this.set_buffer(buffer);
            this.offset = 0;

            console.log("[reader] reading osu! stable data...");

            const beatmaps = new Map();
            const version = this.int();
            const folders = this.int();
            const account_unlocked = this.bool();

            const last_unlocked_time = this.long();

            const player_name = this.string();
            const beatmaps_count = this.int();

            this.beatmap_offset_start = this.offset;

            const modes = {
                1: "osu!",
                2: "taiko",
                3: "ctb",
                4: "mania",
            };

            for (let i = 0; i < beatmaps_count; i++) {
                const data = {};

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
                data.hitcircle = this.short();
                data.sliders = this.short();
                data.spinners = this.short();
                data.last_modification = this.long();
                data.ar = version < 20140609 ? this.byte() : this.single();
                data.cs = version < 20140609 ? this.byte() : this.single();
                data.hp = version < 20140609 ? this.byte() : this.single();
                data.od = version < 20140609 ? this.byte() : this.single();
                data.slider_velocity = this.double();

                data.sr = [];
                data.timing_points = [];

                for (let i = 0; i < 4; i++) {
                    const length = this.int();
                    const diffs = [];

                    if (version < 20250107) {
                        for (let i = 0; i < length; i++) {
                            this.byte();
                            const mod = this.int();
                            this.byte();
                            const diff = this.double();

                            if (mod != 0) {
                                diffs.push([mod, diff]);
                            }
                        }
                    } else {
                        for (let i = 0; i < length; i++) {
                            const a = this.read_typed_value();
                            const b = this.read_typed_value();

                            if (diffs.length > 1) {
                                continue;
                            }

                            diffs.push([a, b]);
                        }
                    }

                    data.sr.push({
                        mode: modes[i + 1],
                        sr: diffs,
                    });
                }

                data.drain_time = this.int();
                data.length = this.int();
                data.audio_preview = this.int();
                data.timing_points_length = this.int();

                for (let i = 0; i < data.timing_points_length; i++) {
                    const length = this.double();
                    const offset = this.double();
                    const inherited = this.bool();

                    data.timing_points.push({
                        beat_length: length,
                        offset,
                        inherited,
                    });
                }

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

                data.last_modified = this.int();
                data.mania_scroll_speed = this.byte();
                data.beatmap_end = this.offset;

                data.downloaded = true;

                beatmaps.set(data.md5, data);
            }

            const extra_start = this.offset;
            const permission_id = this.int();

            this.offset = 0;
            this.osu = {
                version,
                folders,
                account_unlocked,
                last_unlocked_time,
                player_name,
                beatmaps_count,
                beatmaps,
                extra_start,
                permission_id,
            };
            resolve(this.osu);
        });
    };

    /**
     *
     * @returns { Promise<collections_db> }
     *
     */
    get_collections_data = (buffer) => {
        return new Promise(async (resolve, reject) => {
            console.log("[reader] Reading collections data...");

            if (this.collections) {
                this.collections = {};
            }

            const lazer_mode = is_lazer_mode();

            if (lazer_mode && !buffer) {
                try {
                    // get instance
                    await this.create_instance(
                        path.resolve(
                            core.config.get("lazer_path"),
                            "client.realm",
                        ),
                        ["All"],
                    );

                    // get collections data
                    const data = await window.realmjs.objects(
                        this.instance,
                        "BeatmapCollection",
                    );
                    this.collections = {
                        length: data.length,
                        beatmaps: new Map(),
                    };

                    for (let i = 0; i < data.length; i++) {
                        const collection = data[i];
                        this.collections.beatmaps.set(collection.Name, {
                            uuid: collection.ID,
                            maps: new Set(collection.BeatmapMD5Hashes),
                        });
                    }

                    return resolve();
                } catch (e) {
                    this.instance = null;
                    create_alert(
                        "error getting lazer collections<br>check logs for more info",
                        { type: "error", html: true },
                    );
                    console.error(e);
                    return reject(e);
                }
            }

            this.set_buffer(buffer);
            this.offset = 0;

            const beatmaps = new Map();
            const version = this.int();
            const count = this.int();

            for (let i = 0; i < count; i++) {
                const name = this.string();
                const bm_count = this.int();
                const md5 = [];

                for (let i = 0; i < bm_count; i++) {
                    const map = this.string();
                    md5.push(map);
                }

                beatmaps.set(name, {
                    maps: new Set(md5),
                });
            }

            this.offset = 0;
            this.collections = { version, length: count, beatmaps };

            resolve(this.collections);
        });
    };

    delete_collection(id) {
        const lazer_mode = is_lazer_mode();

        if (lazer_mode) {
            try {
                if (!this.instance) {
                    create_alert("failed to delete collection (no instance)");
                    return;
                }

                const collection = this.collections.beatmaps.get(id);

                if (!collection?.uuid) {
                    this.collections.beatmaps.delete(id);
                } else {
                    // @TODO: need to implement this to stable collections so i can create a "undo" feature
                    this.pending_deletion.add(collection);
                    this.collections.beatmaps.delete(id);
                }
            } catch (err) {
                create_alert(
                    "failed to delete collection<br>check logs for more info",
                    { type: "error", html: true },
                );
                console.log("[reader]", err);
            }
        } else {
            this.collections.beatmaps.delete(id);
        }
    }

    get_beatmap_location(beatmap) {
        const lazer_mode = is_lazer_mode();

        if (lazer_mode) {
            if (!beatmap?.beatmapset || !beatmap?.folder_name) {
                return "";
            }

            const file_data = beatmap.beatmapset.Files.find(
                (f) => f.Filename.split(".")[1] == "osu",
            );

            if (!file_data) {
                return "";
            }

            const file_hash = file_data.File.Hash;
            return path.resolve(
                core.config.get("lazer_path"),
                "files",
                file_hash.substring(0, 1),
                file_hash.substring(0, 2),
                file_hash,
            );
        } else {
            const folder = path.resolve(
                core.config.get("stable_songs_path"),
                beatmap.folder_name,
            );
            return path.resolve(folder, beatmap.file);
        }
    }

    async search_image(beatmap) {
        try {
            const file_location = this.get_beatmap_location(beatmap);

            if (!file_location) {
                return null;
            }

            const content = await fs.get_osu_file(file_location);

            if (!content) {
                return null;
            }

            const events_start = content.indexOf("[Events]");

            if (!events_start) {
                return null;
            }

            const events_end = content.indexOf("[", events_start + 1);
            const events_section = content.substring(
                events_start,
                events_end != -1 ? events_end : undefined,
            );
            const image_matches = events_section.matchAll(/0,0,"([^"]+)"/g);
            const valid = ["avi", "mp4", "mov"];

            for (let i = 0; i < image_matches.length; i++) {
                const match = image_matches[i];
                const image_name = match[1];

                if (!image_name || !image_name.includes(".")) {
                    continue;
                }

                const ext = image_name.split(".").pop().toLowerCase();

                if (valid.includes(ext)) {
                    continue;
                }

                return image_name;
            }
        } catch (err) {
            console.log("[reader] search image error:", err);
            return null;
        }
    }

    /**
     * @param {beatmaps_schema} beatmap
     * @returns { Promise<{ path: String }> }
     *
     */
    async get_beatmap_image(beatmap) {
        if (!beatmap?.beatmapset_id) {
            return null;
        }

        if (this.image_cache.has(beatmap.beatmapset_id)) {
            return this.image_cache.get(beatmap.beatmapset_id);
        }

        try {
            const image_name = await this.search_image(beatmap);

            if (!image_name) {
                return null;
            }

            const lazer_mode = is_lazer_mode();
            let result = null;

            if (lazer_mode) {
                if (!beatmap.beatmapset?.Files) {
                    return null;
                }

                const thing = beatmap.beatmapset.Files.find(
                    (f) => f.Filename == image_name,
                );

                if (!thing?.File?.Hash) {
                    return null;
                }

                const hash = thing.File.Hash;
                result = path.resolve(
                    core.config.get("lazer_path"),
                    "files",
                    hash.substring(0, 1),
                    hash.substring(0, 2),
                    hash,
                );
            } else {
                if (!beatmap.folder_name) {
                    return null;
                }

                result = path.resolve(
                    core.config.get("stable_songs_path"),
                    beatmap.folder_name,
                    image_name,
                );
            }

            if (result) {
                this.image_cache.set(beatmap.beatmapset_id, result);
            }

            return result;
        } catch (error) {
            console.log("[reader] get_beatmap_image error:", error);
            return null;
        }
    }

    async zip_file(files) {
        const result = await window.JSZip.zip_file(files);
        return result;
    }

    async export_beatmap(beatmap) {
        const lazer_mode = is_lazer_mode();
        const osu_path = lazer_mode
            ? core.config.get("lazer_path")
            : path.resolve(
                  core.config.get("stable_path"),
                  core.config.get("stable_songs_path"),
              );
        const export_path = core.config.get("export_path");

        let buffer = "";

        if (export_path == "") {
            create_alert(
                "please update your export path before using this feature",
            );
            return false;
        }

        if (lazer_mode) {
            const files = beatmap.beatmapset.Files.map((f) => {
                const hash = f.File.Hash;
                const location = path.resolve(
                    osu_path,
                    "files",
                    hash.substring(0, 1),
                    hash.substring(0, 2),
                    hash,
                );

                return {
                    name: f.Filename,
                    location: location,
                };
            });

            buffer = await this.zip_file(files);
        } else {
            const folder_path = path.resolve(osu_path, beatmap.folder_name);
            const files = fs.readdirSync(folder_path).map((f) => {
                return {
                    name: f,
                    location: path.resolve(folder_path, f),
                };
            });

            buffer = await this.zip_file(files);
        }

        if (!core.config.get("export_path")) {
            create_alert("uhhh, can you please set you export path again? :3");
            return false;
        }

        fs.save_exported(`${beatmap.beatmapset_id}.osz`, buffer);
        return true;
    }

    static get_beatmap_status(code) {
        const lazer_mode = is_lazer_mode();

        if (lazer_mode) {
            return lazer_status_reversed[code];
        }

        return beatmap_status_reversed[code];
    }

    static get_beatmap_status_code(status) {
        if (!status) {
            return 0;
        }

        const lazer_mode = is_lazer_mode();

        if (lazer_mode) {
            const key = Object.keys(lazer_status).find(
                (k) => k.toLowerCase() == status.toLowerCase(),
            );
            return lazer_status[key];
        }

        return beatmap_status[status];
    }

    static get_status_object = () => {
        const lazer_mode = is_lazer_mode();
        return lazer_mode ? lazer_status : beatmap_status;
    };

    static get_status_object_reversed = () => {
        const lazer_mode = is_lazer_mode();
        return lazer_mode ? lazer_status_reversed : beatmap_status_reversed;
    };
}
