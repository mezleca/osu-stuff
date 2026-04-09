import { gamemode_from_code, stable_status_from_code, type IBeatmapResult } from "@shared/types";
import { BinaryReader } from "./binary_reader";

import fs from "fs";

const NEW_STAR_RATING_VERSION = 20250107;
const OLD_AR_CS_HP_OD_VERSION = 20140609;
const ENTRY_SIZE_VERSION = 20191106;

export interface OsuDbHeader {
    version: number;
    folder_count: number;
    account_unlocked: number;
    account_unlock_time: bigint;
    player_name: string;
    beatmaps_count: number;
    permissions: number;
}

export interface OsuCollection {
    name: string;
    beatmaps_count: number;
    beatmap_md5: string[];
}

export interface OsuCollectionDb {
    version: number;
    collections_count: number;
    collections: OsuCollection[];
}

// https://github.com/ppy/osu/blob/775cdc087eda5c1525d763c6fa3d422db0e93f66/osu.Game/Beatmaps/Beatmap.cs#L81
export const get_common_bpm = (timing_points: Array<{ beat_length: number; offset: number; inherited: boolean }>, length: number) => {
    if (!timing_points || timing_points?.length == 0) {
        return 0;
    }

    const beat_length_map = new Map();
    const last_time = length > 0 ? length : timing_points[timing_points.length - 1].offset;

    for (let i = 0; i < timing_points.length; i++) {
        const point = timing_points[i];

        if (point.offset > last_time) {
            continue;
        }

        const bpm = Math.round((60000 / point.beat_length) * 1000) / 1000;
        const current_time = i == 0 ? 0 : point.offset;
        const next_time = i == timing_points.length - 1 ? last_time : timing_points[i + 1].offset;
        const duration = next_time - current_time;

        beat_length_map.set(bpm, (beat_length_map.get(bpm) || 0) + duration);
    }

    return [...beat_length_map.entries()].reduce((max, [bpm, duration]) => (duration > max.duration ? { bpm, duration } : max), {
        bpm: 0,
        duration: 0
    }).bpm;
};

export class OsuDbParser extends BinaryReader {
    private header: OsuDbHeader = {
        version: 0,
        folder_count: 0,
        account_unlocked: 0,
        account_unlock_time: 0n,
        player_name: "",
        beatmaps_count: 0,
        permissions: 0
    };

    private beatmaps: IBeatmapResult[] = [];

    parse = async (location: string): Promise<this> => {
        const buffer = fs.readFileSync(location);
        this.set_buffer(buffer);

        const version = this.int();
        const folder_count = this.int();
        const account_unlocked = this.byte();
        const account_unlock_time = this.long();
        const player_name = this.osu_string();
        const beatmaps_count = this.int();

        const beatmaps: IBeatmapResult[] = [];

        for (let index = 0; index < beatmaps_count; index++) {
            beatmaps.push(this.read_beatmap(version));
        }

        const permissions = this.int();

        this.header = {
            version,
            folder_count,
            account_unlocked,
            account_unlock_time,
            player_name,
            beatmaps_count,
            permissions
        };

        this.beatmaps = beatmaps;
        return this;
    };

    private read_beatmap = (version: number): IBeatmapResult => {
        if (version < ENTRY_SIZE_VERSION) {
            this.int();
        }

        const artist = this.osu_string();
        this.osu_string();
        const title = this.osu_string();
        this.osu_string();
        const creator = this.osu_string();
        const difficulty = this.osu_string();
        const audio_file_name = this.osu_string();
        const md5 = this.osu_string();
        const osu_file_name = this.osu_string();
        const ranked_status = this.byte(true);

        this.short();
        this.short();
        this.short();

        const last_modification_time = this.long();
        const use_old_stats = version < OLD_AR_CS_HP_OD_VERSION;

        const approach_rate = use_old_stats ? this.byte() : this.single();
        const circle_size = use_old_stats ? this.byte() : this.single();
        const hp_drain = use_old_stats ? this.byte() : this.single();
        const overall_difficulty = use_old_stats ? this.byte() : this.single();

        this.double();

        const star_ratings = this.read_star_rating_groups(version);
        this.int();
        const total_time = this.int();
        this.int();

        const timing_points_count = this.int();
        const timing_points: Array<{ beat_length: number; offset: number; inherited: boolean }> = [];

        for (let index = 0; index < timing_points_count; index++) {
            timing_points.push({
                beat_length: this.double(),
                offset: this.double(),
                inherited: this.bool()
            });
        }

        const online_id = this.int();
        const beatmapset_id = this.int();

        this.int();
        this.byte();
        this.byte();
        this.byte();
        this.byte();
        this.short();
        this.single();

        const mode_code = this.byte();
        const source = this.osu_string();
        const tags = this.osu_string();

        this.short();
        this.osu_string();
        this.bool();
        this.long();
        this.bool();

        const folder_name = this.osu_string();

        this.long();
        this.bool();
        this.bool();
        this.bool();
        this.bool();
        this.bool();

        if (version < OLD_AR_CS_HP_OD_VERSION) {
            this.short();
        }

        this.int();
        this.byte();

        const mode_index = mode_code >= 0 && mode_code < star_ratings.length ? mode_code : 0;
        const status = stable_status_from_code(ranked_status);
        const mode = gamemode_from_code(mode_code);

        return {
            md5,
            online_id,
            beatmapset_id,
            title,
            artist,
            creator,
            difficulty,
            source,
            tags,
            mode,
            status,
            length: total_time,
            duration: -1,
            last_modified: String(last_modification_time),
            ar: approach_rate,
            cs: circle_size,
            hp: hp_drain,
            od: overall_difficulty,
            bpm: get_common_bpm(timing_points, total_time),
            star_rating: star_ratings[mode_index] ?? 0,
            temp: false,
            file_path: `${folder_name}/${osu_file_name}`,
            folder_name,
            file_name: osu_file_name,
            background: "",
            audio: audio_file_name
        };
    };

    private read_star_rating_groups = (version: number): number[] => {
        const result = [0, 0, 0, 0];
        const is_new_version = version >= NEW_STAR_RATING_VERSION;

        for (let mode = 0; mode < 4; mode++) {
            const count = this.int();
            let fallback = 0;

            for (let index = 0; index < count; index++) {
                this.byte();
                const mod_combination = this.int();
                this.byte();
                const star_rating = is_new_version ? this.single() : this.double();

                if (index == 0) {
                    fallback = star_rating;
                }

                if (mod_combination == 0) {
                    result[mode] = star_rating;
                }
            }

            if (result[mode] == 0) {
                result[mode] = fallback;
            }
        }

        return result;
    };

    get = (): OsuDbHeader & { beatmaps: IBeatmapResult[] } => {
        return {
            ...this.header,
            beatmaps: [...this.beatmaps]
        };
    };

    get_header = (): OsuDbHeader => {
        return { ...this.header };
    };

    get_minimal_list = (): IBeatmapResult[] => {
        return [...this.beatmaps];
    };

    update = (_patch: unknown): this => {
        return this;
    };

    write = async (): Promise<void> => {
        return;
    };

    free = (): void => {
        this.set_buffer(Buffer.alloc(0));
        this.header = {
            version: 0,
            folder_count: 0,
            account_unlocked: 0,
            account_unlock_time: 0n,
            player_name: "",
            beatmaps_count: 0,
            permissions: 0
        };
        this.beatmaps = [];
    };
}

export class OsuCollectionDbParser extends BinaryReader {
    private location: string = "";
    private data: OsuCollectionDb = {
        version: 0,
        collections_count: 0,
        collections: []
    };

    parse = async (location: string): Promise<this> => {
        const buffer = fs.readFileSync(location);
        this.set_buffer(buffer);

        const version = this.int();
        const collections_count = this.int();
        const collections: OsuCollection[] = [];

        for (let index = 0; index < collections_count; index++) {
            const name = this.osu_string();
            const beatmaps_count = this.int();
            const beatmap_md5: string[] = [];

            for (let map_index = 0; map_index < beatmaps_count; map_index++) {
                beatmap_md5.push(this.osu_string());
            }

            collections.push({
                name,
                beatmaps_count,
                beatmap_md5
            });
        }

        this.location = location;
        this.data = {
            version,
            collections_count,
            collections
        };

        return this;
    };

    get = (): OsuCollectionDb => {
        return {
            version: this.data.version,
            collections_count: this.data.collections_count,
            collections: this.data.collections.map((collection) => ({
                name: collection.name,
                beatmaps_count: collection.beatmaps_count,
                beatmap_md5: [...collection.beatmap_md5]
            }))
        };
    };

    update = (patch: Partial<OsuCollectionDb>): this => {
        this.data = {
            ...this.data,
            ...patch,
            collections: patch.collections
                ? patch.collections.map((collection) => ({
                      name: collection.name,
                      beatmaps_count: collection.beatmaps_count,
                      beatmap_md5: [...collection.beatmap_md5]
                  }))
                : this.data.collections
        };

        this.data.collections_count = this.data.collections.length;
        return this;
    };

    write = async (): Promise<void> => {
        if (!this.location) {
            throw new Error("collection parser has no target location");
        }

        const chunks: Buffer[] = [];

        chunks.push(this.write_int(this.data.version));
        chunks.push(this.write_int(this.data.collections.length));

        for (const collection of this.data.collections) {
            chunks.push(this.write_osu_string(collection.name));
            chunks.push(this.write_int(collection.beatmap_md5.length));

            for (const md5 of collection.beatmap_md5) {
                chunks.push(this.write_osu_string(md5));
            }
        }

        fs.writeFileSync(this.location, this.join_buffer(chunks));
    };

    free = (): void => {
        this.location = "";
        this.set_buffer(Buffer.alloc(0));
        this.data = {
            version: 0,
            collections_count: 0,
            collections: []
        };
    };
}
