import { fs } from "../global.js";

const LAZER_SCHEMA_VERSION = 48;

export const get_realm_instance = (path, schemas) => {

    return new Promise(async (resolve, reject) => {

        if (!fs.existsSync(path)) {
            return reject("path does not exist");
        }

        const realm = await window.realmjs.openRealm(path, schemas, LAZER_SCHEMA_VERSION);
        resolve(realm);
    });
};

export const get_lazer_beatmaps = (realm) => {
    const beatmaps = window.realmjs.objects(realm, "Beatmap");
    return beatmaps;
};

export const convert_lazer_to_stable = (lazer_beatmaps) => {

    const beatmaps = new Map();

    for (let i = 0; i < lazer_beatmaps.length; i++) {

        const beatmap = lazer_beatmaps[i];

        if (!beatmap.MD5Hash) {
            return;
        }
        
        const timing_points = [];
        const sr = [];
        
        const modes = {
            0: "osu!",
            1: "taiko",
            2: "ctb",
            3: "mania"
        };

        for (let i = 0; i < 4; i++) {
            sr.push({
                mode: modes[i],
                sr: [[0, beatmap.StarRating]]
            });
        }
        
        const data = {
            beatmap_start: 0, 
            entry: 0, 
            artist_name: beatmap.Metadata?.Artist || "",
            artist_name_unicode: beatmap.Metadata?.ArtistUnicode || "",
            song_title: beatmap.Metadata?.Title || "",
            song_title_unicode: beatmap.Metadata?.TitleUnicode || "",
            mapper: beatmap.Metadata?.Author?.Username || "",
            difficulty: beatmap.DifficultyName || "",
            audio_file_name: beatmap.Metadata?.AudioFile || "",
            md5: beatmap.MD5Hash,
            file: beatmap.Hash || "",
            status: beatmap.Status || 0,
            beatmapset: beatmap.BeatmapSet,
            hitcircle: beatmap.TotalObjectCount || 0,
            bpm: beatmap.BPM || 0,
            sliders: 0,
            spinners: 0,
            last_modification: beatmap.LastLocalUpdate ? beatmap.LastLocalUpdate.getTime() : 0,
            approach_rate: beatmap.Difficulty?.ApproachRate || 0,
            circle_size: beatmap.Difficulty?.CircleSize || 0,
            hp: beatmap.Difficulty?.DrainRate || 0,
            od: beatmap.Difficulty?.OverallDifficulty || 0,
            slider_velocity: beatmap.Difficulty?.SliderMultiplier || 0,
            sr: sr,
            star_rating: beatmap.StarRating || 0, 
            drain_time: beatmap.Length || 0,
            total_time: beatmap.Length || 0,
            audio_preview: beatmap.Metadata?.PreviewTime || 0,
            timing_points_length: timing_points.length,
            timing_points: timing_points,
            difficulty_id: beatmap.OnlineID || -1,
            beatmap_id: beatmap.BeatmapSet.OnlineID || -1,
            thread_id: -1,
            grade_standard: 0, 
            grade_taiko: 0, 
            grade_ctb: 0, 
            grade_mania: 0, 
            local_offset: beatmap.UserSettings?.Offset || 0,
            stack_leniency: 0.7,
            mode: beatmap.Ruleset?.OnlineID || 0,
            source: beatmap.Metadata?.Source || "",
            tags: beatmap.Metadata?.Tags || "",
            online_offset: 0, 
            font: "",
            unplayed: !beatmap.LastPlayed,
            last_played: beatmap.LastPlayed ? beatmap.LastPlayed.getTime() : 0,
            is_osz2: false,
            folder_name: "",
            last_checked: 0, 
            ignore_sounds: false, 
            ignore_skin: false, 
            disable_storyboard: false, 
            disable_video: false, 
            visual_override: false, 
            last_modified: beatmap.LastLocalUpdate ? Math.floor(beatmap.LastLocalUpdate.getTime() / 1000) : 0,
            mania_scroll_speed: 0, 
            beatmap_end: 0 
        };
        
        beatmaps.set(data.md5, data);
    }
    
    return beatmaps;
};

export const lazer_to_osu_db = (instance) => {
    
    const lazer_beatmaps = get_lazer_beatmaps(instance);
    const converted_beatmaps = convert_lazer_to_stable(lazer_beatmaps);
    
    return {
        version: LAZER_SCHEMA_VERSION,
        folders: 0, 
        account_unlocked: true,
        last_unlocked_time: Date.now(),
        player_name: "",
        beatmaps_count: converted_beatmaps.size,
        beatmaps: converted_beatmaps,
        extra_start: 0, 
        permission_id: 0 
    };
};
