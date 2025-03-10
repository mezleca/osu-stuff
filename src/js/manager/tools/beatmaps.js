import { gamemodes } from "../../utils/global.js";

export const get_beatmap_sr = (beatmap) => {

    try {

        const nomod = 0;
        const beatmap_sr = beatmap?.sr;

        if (!beatmap_sr || beatmap_sr?.length == 0) {
            return 0;
        }

        for (let i = 0; i < beatmap_sr.length; i++) {

            const sr = beatmap_sr[i];

            if (beatmap.mode != gamemodes[sr.mode]) {
                continue;
            }

            const star_rating = Number(sr.sr[nomod][1]);

            if (Math.sign(star_rating) == -1) { 
                return (star_rating * -1).toFixed(2);
            }
                    
            return star_rating.toFixed(2);
        }
    
        return 0;
    } catch(err) {
        console.log(err);
        return 0;
    }  
};

// https://github.com/ppy/osu/blob/775cdc087eda5c1525d763c6fa3d422db0e93f66/osu.Game/Beatmaps/Beatmap.cs#L81
export const get_beatmap_bpm = (beatmap) => {
    
    if (!beatmap.timing_points || beatmap.timing_points.length == 0) {
        return 0;
    }

    const beat_length_map = {};

    const timing_points = [...beatmap.timing_points].sort((a, b) => a.offset - b.offset);
    const last_time = beatmap.total_time > 0 
      ? beatmap.total_time 
      : timing_points[timing_points.length - 1].offset;
  
    timing_points.forEach((point, index) => {

        const beat_length = Math.round((60000 / point.beat_length) * 1000) / 1000;     

        if (point.offset > last_time) {
            return;
        }
        
        const current_time = index == 0 ? 0 : point.offset;
        const next_time = index == timing_points.length - 1 ? last_time : timing_points[index + 1].offset;
        beat_length_map[beat_length] = (beat_length_map[beat_length] || 0) + (next_time - current_time);
    });
    
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
