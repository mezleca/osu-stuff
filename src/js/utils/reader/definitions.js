export const osdb_schema = {
    // TODO
};

export const beatmaps_schema = {
    beatmap_start: Number,
    entry: Number,
    artist_name: String,
    artist_name_unicode: String,
    song_title: String,
    song_title_unicode: String,
    creator_name: String,
    difficulty: String,
    audio_file_name: String,
    md5: String,
    file: String,
    status: Number,
    hitcircle: Number,
    sliders: Number,
    spinners: Number,
    last_modification: Number,
    approach_rate: Number,
    circle_size: Number,
    hp: Number,
    od: Number,
    slider_velocity: Number,
    sr: [
        {
            mode: String,
            sr: [
                {
                    mod: Number,
                    diff: Number
                }
            ]
        }
    ],
    timing_points: [
        {
            bpm: Number,
            offset: Number,
            idk_bool: Boolean | String
        }
    ],
    drain_time: Number,
    total_time: Number,
    audio_preview: Number,
    difficulty_id: Number,
    beatmap_id: Number,
    thread_id: Number,
    grade_standard: Number,
    grade_taiko: Number,
    grade_ctb: Number,
    grade_mania: Number,
    local_offset: Number,
    stack_leniency: Number,
    mode: Number,
    source: String,
    tags: String,
    online_offset: Number,
    font: String,
    unplayed: Boolean,
    last_played: Number,
    is_osz2: Boolean,
    folder_name: String,
    last_checked: Number,
    ignore_sounds: Boolean,
    ignore_skin: Boolean,
    disable_storyboard: Boolean,
    disable_video: Boolean,
    visual_override: Boolean,
    unknown: Number,
    last_modified: Number,
    mania_scroll_speed: Number,
    beatmap_end: Number
};

export const osu_db = {
    version: Number,
    folders: Number,
    account_unlocked: Boolean,
    last_unlocked_time: Number,
    player_name: String,
    beatmaps_count: Number,
    beatmaps: new Map(),
    extra_start: Number,
    permissions_id: Number,
    permission: String
};

export const collection_beatmap = {
    name: String,
    maps: Array
};

export const collections_db = {
    version: Number,
    length: Number,
    beatmaps: [collection_beatmap]
};