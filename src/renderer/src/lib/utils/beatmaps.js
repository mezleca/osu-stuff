import { get_beatmap_status_code, get_code_by_mode, osu_beatmaps } from "../store/beatmaps";

const RENAME_MAP = {
    difficulty_rating: "star",
    hit_length: "length",
    version: "difficulty",
    id: "difficulty_id",
    checksum: "md5",
    accuracy: "od",
    drain: "hp",
    creator: "mapper"
};

const get_beatmap = async (id, is_unique_id) => {
    const cached = osu_beatmaps.get(id);

    if (cached) {
        return cached;
    }

    const result = await window.osu.get_beatmap(id, is_unique_id);

    if (!result) {
        return {};
    }

    osu_beatmaps.add(id, result.beatmap);
    return result.beatmap;
};

export const get_beatmap_data = async (md5) => {
    if (typeof md5 == "object") return md5; // discover
    return await get_beatmap(md5, false);
};

export const get_by_unique_id = async (id) => {
    return await get_beatmap(id, true);
};

export const convert_beatmap_keys = (beatmap) => {
    const processed = { ...beatmap };
    const mode = get_code_by_mode(processed.mode);

    for (const [old_key, new_key] of Object.entries(RENAME_MAP)) {
        if (processed.hasOwnProperty(old_key)) {
            // hack for sr
            if (old_key == "difficulty_rating") {
                processed.star_rating = new Array(4).fill({ pair: [], nm: -1 });
                processed.star_rating[mode] = {
                    nm: processed.difficulty_rating,
                    pair: [0, processed.difficulty_rating]
                };
            } else {
                processed[new_key] = processed[old_key];
            }

            // delete old key
            delete processed[old_key];
        }
    }

    processed.status = get_beatmap_status_code(processed.status) || 0;
    processed.mode = mode;

    return processed;
};
