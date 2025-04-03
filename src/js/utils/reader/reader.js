const Realm = require('realm');
const { stringify,} = require('flatted');

import { osu_db, collections_db, osdb_schema, beatmaps_schema } from "./definitions.js";
import { fs, zlib, path } from "../global.js";
import { core } from "../config.js";
import { create_alert } from "../../popup/popup.js";
import { get_beatmap_bpm, get_beatmap_sr } from "../../manager/tools/beatmaps.js";
import { all_schemas, get_lazer_beatmaps, get_realm_instance, lazer_to_osu_db } from "./lazer.js";

export class OsuReader {

    /** @type {collections_db} */
    collections; 
    /** @type {osu_db} */
    osu;
    /** @type {DataView} */
    buffer;
    /** @type {Map} */
    image_cache;
    /** @type {Realm} */
    instance;

    constructor() {
        this.osu = new Map();
        this.offset = 0;
        this.image_cache = new Map();
        this.beatmap_offset_start = 0;
    }

    to_array_buffer = (buffer) => {
        const arrayBuffer = new ArrayBuffer(buffer.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < buffer.length; ++i) {
            view[i] = buffer[i];
        }
        return arrayBuffer;
    }

    create_instance = async (path, schemas) => {

        if (this.instance) {
            return;
        }

        this.instance = await get_realm_instance(path, schemas);
    }

    set_buffer = (buf) => {
        this.buffer = new DataView(this.to_array_buffer(buf));
    }

    #byte(s) {
        const value = !s ? this.buffer.getUint8(this.offset) : this.buffer.getInt8(this.offset);
        this.offset += 1;
        return value;
    }

    #short(s) {
        const value = !s ? this.buffer.getUint16(this.offset, true) : this.buffer.getInt16(this.offset, true);
        this.offset += 2; 
        return value;
    }

    #int(s) {
        const value = !s ? this.buffer.getUint32(this.offset, true) : this.buffer.getInt32(this.offset, true);
        this.offset += 4;     
        return value;
    }

    #long(s) {
        const value = !s ? this.buffer.getBigUint64(this.offset, true) : this.buffer.getBigInt64(this.offset, true);
        this.offset += 8;       
        return value;
    }

    #uleb() {
        let result = 0;
        let shift = 0;

        do {
            const byte = this.#byte();
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while (this.buffer.getUint8(this.offset - 1) & 0x80);
          
        return { value: result, bytesRead: this.offset };
    }

    #single() {
        const value = this.buffer.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }

    #double() {
        const value = this.buffer.getFloat64(this.offset, true);
        this.offset += 8; 
        return value;
    }

    #bool() {
        return this.#byte() !== 0x00;
    }

    #string() {

        const is_present = this.#bool();

        if (!is_present) {
            return null;
        }

        const length = this.#uleb();

        const buffer = new Uint8Array(this.buffer.buffer, this.offset, length.value);
        const decoder = new TextDecoder('utf-8');
        const value = decoder.decode(buffer);

        this.offset += length.value;

        return value;
    }

    #string2() {

        const length = this.#uleb();

        const buffer = new Uint8Array(this.buffer.buffer, this.offset, length.value);
        const decoder = new TextDecoder('utf-8');
        const value = decoder.decode(buffer);

        this.offset += length.value;

        return value;
    }

    #writeByte(value) {
        const buffer = new Uint8Array(1);
        buffer[0] = value;
        return buffer;
    }
    
    #writeInt(value) {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setUint32(0, value, true);
        return new Uint8Array(buffer);
    }
    
    #writeLong(value) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setBigUint64(0, BigInt(value), true);
        return new Uint8Array(buffer);
    }
    
    #writeBool(value) {
        return this.#writeByte(value ? 0x01 : 0x00);
    }
    
    #writeString(value) {

        if (value == null) {
            return this.#writeByte(0x00);
        }

        const stringBuffer = new TextEncoder().encode(value);
        const lengthBuffer = this.#writeULEB128(stringBuffer.byteLength);
        const resultBuffer = new Uint8Array(lengthBuffer.byteLength + stringBuffer.byteLength + 1);

        resultBuffer.set(new Uint8Array([0x0B]), 0);
        resultBuffer.set(new Uint8Array(lengthBuffer), 1);
        resultBuffer.set(new Uint8Array(stringBuffer), 1 + lengthBuffer.byteLength);

        return resultBuffer.buffer;
    }
    
    #writeULEB128(value) {
        const buffer = new ArrayBuffer(5);
        const dataView = new DataView(buffer);
        let offset = 0;

        do {
            let byte = value & 0x7F;
            value >>>= 7;
            if (value != 0) { /* more bytes to come */
                byte |= 0x80;
            }
            dataView.setUint8(offset++, byte);
        } while (value != 0);

        return buffer.slice(0, offset); // remove unused bytes
    }

    join_buffer(buffers) {
        let total_length = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
        let result = new Uint8Array(total_length);
        let offset = 0;
        for (let buffer of buffers) {
            result.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        }
        return result;
    }

    write_osu_data = (maps, p) => {

        return new Promise(async (res, rej) => {

            if (this.buffer?.byteLength == 0) {
                return rej(new Error("invalid buffer. call set_buffer before write_osu_data."));
            }

            const buffer = [];

            buffer.push(this.#writeInt(this.osu.version));
            buffer.push(this.#writeInt(this.osu.folders));
            buffer.push(this.#writeBool(this.osu.account_unlocked));
            buffer.push(this.#writeLong(this.osu.last_unlocked_time));
            buffer.push(this.#writeString(this.osu.player_name));
            buffer.push(this.#writeInt(this.osu.beatmaps_count));
            
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
        
        return new Promise(async (resolve) => {

            const buffer = [];

            if (!this.collections) {
                console.log("[Reader] no collections found");
                return;
            }

            buffer.push(this.#writeInt(this.collections.version));
            buffer.push(this.#writeInt(this.collections.beatmaps.size)); 

            for (const [name, collection] of this.collections.beatmaps) {
                
                buffer.push(this.#writeString(name));
                buffer.push(this.#writeInt(collection.maps.size));

                for (const map of collection.maps) {

                    if (!map) {
                        console.log("[reader] failed to get beatmap from collection!");
                        return reject();
                    }

                    buffer.push(this.#writeString(map));
                }
            }

            if (!p) {
                return resolve();
            }

            await fs.writeFileSync(p, this.join_buffer(buffer));
            resolve();
        });
    };

    // update collections with extra information like bpm, etc...
    update_collections() {

        if (this.collections.beatmaps.size == 0) {
            console.log("[Reader] cant update collection cuz no beatmaps found");
            return;
        }

        for (const [name] of this.collections.beatmaps) {
            this.update_collection(name);
        }
    }

    update_collection(name) {

        if (!this.collections.beatmaps.has(name)) {
            console.log("[Reader] collection not found");
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

            const sr = Number(get_beatmap_sr(map));
            const bpm = Number(get_beatmap_bpm(map));

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
                const version_string = this.#string2();
                
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
                    
                    this.#string2();
                }
                
                data.save_date = this.#double();
                data.last_editor = this.#string2();
                data.collections_count = this.#int();
                
                data.collections = [];
                
                for (let i = 0; i < data.collections_count; i++) {

                    const collection = {
                        name: this.#string2(),
                        beatmaps: [],
                        hash_only_beatmaps: []
                    };
                    
                    if (file_version >= 7) {
                        collection.online_id = this.#int();
                    }
                    
                    const beatmaps_count = this.#int();
                    
                    for (let j = 0; j < beatmaps_count; j++) {

                        const beatmap = {
                            map_id: this.#int(),
                            map_set_id: file_version >= 2 ? this.#int() : -1
                        };
                        
                        if (!is_minimal) {
                            beatmap.artist = this.#string2();
                            beatmap.title = this.#string2();
                            beatmap.diff_name = this.#string2();
                        }
                        
                        beatmap.md5 = this.#string2();
                        
                        if (file_version >= 4) {
                            beatmap.user_comment = this.#string2();
                        }
                        
                        if (file_version >= 8 || (file_version >= 5 && !is_minimal)) {
                            beatmap.play_mode = this.#byte();
                        }
                        
                        if (file_version >= 8 || (file_version >= 6 && !is_minimal)) {
                            beatmap.stars_nomod = this.#double();
                        }
                        
                        collection.beatmaps.push(beatmap);
                    }
                    
                    if (file_version >= 3) {
                        const hash_count = this.#int();
                        for (let j = 0; j < hash_count; j++) {
                            collection.hash_only_beatmaps.push(this.#string2());
                        }
                    }
                    
                    data.collections.push(collection);
                }
                
                const footer = this.#string2();

                if (footer != "By Piotrekol") {
                    throw new Error("invalid file footer, this collection might be corrupted.");
                }
                
                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    }

    #read_typed_value() {

        const type = this.#byte();
        
        switch (type) {
            case 1:
                return this.#bool();
            case 2:
                return this.#byte();
            case 3:
                return this.#short();
            case 4:
                return this.#int();
            case 5:
                return this.#long();
            case 6:
                return this.#byte(true);
            case 7:
                return this.#short(true);
            case 8:
                return this.#int(true);
            case 9:
                return this.#long(true);
            case 10:
                return String.fromCharCode(this.#short());
            case 11:
                return this.#string();
            case 12:
                return this.#single();
            case 13:
                return this.#double();
            case 14:
                return this.#double();
            case 15:
                return this.#long(true);
            case 16: {
                const num = this.#int() - 4294967296;
                return num > 0 ? this.#byte() : 0;
            }
            case 17: {
                const length = this.#int(true);
                if (length > 0) {
                    const chars = new Array(length);
                    for (let i = 0; i < length; i++) {
                        chars[i] = this.#byte();
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
            const lazer_mode = core.config.get("lazer_mode") && core.config.get("lazer_path");
            
            if (lazer_mode) {

                console.log("[Reader] reading lazer data...");

                try { 
                    
                    // get instance
                    await this.create_instance(core.config.get("lazer_path"), all_schemas);

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

            console.log("[Reader] reading osu! stable data...");

            const beatmaps = new Map();
            const version = this.#int();
            const folders = this.#int();
            const account_unlocked = this.#bool();

            const last_unlocked_time = this.#long();
            
            const player_name = this.#string();
            const beatmaps_count = this.#int();

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

                data.entry = version < 20191106 ? this.#int() : 0;
                data.artist_name = this.#string();
                data.artist_name_unicode = this.#string();
                data.song_title = this.#string();
                data.song_title_unicode = this.#string();
                data.mapper = this.#string();
                data.difficulty = this.#string();
                data.audio_file_name = this.#string();
                data.md5 = this.#string();
                data.file = this.#string();
                data.status = this.#byte();
                data.hitcircle = this.#short();
                data.sliders = this.#short();
                data.spinners = this.#short();
                data.last_modification = this.#long();
                data.approach_rate = version < 20140609 ? this.#byte() : this.#single();
                data.circle_size = version < 20140609 ? this.#byte() : this.#single();
                data.hp = version < 20140609 ? this.#byte() : this.#single();
                data.od = version < 20140609 ? this.#byte() : this.#single();
                data.slider_velocity = this.#double();

                data.sr = [];
                data.timing_points = [];

                for (let i = 0; i < 4; i++) {

                    const length = this.#int();
                    const diffs = [];

                    if (version < 20250107) {

                        for (let i = 0; i < length; i++) {

                            this.#byte();
                            const mod = this.#int();
                            this.#byte();
                            const diff = this.#double();
                            
                            if (mod != 0) {
                                diffs.push([ mod, diff ]);
                            }
                        }
                    } else {
                        
                        for (let i = 0; i < length; i++) {

                            const a = this.#read_typed_value();
                            const b = this.#read_typed_value();

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
                
                data.drain_time = this.#int();
                data.total_time = this.#int();
                data.audio_preview = this.#int();
                data.timing_points_length = this.#int();
                
                for (let i = 0; i < data.timing_points_length; i++) {

                    const length = this.#double();
                    const offset = this.#double();
                    const inherited = this.#bool();  

                    data.timing_points.push({ beat_length: length, offset, inherited });
                }

                data.difficulty_id = this.#int();
                data.beatmap_id = this.#int();
                data.thread_id = this.#int();
                data.grade_standard = this.#byte();
                data.grade_taiko = this.#byte();
                data.grade_ctb = this.#byte();
                data.grade_mania = this.#byte();
                data.local_offset = this.#short();
                data.stack_leniency = this.#single();
                data.mode = this.#byte();
                data.source = this.#string();
                data.tags = this.#string();
                data.online_offset = this.#short();
                data.font = this.#string();
                data.unplayed = this.#bool();
                data.last_played = this.#long();
                data.is_osz2 = this.#bool();
                data.folder_name = this.#string();
                data.last_checked = this.#long();
                data.ignore_sounds = this.#bool();
                data.ignore_skin = this.#bool();
                data.disable_storyboard = this.#bool();
                data.disable_video = this.#bool();
                data.visual_override = this.#bool();

                if (version < 20140609) {
                    data.unknown = this.#short();
                }

                data.last_modified = this.#int();	
                data.mania_scroll_speed = this.#byte();
                data.beatmap_end = this.offset;   

                beatmaps.set(data.md5, data);         
            }

            const extra_start = this.offset;
            const permission_id = this.#int();

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

            console.log("[Reader] Reading collections data...");

            if (this.collections) {
                this.collections = {};
            }

            const lazer_mode = core.config.get("lazer_mode") && core.config.get("lazer_path");
            
            if (lazer_mode) {

                try {

                    // get instance
                    await this.create_instance(path.resolve(core.config.get("lazer_path"), "client.realm"), all_schemas);

                    // get collections data
                    const data = this.instance.objects("BeatmapCollection").toJSON();
                    
                    // @TODO: move thjis to lazer file
                    this.collections = {
                        length: data.length,
                        beatmaps: new Map(),
                    };

                    for (let i = 0; i < data.length; i++) {
                        const collection = data[i];
                        this.collections.beatmaps.set(collection.Name, {
                            maps: new Set(collection.BeatmapMD5Hashes),
                        });
                    }

                    return resolve();
                } catch (e) {
                    this.instance = null;
                    create_alert("error getting lazer collections<br>check logs for more info", { type: "error" });
                    console.error(e);
                    return reject(e);
                }
            }

            this.set_buffer(buffer);
            this.offset = 0;

            const beatmaps = new Map();
            const version = this.#int();
            const count = this.#int();

            for (let i = 0; i < count; i++) {
                
                const name = this.#string();
                const bm_count = this.#int();
                const md5 = [];

                for (let i = 0; i < bm_count; i++) {
                    const map = this.#string();
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

    /**
     * @param {beatmaps_schema} beatmap
     * @returns { Promise<{ path: String }> } 
     * 
    */
    get_beatmap_image(beatmap) { 

        if (this.image_cache.has(beatmap.beatmap_id)) {
            return this.image_cache.get(beatmap.beatmap_id);
        }
        
        const file_location = path.resolve(core.config.get("stable_songs_path"), beatmap.folder_name);
        
        try {

            const content = fs.readFileSync(path.resolve(file_location, beatmap.file), "utf8");
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
                
                const result = path.resolve(file_location, image_name);
                this.image_cache.set(beatmap.beatmap_id, result);
                return result;
            } 

            return;
        } catch (error) {
            return;
        }
    }
};
