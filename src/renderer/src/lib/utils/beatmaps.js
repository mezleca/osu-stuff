import { osu_beatmaps } from "../store/beatmaps";

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
    return await get_beatmap(md5, false);
};

export const get_by_unique_id = async (id) => {
    return await get_beatmap(id, true);
};
