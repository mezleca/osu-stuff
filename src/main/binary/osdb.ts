import { osdb_version_from_code, osdb_version_to_code, IOSDBBeatmap, IOSDBCollection, IOSDBData, OsdbVersion } from "@shared/types/osu";
import { BinaryReader } from "./binary";

import fs from "fs";
import zlib from "zlib";

import { GenericResult } from "@shared/types/basic";

export class OSDBParser extends BinaryReader {
    constructor() {
        super();
    }

    cleanup(): void {
        this.buffer.fill(0);
        this.offset = 0;
    }

    read(location: string) {
        const buffer = fs.readFileSync(location);

        if (buffer.byteLength == 0) {
            console.log("[osdb] invalid buffer");
            return false;
        }

        this.set_buffer(buffer);

        const data: IOSDBData = {
            save_date: BigInt(0),
            last_editor: "",
            count: 0,
            collections: []
        };

        try {
            const version_string = this.string2();
            const version = osdb_version_to_code(version_string);

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
            data.count = this.int();
            data.collections = [];

            for (let i = 0; i < data.count; i++) {
                const collection: IOSDBCollection = {
                    name: this.string2(),
                    beatmaps: [],
                    hash_only_beatmaps: []
                };

                if (version >= 7) {
                    collection.online_id = this.int();
                }

                const beatmaps_count = this.int();

                for (let j = 0; j < beatmaps_count; j++) {
                    const beatmap = {} as IOSDBBeatmap;

                    ((beatmap.difficulty_id = this.int()), (beatmap.beatmapset_id = version >= 2 ? this.int() : -1));

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
    }

    write(version: OsdbVersion, data: IOSDBData): GenericResult<any> {
        try {
            if (!data || data.collections.length == 0) {
                return { success: false, reason: "no collections to write" };
            }

            if (!version) {
                return { success: false, reason: "invalid osdb version" };
            }

            const version_string = osdb_version_from_code(version);
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

            return { success: true, data: buffers };
        } catch (error) {
            return { success: false, reason: error as string };
        }
    }
}

export const osdb_parser = new OSDBParser();
