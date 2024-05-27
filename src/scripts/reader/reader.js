import { osu_db, collections_db } from "./definitions.js";

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
        if (convert) {
            this.buffer = new DataView(this.to_array_buffer(buffer));
            return;
        }
        this.buffer = new DataView(buffer);
    }

    set_type = (type) => {
        this.type = type;
    }

    set_directory = (directory) => {
        this.directory = directory;
    }

    #byte(){
        const value = this.buffer.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    #short(){
        const value = this.buffer.getUint16(this.offset, true);
        this.offset += 2; 
        return value;
    }

    #int(){
        const value = this.buffer.getUint32(this.offset, true);
        this.offset += 4;     
        return value;
    }

    #long(){
        const value = this.buffer.getBigInt64(this.offset, true);
        this.offset += 8;       
        return value;
    }

    #uleb() {
        let result = 0;
        let shift = 0;
    
        do {
            var byte = this.#byte();
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while (byte & 0x80);
          
        return { value: result, bytesRead: this.offset };
    }

    #single(){
        const value = this.buffer.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }

    #double(){
        const value = this.buffer.getFloat64(this.offset, true);
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
        const buffer = new ArrayBuffer(1);
        const dataView = new DataView(buffer);
        dataView.setUint8(0, value);
        return buffer;
    }

    #writeShort(value) {
        const buffer = new ArrayBuffer(2);
        const dataView = new DataView(buffer);
        dataView.setUint16(0, value, true);
        return buffer;
    }

    #writeInt(value) {
        const buffer = new ArrayBuffer(4);
        const dataView = new DataView(buffer);
        dataView.setUint32(0, value, true);
        return buffer;
    }

    #writeLong(value) {
        const buffer = new ArrayBuffer(8);
        const dataView = new DataView(buffer);
        dataView.setBigInt64(0, BigInt(value), true);
        return buffer;
    }

    #writeSingle(value) {
        const buffer = new ArrayBuffer(4);
        const dataView = new DataView(buffer);
        dataView.setFloat32(0, value, true);
        return buffer;
    }

    #writeDouble(value) {
        const buffer = new ArrayBuffer(8);
        const dataView = new DataView(buffer);
        dataView.setFloat64(0, value, true);
        return buffer;
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
        const buffer = new ArrayBuffer(5); // max 5 bytes for 32-bit number
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

    write_collections_data = () => {
        
        return new Promise(async (r, rj) => {

            if (!this.collections) {
                console.log("No collections found");
                return;
            }

            this.offset = 0;
            const buffer_array = [];
            const data = this.collections;

            buffer_array.push(this.#writeInt(data.version));
            buffer_array.push(this.#writeInt(data.beatmaps.length)); 

            for (let i = 0; i < data.length; i++) {
                    
                const collection = data.beatmaps[i];

                buffer_array.push(this.#writeString(collection.name));
                buffer_array.push(this.#writeInt(collection.maps.length));

                for (let i = 0; i < collection.maps.length; i++) {
                    const data = this.#writeString(collection.maps[i]);
                    buffer_array.push(data);
                }
            };

            const concate = buffer_array.reduce((acc, curr) => {
                const newBuffer = new Uint8Array(acc.byteLength + curr.byteLength);
                newBuffer.set(new Uint8Array(acc), 0);
                newBuffer.set(new Uint8Array(curr), acc.byteLength);
                return newBuffer.buffer;
            }, new ArrayBuffer(0));

            console.log(buffer_array);

            this.buffer = concate;

            r(this.buffer);
        });
    };

    get_osu_data = (limit) => {

        return new Promise(async (resolve) => {

            if (!this.osu.beatmaps) {
                resolve();
            }

            const beatmaps = [];

            const version = this.#int();
            const folders = this.#int();
            const account_unlocked = this.#bool();

            this.#skip(8);

            const player_name = this.#string();
            const beatmaps_count = this.#int();
            const modes = {
                "1": "osu!",
                "2": "taiko",
                "3": "ctb",
                "4": "mania",
            };

            for (let i = 0; i < beatmaps_count; i++) {

                const data = {};

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
                        
                        diffs.push([ mod, diff]);
                    }

                    data.sr.push({
                        mode: modes[i + 1],
                        sr: diffs,
                    });
                }
                
                data.drain_time = this.#int();
                data.total_time = this.#int();
                data.audio_preview = this.#int();
                
                const timing_points = this.#int();
                
                for (let i = 0; i < timing_points; i++) {

                    const bpm = this.#double();
                    const offset = this.#double();
                    const idk_bool = this.#bool();  

                    if (data.timing_points.length < 6) {
                        if (data.timing_points.length == 6) {
                            data.timing_points.push(["..."]);
                        } else {
                            data.timing_points.push({ bpm, offset, idk_bool });
                        }
                    }
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

                if (limit && beatmaps.length + 1 > limit) {
                    continue;
                }                               
            }
       
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
            this.osu = { version, folders, account_unlocked, player_name, beatmaps_count, beatmaps, permissions_id, permission }; 

            resolve();     
        });
    };

    get_collections_data = (limit) => {

        return new Promise(async (resolve) => {

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