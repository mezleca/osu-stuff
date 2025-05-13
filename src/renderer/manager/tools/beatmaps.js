import { gamemodes } from "../../utils/global.js";

export const get_beatmap_sr = (beatmap) => {

    try {

        const nomod = 0;
        const beatmap_sr = beatmap?.sr || beatmap?.star;

        if (typeof beatmap_sr == "number") {
            return beatmap_sr.toFixed(2);
        }

        if (!beatmap_sr || beatmap_sr?.length == 0) {
            return Number(0).toFixed(2);
        }

        for (let i = 0; i < beatmap_sr.length; i++) {

            const sr = beatmap_sr[i];

            if (beatmap.mode != gamemodes[sr.mode]) {
                continue;
            }

            if (sr?.sr?.length == 0) {
                continue;
            }

            const star_rating = Number(sr.sr[nomod][1]);

            if (Math.sign(star_rating) == -1) { 
                return (star_rating * -1).toFixed(2);
            }
                    
            return star_rating.toFixed(2);
        }
    
        return Number(0).toFixed(2);
    } catch(err) {
        console.log(err);
        return Number(0).toFixed(2);
    }  
};

// https://github.com/ppy/osu/blob/775cdc087eda5c1525d763c6fa3d422db0e93f66/osu.Game/Beatmaps/Beatmap.cs#L81
export const get_beatmap_bpm = (beatmap) => {
    
    if (!beatmap?.timing_points || beatmap?.timing_points.length == 0) {
        return 0;
    }

    const beat_length_map = {};

    const timing_points = [...beatmap.timing_points].sort((a, b) => a.offset - b.offset);
    const last_time = beatmap.length > 0 
      ? beatmap.length 
      : timing_points[timing_points.length - 1].offset;

    for (let i = 0; i < timing_points.length; i++) {
        
        const beat_length = Math.round((60000 / timing_points[i].beat_length) * 1000) / 1000;     

        if (timing_points[i].offset > last_time) {
            continue;
        }
        
        const current_time = i == 0 ? 0 : timing_points[i].offset;
        const next_time = i == timing_points.length - 1 ? last_time : timing_points[i + 1].offset;
        beat_length_map[beat_length] = (beat_length_map[beat_length] || 0) + (next_time - current_time);
    }
    
    let most_common_beat_length = 0;
    let longest_duration = 0;
    
    for (const [beat_length, duration] of Object.entries(beat_length_map)) {
        if (duration > longest_duration) {
            most_common_beat_length = parseFloat(beat_length);
            longest_duration = duration;
        }
    }
    
    return most_common_beat_length;
}
