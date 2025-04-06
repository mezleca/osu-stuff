const Realm = require('realm');
const JSZip = require("jszip");

import { core } from "../../app.js";
import { osu_db, collections_db, osdb_schema, beatmaps_schema, beatmap_status_reversed, lazer_status_reversed, beatmap_status, lazer_status } from "./models/stable.js";
import { fs, zlib, path } from "../global.js";
import { create_alert } from "../../popup/popup.js";
import { get_beatmap_bpm, get_beatmap_sr } from "../../manager/tools/beatmaps.js";
import { all_schemas, BeatmapCollection } from "./models/lazer.js";
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
    /** @type {Realm} */
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
    }

    write_osu_data = (maps, p) => {

        return new Promise(async (res, rej) => {

            if (this.buffer?.byteLength == 0) {
                return rej(new Error("invalid buffer. call set_buffer before write_osu_data."));
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
                    create_alert("failed to recreate osu!.db", { type: "error" });
                    return;
                }

                if (last_index < maps[i].beatmap_start) {
                    const bf = new Uint8Array(this.buffer.slice(last_index, maps[i].beatmap_start));
                    buffer.push(bf);
                }

                last_index = maps[i].beatmap_end;
            }

            if (last_index < this.buffer.byteLength) {
                buffer.push(new Uint8Array(this.buffer.slice(last_index)));
            }
            
            await fs.writeFileSync(p, this.join_buffer(buffer));
            res();
        });
    };

    write_collections_data = (p) => {
        
        return new Promise(async (resolve, reject) => {

            const lazer_mode = is_lazer_mode();
            const buffer = [];

            if (lazer_mode) {

                if (!this.instance) {
                    console.log("[reader] failed to get instance (cant write collection)", this.instance);
                    return;
                }

                try {
                    
                    // delete pending collections
                    for (const pending of this.pending_deletion) {
                        this.instance.write(() => {
                            const collection = this.instance.objectForPrimaryKey("BeatmapCollection", pending.uuid);
                            this.instance.delete(collection);
                        });
                    }

                    // update/create the rest
                    // @NOTE: sometimes for some reason this fail saying the subject is null
                    // it only gave that error 1 time i cant seem to reproduce...
                    for (const [name, data] of Array.from(this.collections.beatmaps)) {

                        const exists = data?.uuid ? this.instance.objectForPrimaryKey("BeatmapCollection", data.uuid) : null;
                        this.instance.write(() => {
    
                            if (exists == null) {

                                const id = new Realm.BSON.UUID();

                                console.log("creating new collection", id, name, data);
                                
                                this.instance.create(BeatmapCollection, {
                                    ID: id,
                                    Name: name,
                                    BeatmapMD5Hashes: Array.from(data.maps) || [],
                                    LastModified: new Date()
                                });
    
                                this.collections.beatmaps.get(name).uuid = id;
                            
                            } else {
                                const collection = exists;
                                collection.Name = name;
                                collection.BeatmapMD5Hashes = Array.from(data.maps);
                                collection.LastModified = new Date();
                            }
                        });
                    }

                    return resolve(); 

                } catch(err) {
                    create_alert("failed to save collection, check logs for more info", { type: "error" });
                    console.log("[reader] error while saving", err);
                    return reject(err);
                }
            }

            if (!this.collections) {
                console.log("[reader] no collections found");
                return;
            }

            buffer.push(this.writeInt(this.collections.version));
            buffer.push(this.writeInt(this.collections.beatmaps.size)); 

            for (const [name, collection] of this.collections.beatmaps) {
                
                buffer.push(this.writeString(name));
                buffer.push(this.writeInt(collection.maps.size));

                for (const map of collection.maps) {

                    if (!map) {
                        console.log("[reader] failed to get beatmap from collection!");
                        return reject();
                    }

                    buffer.push(this.writeString(map));
                }
            }

            if (!p) {
                return resolve();
            }

            fs.writeFileSync(p, this.join_buffer(buffer));
            resolve();
        });
    };

    // update collections with extra information like bpm, etc...
    update_collections() {

        if (this.collections.beatmaps.size == 0) {
            console.log("[reader] cant update collection cuz no beatmaps found");
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

            const sr = map.star_rating || Number(get_beatmap_sr(map));
            const bpm = map.bpm || Number(get_beatmap_bpm(map));

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
    async get_osdb_data() {

        return new Promise(async (resolve, reject) => {

            if (this.buffer.byteLength == 0) {
                return reject(new Error("invalid buffer"));
            }
    
            try {

                const data = {};
                const version_string = this.string2();
                
                const versions = {
                    "o!dm": 1,
                    "o!dm2": 2,
                    "o!dm3": 3,
                    "o!dm4": 4,
                    "o!dm5": 5,
                    "o!dm6": 6,
                    "o!dm7": 7,
                    "o!dm8": 8,
                    "o!dm7min": 1007,
                    "o!dm8min": 1008,
                };

                const version = versions[version_string];
                
                if (!version) {
                    throw new Error(`invalid osdb version (got: ${version_string})`);
                }
                
                const file_version = versions[version_string];
                const is_minimal = version_string.endsWith("min");
                
                if (file_version >= 7) {

                    const compressed_data = this.buffer.buffer.slice(this.offset);
                    const decompressed_data = zlib.gunzip(compressed_data);
                    
                    this.set_buffer(decompressed_data);
                    this.offset = 0;
                    
                    this.string2();
                }
                
                data.save_date = this.double();
                data.last_editor = this.string2();
                data.collections_count = this.int();
                
                data.collections = [];
                
                for (let i = 0; i < data.collections_count; i++) {

                    const collection = {
                        name: this.string2(),
                        beatmaps: [],
                        hash_only_beatmaps: []
                    };
                    
                    if (file_version >= 7) {
                        collection.online_id = this.int();
                    }
                    
                    const beatmaps_count = this.int();
                    
                    for (let j = 0; j < beatmaps_count; j++) {

                        const beatmap = {
                            map_id: this.int(),
                            map_set_id: file_version >= 2 ? this.int() : -1
                        };
                        
                        if (!is_minimal) {
                            beatmap.artist = this.string2();
                            beatmap.title = this.string2();
                            beatmap.diff_name = this.string2();
                        }
                        
                        beatmap.md5 = this.string2();
                        
                        if (file_version >= 4) {
                            beatmap.user_comment = this.string2();
                        }
                        
                        if (file_version >= 8 || (file_version >= 5 && !is_minimal)) {
                            beatmap.play_mode = this.byte();
                        }
                        
                        if (file_version >= 8 || (file_version >= 6 && !is_minimal)) {
                            beatmap.stars_nomod = this.double();
                        }
                        
                        collection.beatmaps.push(beatmap);
                    }
                    
                    if (file_version >= 3) {
                        const hash_count = this.int();
                        for (let j = 0; j < hash_count; j++) {
                            collection.hash_only_beatmaps.push(this.string2());
                        }
                    }
                    
                    data.collections.push(collection);
                }
                
                const footer = this.string2();

                if (footer != "By Piotrekol") {
                    throw new Error("invalid file footer, this collection might be corrupted.");
                }
                
                resolve(data);
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
                    await this.create_instance(path.resolve(core.config.get("lazer_path"), "client.realm"), all_schemas);

                    // convert lazer data to match current osu! stable obj
                    this.osu = lazer_to_osu_db(this.instance);

                    return resolve();
                } catch(err) {     
                    this.instance = null;
                    create_alert("failed to read lazer db file\ncheck logs for more info", { type: "error" });
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
                "1": "osu!",
                "2": "taiko",
                "3": "ctb",
                "4": "mania",
            };

            for (let i = 0; i < beatmaps_count; i++) {

                const data = {};

                data.beatmap_start = this.offset;

                data.entry = version < 20191106 ? this.int() : 0;
                data.artist_name = this.string();
                data.artist_name_unicode = this.string();
                data.song_title = this.string();
                data.song_title_unicode = this.string();
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
                data.approach_rate = version < 20140609 ? this.byte() : this.single();
                data.circle_size = version < 20140609 ? this.byte() : this.single();
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
                                diffs.push([ mod, diff ]);
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
                data.total_time = this.int();
                data.audio_preview = this.int();
                data.timing_points_length = this.int();
                
                for (let i = 0; i < data.timing_points_length; i++) {

                    const length = this.double();
                    const offset = this.double();
                    const inherited = this.bool();  

                    data.timing_points.push({ beat_length: length, offset, inherited });
                }

                data.difficulty_id = this.int();
                data.beatmap_id = this.int();
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

                beatmaps.set(data.md5, data);         
            }

            const extra_start = this.offset;
            const permission_id = this.int();

            this.offset = 0;
            this.osu = { version, folders, account_unlocked, last_unlocked_time, player_name, beatmaps_count, beatmaps, extra_start, permission_id }; 
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

            if (lazer_mode) {

                try {

                    // get instance
                    await this.create_instance(path.resolve(core.config.get("lazer_path"), "client.realm"), all_schemas);

                    // get collections data
                    const data = this.instance.objects("BeatmapCollection").toJSON();
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
                    create_alert("error getting lazer collections<br>check logs for more info", { type: "error", html: true });
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
                    // to remove later using realm shit (need to implement this to stable collections so i can create a "undo" feature)
                    this.pending_deletion.add(collection);
                    this.collections.beatmaps.delete(id);
                }
            }
            catch(err) {
                create_alert("failed to delete collection<br>check logs for more info", { type: "error", html: true });
                console.log("[reader]", err);
            }
        } else {
            this.collections.beatmaps.delete(id);
        }        
    };

    get_beatmap_location(beatmap) {

        const lazer_mode = is_lazer_mode();

        if (lazer_mode) {

            if (!beatmap?.beatmapset) {
                return "";
            }
            
            const file_data = beatmap.beatmapset.Files.find((f) => f.Filename.split(".")[1] == "osu");

            if (!file_data) {
                return "";
            }

            const file_hash = file_data.File.Hash;
            return path.resolve(core.config.get("lazer_path"), "files", file_hash.substring(0, 1), file_hash.substring(0, 2), file_hash);
        }
        else {
            const folder = path.resolve(core.config.get("stable_songs_path"), beatmap.folder_name);
            return path.resolve(folder, beatmap.file);
        }
    };

    search_image(beatmap) {

        try { 

            const file_location = this.get_beatmap_location(beatmap);

            if (!file_location) {
                return;
            }

            const content = fs.readFileSync(file_location, "utf8");
            const events_start = content.indexOf("[Events]");

            if (!events_start) {
                return;
            }
            
            const events_section = content.substring(events_start, content.indexOf("[", events_start + 1));
            const events_lines = events_section.split("\n");
            
            for (let i = 0; i < events_lines.length; i++) {

                const line = events_lines[i];

                if (!line.startsWith("0,0,\"")) {
                    continue;
                }
                
                const image_match = line.match(/0,0,"([^"]+)"/);

                if (!image_match) {
                    continue;
                }
                
                const image_name = image_match[1];
                     
                if (!image_name.includes(".")) {
                    continue;
                }

                if (image_name.endsWith(".avi") || image_name.endsWith(".mp4") || image_name.endsWith(".mov")) {
                    continue;
                }
                
                return image_name;
            }

        } catch(err) {
            console.log("[reader]", err);
        }
    };

    /**
     * @param {beatmaps_schema} beatmap
     * @returns { Promise<{ path: String }> } 
     * 
    */
    get_beatmap_image(beatmap) { 

        if (this.image_cache.has(beatmap.beatmap_id)) {
            return this.image_cache.get(beatmap.beatmap_id);
        }
        
        const lazer_mode = is_lazer_mode();
        const image_name = this.search_image(beatmap);

        if (!image_name) {
            return;
        }

        if (lazer_mode) {

            const thing = beatmap.beatmapset.Files.find((f) => f.Filename == image_name);

            if (!thing) {
                console.log("[reader] file not found", beatmap.beatmapset);
                return;
            }

            const file_hash = thing.File.Hash;
            const result = path.resolve(core.config.get("lazer_path"), "files", file_hash.substring(0, 1), file_hash.substring(0, 2), file_hash);
            this.image_cache.set(beatmap.beatmap_id, result);
            return result;
        } 
        else {
            const result = path.resolve(core.config.get("stable_songs_path"), beatmap.folder_name, image_name);
            this.image_cache.set(beatmap.beatmap_id, result);
            return result;
        }
    };

    zip_file(files) {

        const zip = new JSZip();
    
        for (let i = 0; i < files.length; i++) {
            
            const { name, location } = files[i];

            if (fs.statSync(location).isDirectory()) {
                continue;
            }

            zip.file(name, fs.readFileSync(location));
        }
    
        return zip.generateAsync({ type: "nodebuffer" });
    }
    
    async export_beatmap(beatmap) {

        const lazer_mode = is_lazer_mode();
        const osu_path = lazer_mode ? core.config.get("lazer_path") : path.resolve(core.config.get("stable_path"), core.config.get("stable_songs_path"));
        const export_path = core.config.get("export_path");
        
        let buffer = "";
    
        if (!export_path) {
            create_alert("please update your export path before using this feature");
            return;
        }
    
        if (lazer_mode) {
            
            const files = beatmap.beatmapset.Files.map((f) => {

                const hash = f.File.Hash;
                const location = path.resolve(osu_path, "files", hash.substring(0, 1), hash.substring(0, 2), hash);
                
                return { 
                    name: f.Filename,
                    location: location
                }
            });

            buffer = await this.zip_file(files);
                 
        } else {

            const folder_path = path.resolve(osu_path, beatmap.folder_name);
            const files = fs.readdirSync(folder_path).map((f) => { 
                return { 
                    name: f, 
                    location: path.resolve(folder_path, f) 
                };
            });
    
            buffer = await this.zip_file(files);
        }

        fs.writeFileSync(`${export_path}/${beatmap.beatmap_id}.osz`, buffer);
    }

    static get_beatmap_status(code) {

        const lazer_mode = is_lazer_mode();

        if (lazer_mode) {
            return lazer_status_reversed[code];
        }

        return beatmap_status_reversed[code];
    };

    static get_beatmap_status_code(status) {
        
        const lazer_mode = is_lazer_mode();

        if (lazer_mode) {
            return lazer_status[status];
        }

        return beatmap_status[status];
    };

    // @TODO: i desperately need to rewrite this shit Lol
    static get_status_object = () => {
        const lazer_mode = is_lazer_mode();
        return lazer_mode ? lazer_status : beatmap_status;
    };

    static get_status_object_reversed = () => {
        const lazer_mode = is_lazer_mode();
        return lazer_mode ? lazer_status_reversed : beatmap_status_reversed;
    };
};
