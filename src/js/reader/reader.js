import { osu_db, collections_db } from "./definitions.js";

const fs = require("fs");

export class OsuReader {

    /** @type {collections_db} */
    collections; 
    /** @type {osu_db} */
    osu;
    /** @type {Buffer} */
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

    set_buffer = (buffer, convert) => {
        this.buffer = Buffer.from(buffer);
    }

    set_type = (type) => {
        this.type = type;
    }

    set_directory = (directory) => {
        this.directory = directory;
    }

    #byte(){
        const value = this.buffer.readUint8(this.offset);
        this.offset += 1;
        return value;
    }

    #short(){
        const value = this.buffer.readUint16LE(this.offset);
        this.offset += 2; 
        return value;
    }

    #int(){
        const value = this.buffer.readUint32LE(this.offset);
        this.offset += 4;     
        return value;
    }

    #long(){
        const value = this.buffer.readBigUInt64LE(this.offset);
        this.offset += 8;       
        return value;
    }

    #uleb() {

        let result = 0;
        let shift = 0;
    
        do {
            const byte = this.buffer.readUInt8(this.offset);
            result |= (byte & 0x7F) << shift;
            shift += 7;
            this.offset += 1;
        } while (this.buffer.readUInt8(this.offset - 1) & 0x80);
          
        return { value: result, bytesRead: this.offset };
    }

    #single(){
        const value = this.buffer.readFloatLE(this.offset);
        this.offset += 4;
        return value;
    }

    #double(){
        const value = this.buffer.readDoubleLE(this.offset);
        this.offset += 8; 
        return value;
    }

    #bool(){
        const value = this.#byte() == 0x00 ? false : true;
        return value;
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
    
    #skip(b) {
        this.offset += b;     
    }

    #writeByte(value) {
        const buffer = Buffer.alloc(1);
        buffer.writeUInt8(value, 0);
        return buffer;
    }
    
    #writeShort(value) {
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16LE(value, 0);
        return buffer;
    }
    
    #writeInt(value) {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(value, 0);
        return buffer;
    }
    
    #writeLong(value) {
        const buffer = Buffer.alloc(8);
        buffer.writeBigInt64LE(BigInt(value), 0);
        return buffer;
    }
    
    #writeSingle(value) {
        const buffer = Buffer.alloc(4);
        buffer.writeFloatLE(value, 0);
        return buffer;
    }
    
    #writeDouble(value) {
        const buffer = Buffer.alloc(8);
        buffer.writeDoubleLE(value, 0);
        return buffer;
    }
    
    #writeBool(value) {
        return this.#writeByte(value ? 0x01 : 0x00);
    }
    
    #writeString(value) {
        if (value === null) {
            return this.#writeByte(0x00);
        }
        const stringBuffer = Buffer.from(value);
        const lengthBuffer = this.#writeULEB128(stringBuffer.byteLength);
        const resultBuffer = Buffer.concat([Buffer.from([0x0B]), lengthBuffer, stringBuffer]);
        return resultBuffer;
    }
    
    #writeULEB128(value) {

        const buffer = Buffer.alloc(5); // max 5 bytes for 32-bit number
        let offset = 0;

        do {
            let byte = value & 0x7F;
            value >>>= 7;
            if (value !== 0) { /* more bytes to come */
                byte |= 0x80;
            }
            buffer.writeUInt8(byte, offset++);
        } while (value !== 0);

        return buffer.slice(0, offset); // remove unused bytes
    }

    join_buffer(buffers) {
        return buffers.reduce((prev, b) => Buffer.concat([prev, b]));
    }

    write_osu_data = (maps, p) => {

        return new Promise((res, rej) => {

            const file = fs.createWriteStream(p);

            file.write(this.#writeInt(this.osu.version));
            file.write(this.#writeInt(this.osu.folders));
            file.write(this.#writeBool(this.osu.account_unlocked));
            file.write(this.#writeLong(this.osu.last_unlocked_time));
            file.write(this.#writeString(this.osu.player_name));
            file.write(this.#writeInt(this.osu.beatmaps_count));
            
            let last_index = this.beatmap_offset_start;

            // sort to make end as last_index
            maps = maps.sort((a, b) => a.start - b.start);

            for (let i = 0; i < maps.length; i++) {

                const bf = this.buffer.slice(last_index, maps[i].start);

                last_index = maps[i].end;
                file.write(Buffer.from(bf));
            };

            file.write(this.buffer.slice(last_index, this.buffer.byteLength));
            file.end();

            file.on("finish", () => {
                console.log("[Reader] finished writing osu.db");
                res();
            });

            file.on("error", (err) => {
                console.log(err);
                rej(err);
            });
        });
    };

    write_collections_data = (p) => {
        
        return new Promise(async (resolve, reject) => {

            if (!this.collections) {
                console.log("[Reader] No collections found");
                return;
            }

            const data = this.collections;
            const file = fs.createWriteStream(p);

            file.write(this.#writeInt(data.version));
            file.write(this.#writeInt(data.beatmaps.length)); 

            for (let i = 0; i < data.length; i++) {
                    
                const collection = data.beatmaps[i];

                file.write(this.#writeString(collection.name));
                file.write(this.#writeInt(collection.maps.length));

                for (let i = 0; i < collection.maps.length; i++) {
                    file.write(this.#writeString(collection.maps[i]));
                }
            };

            file.end();

            file.on("finish", () => {
                console.log("[Reader] finished writing collections.db");
                resolve();
            });

            file.on("error", (err) => {
                console.log(err);
                reject();
            });
        });
    };

    get_osu_data = () => {

        return new Promise(async (resolve) => {

            if (this.osu.beatmaps?.length) {
                resolve();
            }

            console.log("[Reader] Reading osu! data...");

            const beatmaps = [];

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
                data.last_modification = this.#long(true);
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

                    for (let i = 0; i < length; i++) {

                        this.#byte();
                        const mod = this.#int();
                        this.#byte();
                        const diff = this.#double();
                        
                        diffs.push([ mod, diff ]);
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

                    const bpm = this.#double();
                    const offset = this.#double();
                    const idk_bool = this.#bool();  

                    data.timing_points.push({ bpm, offset, idk_bool });
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

                beatmaps.push(data);

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

            resolve();     
        });
    };

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