import { osu_db, collections_db, osdb_schema } from "./definitions.js";
import { fs, zlib } from "../global.js";
import { create_alert } from "../../popup/popup.js";

const decompress_gzip = (data) => {
    return new Promise((resolve, reject) => {
        const result = zlib.gunzip(data);
        if (!result) {
            return reject(null);
        }
        return resolve(result);
    });
}

export class OsuReader {

    /** @type {collections_db} */
    collections; 
    /** @type {osu_db} */
    osu;
    /** @type {DataView} */
    buffer;

    constructor() {
        this.type = "osu";
        this.osu = "";
        this.collections = "";
        this.buffer;
        this.offset = 0;
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

    set_buffer = (buffer) => {
        this.buffer = this.to_array_buffer(buffer);
        this.dataView = new DataView(this.buffer);
    }

    set_type = (type) => {
        this.type = type;
    }

    set_directory = (directory) => {
        this.directory = directory;
    }

    #byte(s) {
        const value = !s ? this.dataView.getUint8(this.offset) : this.dataView.getInt8(this.offset);
        this.offset += 1;
        return value;
    }

    #short(s) {
        const value = !s ? this.dataView.getUint16(this.offset, true) : this.dataView.getInt16(this.offset, true);
        this.offset += 2; 
        return value;
    }

    #int(s) {
        const value = !s ? this.dataView.getUint32(this.offset, true) : this.dataView.getInt32(this.offset, true);
        this.offset += 4;     
        return value;
    }

    #long(s) {
        const value = !s ? this.dataView.getBigUint64(this.offset, true) : this.dataView.getBigInt64(this.offset, true);
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
        } while (this.dataView.getUint8(this.offset - 1) & 0x80);
          
        return { value: result, bytesRead: this.offset };
    }

    #single() {
        const value = this.dataView.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }

    #double() {
        const value = this.dataView.getFloat64(this.offset, true);
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

        const buffer = new Uint8Array(this.buffer, this.offset, length.value);
        const decoder = new TextDecoder('utf-8');
        const value = decoder.decode(buffer);

        this.offset += length.value;

        return value;
    }

    #string2() {

        const length = this.#uleb();

        const buffer = new Uint8Array(this.buffer, this.offset, length.value);
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
    
    #writeShort(value) {
        const buffer = new ArrayBuffer(2);
        const view = new DataView(buffer);
        view.setUint16(0, value, true);
        return new Uint8Array(buffer);
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
    
    #writeSingle(value) {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setFloat32(0, value, true);
        return new Uint8Array(buffer);
    }
    
    #writeDouble(value) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, value, true);
        return new Uint8Array(buffer);
    }
    
    #writeBool(value) {
        return this.#writeByte(value ? 0x01 : 0x00);
    }
    
    #writeString(value) {

        if (value === null) {
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
            if (value !== 0) { /* more bytes to come */
                byte |= 0x80;
            }
            dataView.setUint8(offset++, byte);
        } while (value !== 0);

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
        
        return new Promise(async (resolve, reject) => {

            const buffer = [];

            if (!this.collections) {
                console.log("[Reader] No collections found");
                return;
            }

            const data = this.collections;

            buffer.push(this.#writeInt(data.version));
            buffer.push(this.#writeInt(data.beatmaps.length)); 

            for (let i = 0; i < data.length; i++) {
                    
                const collection = data.beatmaps[i];

                buffer.push(this.#writeString(collection.name));
                buffer.push(this.#writeInt(collection.maps.length));

                for (let i = 0; i < collection.maps.length; i++) {
                    buffer.push(this.#writeString(collection.maps[i]));
                }
            };

            await fs.writeFileSync(p, this.join_buffer(buffer));

            resolve();
        });
    };

    /**
     * 
     * @returns { Promise<osdb_schema> } 
     * @link https://github.com/Piotrekol/CollectionManager/blob/master/CollectionManagerDll/Modules/FileIO/FileCollections/OsdbCollectionHandler.cs
     * 
    */
    async get_osdb_data() {

        return new Promise(async (resolve, reject) => {

            if (!this.buffer) {
                return reject(new Error("buffer not set!!"));
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

                    const compressed_data = this.buffer.slice(this.offset);
                    const decompressed_data = await decompress_gzip(compressed_data);
                    
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
    get_osu_data = () => {

        return new Promise(async (resolve) => {

            if (this.osu.beatmaps?.size) {
                resolve(this.osu);
                return;
            }

            console.log("[Reader] Reading osu! data...");

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
                data.creator_name = this.#string();
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
                            
                            diffs.push([ mod, diff ]);
                        }
                    } else {
                        for (let i = 0; i < length; i++) {
                            diffs.push([this.#read_typed_value(), this.#read_typed_value()]);
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

                beatmaps.set(data.md5, data);

                data.beatmap_end = this.offset;                        
            }

            const extra_start = this.offset;
       
            const permissions_id = this.#int();
            let permission = "";

            switch (permissions_id) {
                case 0:
                    permission = "None"
                    break;
                case 1: 
                    permission = "Normal"
                    break;
                case 2: 
                    permission = "Moderator"
                    break;
                case 4:
                    permission = "Supporter"
                    break;
                case 8: 
                    permission = "Friend"
                    break;
                case 16:
                    permission = "Peppy"
                    break;
                case 32:
                    permission = "World Cup Staff"
                    break;
            }

            this.offset = 0;
            this.osu = { version, folders, account_unlocked, last_unlocked_time, player_name, beatmaps_count, beatmaps, extra_start, permissions_id, permission }; 

            resolve(this.osu);     
        });
    };

    /**
     * 
     * @returns { Promise<collections_db> } 
     * 
    */
    get_collections_data = (limit) => {

        return new Promise(async (resolve) => {

            if (this.collections?.beatmaps) {
                return resolve(this.collections);
            }

            console.log("[Reader] Reading collections data...");

            const beatmaps = [];

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

                if (limit && beatmaps.length + 1 > limit) {
                    continue;
                }
                
                beatmaps.push({
                    name: name,
                    maps: [...md5],
                }); 
            }

            this.offset = 0;
            this.collections = { version, length: count, beatmaps };

            resolve(this.collections);
        });
    };
};
