import type { OsdbData } from "@shared/types";
import { BinaryReader } from "./binary_reader";

import fs from "fs";
import zlib from "zlib";

const OSDB_FOOTER = "By Piotrekol";

const map_version_to_code = (version: string): number => {
    switch (version) {
        case "o!dm":
            return 1;
        case "o!dm2":
            return 2;
        case "o!dm3":
            return 3;
        case "o!dm4":
            return 4;
        case "o!dm5":
            return 5;
        case "o!dm6":
            return 6;
        case "o!dm7":
            return 7;
        case "o!dm8":
            return 8;
        case "o!dm7min":
            return 1007;
        case "o!dm8min":
            return 1008;
        default:
            return 1;
    }
};

const is_minimal_version = (version: string): boolean => {
    return version.endsWith("min");
};

const uses_gzip_payload = (version_code: number): boolean => {
    return version_code >= 7;
};

export class OsdbParser extends BinaryReader {
    private location: string = "";
    private data: OsdbData = {
        version_string: "o!dm8min",
        save_data: 0n,
        last_editor: "",
        count: 0,
        collections: []
    };

    parse = async (location: string): Promise<this> => {
        const raw = fs.readFileSync(location);
        this.location = location;
        this.set_buffer(raw);

        const version_string = this.plain_string();
        const version_code = map_version_to_code(version_string);

        if (uses_gzip_payload(version_code)) {
            const compressed = this.buffer.subarray(this.offset);
            const uncompressed = zlib.gunzipSync(compressed);
            this.set_buffer(uncompressed);
            this.plain_string();
        }

        const is_minimal = is_minimal_version(version_string);

        const save_data = this.long();
        const last_editor = this.plain_string();
        const count = this.int();
        const collections: OsdbData["collections"] = [];

        for (let collection_index = 0; collection_index < count; collection_index++) {
            const name = this.plain_string();
            const online_id = version_code >= 7 ? this.int() : 0;
            const beatmaps_count = this.int();
            const beatmaps: OsdbData["collections"][number]["beatmaps"] = [];

            for (let beatmap_index = 0; beatmap_index < beatmaps_count; beatmap_index++) {
                const difficulty_id = this.int();
                const beatmapset_id = version_code >= 2 ? this.int() : -1;

                const artist = is_minimal ? "" : this.plain_string();
                const title = is_minimal ? "" : this.plain_string();
                const difficulty = is_minimal ? "" : this.plain_string();
                const checksum = this.plain_string();

                const user_comment = version_code >= 4 ? this.plain_string() : "";
                const mode = version_code >= 8 || (version_code >= 5 && !is_minimal) ? this.byte() : 0;
                const difficulty_rating = version_code >= 8 || (version_code >= 6 && !is_minimal) ? this.double() : 0;

                beatmaps.push({
                    difficulty_id,
                    beatmapset_id,
                    artist,
                    title,
                    difficulty,
                    checksum,
                    user_comment,
                    mode,
                    difficulty_rating
                });
            }

            const hash_only_beatmaps: string[] = [];
            if (version_code >= 3) {
                const hashes_count = this.int();
                for (let hash_index = 0; hash_index < hashes_count; hash_index++) {
                    hash_only_beatmaps.push(this.plain_string());
                }
            }

            collections.push({
                name,
                online_id,
                beatmaps,
                hash_only_beatmaps
            });
        }

        const footer = this.plain_string();
        if (footer != OSDB_FOOTER) {
            throw new Error("invalid osdb footer");
        }

        this.data = {
            version_string,
            save_data,
            last_editor,
            count,
            collections
        };

        return this;
    };

    get = (): OsdbData => {
        return {
            version_string: this.data.version_string,
            save_data: this.data.save_data,
            last_editor: this.data.last_editor,
            count: this.data.count,
            collections: this.data.collections.map((collection) => ({
                name: collection.name,
                online_id: collection.online_id,
                beatmaps: collection.beatmaps.map((beatmap) => ({ ...beatmap })),
                hash_only_beatmaps: [...collection.hash_only_beatmaps]
            }))
        };
    };

    update = (patch: Partial<OsdbData>): this => {
        this.data = {
            ...this.data,
            ...patch,
            collections: patch.collections
                ? patch.collections.map((collection) => ({
                      name: collection.name,
                      online_id: collection.online_id,
                      beatmaps: collection.beatmaps.map((beatmap) => ({ ...beatmap })),
                      hash_only_beatmaps: [...collection.hash_only_beatmaps]
                  }))
                : this.data.collections
        };

        this.data.count = this.data.collections.length;
        return this;
    };

    write = async (): Promise<void> => {
        if (!this.location) {
            throw new Error("osdb parser has no target location");
        }

        const version_string = this.data.version_string || "o!dm8min";
        const version_code = map_version_to_code(version_string);
        const is_minimal = is_minimal_version(version_string);

        const payload: Buffer[] = [];
        payload.push(this.write_long(this.data.save_data));
        payload.push(this.write_plain_string(this.data.last_editor));
        payload.push(this.write_int(this.data.collections.length));

        for (const collection of this.data.collections) {
            payload.push(this.write_plain_string(collection.name));

            if (version_code >= 7) {
                payload.push(this.write_int(collection.online_id || 0));
            }

            payload.push(this.write_int(collection.beatmaps.length));

            for (const beatmap of collection.beatmaps) {
                payload.push(this.write_int(beatmap.difficulty_id || 0));

                if (version_code >= 2) {
                    payload.push(this.write_int(beatmap.beatmapset_id || 0));
                }

                if (!is_minimal) {
                    payload.push(this.write_plain_string(beatmap.artist || ""));
                    payload.push(this.write_plain_string(beatmap.title || ""));
                    payload.push(this.write_plain_string(beatmap.difficulty || ""));
                }

                payload.push(this.write_plain_string(beatmap.checksum || ""));

                if (version_code >= 4) {
                    payload.push(this.write_plain_string(beatmap.user_comment || ""));
                }

                if (version_code >= 8 || (version_code >= 5 && !is_minimal)) {
                    payload.push(this.write_byte(beatmap.mode || 0));
                }

                if (version_code >= 8 || (version_code >= 6 && !is_minimal)) {
                    payload.push(this.write_double(beatmap.difficulty_rating || 0));
                }
            }

            if (version_code >= 3) {
                payload.push(this.write_int(collection.hash_only_beatmaps.length));

                for (const hash of collection.hash_only_beatmaps) {
                    payload.push(this.write_plain_string(hash || ""));
                }
            }
        }

        payload.push(this.write_plain_string(OSDB_FOOTER));

        const version_buffer = this.write_plain_string(version_string);
        const payload_buffer = this.join_buffer(payload);

        if (uses_gzip_payload(version_code)) {
            const inner = this.join_buffer([version_buffer, payload_buffer]);
            const compressed = zlib.gzipSync(inner);
            const output = this.join_buffer([version_buffer, Buffer.from(compressed)]);
            fs.writeFileSync(this.location, output);
            return;
        }

        const output = this.join_buffer([version_buffer, payload_buffer]);
        fs.writeFileSync(this.location, output);
    };

    free = (): void => {
        this.location = "";
        this.set_buffer(Buffer.alloc(0));
        this.data = {
            version_string: "o!dm8min",
            save_data: 0n,
            last_editor: "",
            count: 0,
            collections: []
        };
    };
}
