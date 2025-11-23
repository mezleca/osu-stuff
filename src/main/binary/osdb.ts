import { osdb_version_from_code, osdb_version_to_code, IOSDBBeatmap, IOSDBCollection, IOSDBData, OsdbVersion } from "@shared/types/osu";
import { BinaryReader } from "./binary";
import { GenericResult } from "@shared/types/basic";
import { WriteOSDBParams } from "@shared/types";

import fs from "fs";
import zlib from "zlib";

export class OSDBParser extends BinaryReader {
    constructor() {
        super();
    }

    cleanup(): void {
        this.buffer.fill(0);
        this.offset = 0;
    }

    read(location: string): GenericResult<IOSDBData> {
        const buffer = fs.readFileSync(location);

        if (buffer.byteLength == 0) {
            console.log("[osdb] invalid buffer");
            return { success: false, reason: "invalid buffer" };
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
                return { success: false, reason: "invalid version: " + version_string };
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

            return { success: true, data: data };
        } catch (error) {
            console.log(error);
            return { success: false, reason: error as string };
        }
    }

    write(version: OsdbVersion, data: IOSDBData): GenericResult<Buffer<ArrayBuffer>> {
        try {
            if (!data || data.collections.length == 0) {
                return { success: false, reason: "no collections to write" };
            }

            if (!version) {
                return { success: false, reason: "invalid osdb version" };
            }

            const version_string = osdb_version_from_code(version);
            const is_minimal = version_string.endsWith("min");
            const content_buffer: Buffer<ArrayBuffer>[] = [];

            // save to append later
            const version_buffer = this.writeString2(version_string);

            content_buffer.push(this.writeLong(data.save_date ?? new Date().getTime()));
            content_buffer.push(this.writeString2(data.last_editor ?? ""));
            content_buffer.push(this.writeInt(data.collections.length));

            for (let i = 0; i < data.collections.length; i++) {
                const collection = data.collections[i];

                content_buffer.push(this.writeString2(collection.name || ""));

                if (version >= 7) {
                    content_buffer.push(this.writeInt(collection.online_id || 0));
                }

                content_buffer.push(this.writeInt(collection.beatmaps.length || 0));

                for (let i = 0; i < collection.beatmaps.length; i++) {
                    const beatmap = collection.beatmaps[i];

                    content_buffer.push(this.writeInt(beatmap.difficulty_id || 0));

                    if (version >= 2) {
                        content_buffer.push(this.writeInt(beatmap.beatmapset_id || -1));
                    }

                    if (!is_minimal) {
                        content_buffer.push(this.writeString2(beatmap.artist || ""));
                        content_buffer.push(this.writeString2(beatmap.title || ""));
                        content_buffer.push(this.writeString2(beatmap.diff_name || ""));
                    }

                    content_buffer.push(this.writeString2(beatmap.md5 || ""));

                    if (version >= 4) {
                        content_buffer.push(this.writeString2(beatmap?.user_comment || ""));
                    }

                    if (version >= 8 || (version >= 5 && !is_minimal)) {
                        content_buffer.push(this.writeByte(beatmap?.mode || 0));
                    }

                    if (version >= 8 || (version >= 6 && !is_minimal)) {
                        content_buffer.push(this.writeDouble(beatmap?.difficulty_rating || 0.0));
                    }
                }

                if (version >= 3) {
                    const all_hashes = collection.hash_only_beatmaps;
                    content_buffer.push(this.writeInt(all_hashes.length));

                    for (let i = 0; i < all_hashes.length; i++) {
                        const hash = all_hashes[i];
                        content_buffer.push(this.writeString2(hash || ""));
                    }
                }
            }

            content_buffer.push(this.writeString2("By Piotrekol"));

            const final_buffer =
                version >= 7
                    ? // compress the content buffer then join
                      Buffer.from(new Uint8Array(zlib.gzipSync(this.join_buffer(content_buffer))))
                    : // otherwise, just join
                      this.join_buffer([version_buffer]);

            return { success: true, data: final_buffer };
        } catch (error) {
            return { success: false, reason: error as string };
        }
    }
}

export const osdb_parser = new OSDBParser();

export const read_osdb = (location: string): GenericResult<IOSDBData> => {
    return osdb_parser.read(location);
};

export const write_osdb = (params: WriteOSDBParams): GenericResult<string> => {
    // TODO: maybe later get version from params
    const result = osdb_parser.write(OsdbVersion.O_DM8_MIN, params.data);

    if (!result.success) {
        return { success: false, reason: result.reason };
    }

    fs.writeFileSync(params.location, result.data);

    return { success: true, data: params.location };
};
