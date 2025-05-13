export const osdb_schema = {
    // TODO
};

export const osdb_versions = {
    "o!dm": 1,
    "o!dm2": 2,
    "o!dm3": 3,
    "o!dm4": 4,
    "o!dm5": 5,
    "o!dm6": 6,
    "o!dm7": 7,
    "o!dm8": 8,
    "o!dm7min": 1007,
    "o!dm8min": 1008,
};

export const beatmaps_schema = {
    beatmap_start: Number,
    entry: Number,
    artist: String,
    artist_unicode: String,
    title: String,
    title_unicode: String,
    mapper: String,
    difficulty: String,
    audio_file_name: String,
    md5: String,
    file: String,
    status: Number,
    hitcircle: Number,
    sliders: Number,
    spinners: Number,
    last_modification: Number,
    ar: Number,
    cs: Number,
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
    length: Number,
    audio_preview: Number,
    difficulty_id: Number,
    beatmapset_id: Number,
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
    bpm_max: Number,
    sr_max: Number,
    maps: new Set([String])
};

export const collections_db = {
    version: Number,
    length: Number,
    beatmaps: new Map()
};

export const permissions = {
    0: "None",
    1: "Normal",
    2: "Moderator",
    4: "Supporter",
    8: "Friend",
    16: "Peppy",
    32: "World Cup Staff"
};

export const beatmap_status = {
    "all": -1,
    "unknown": 0,
    "unsubmitted": 1,
    "graveyard": 2,
    "wip": 2,
    "pending": 2,
    "unused": 3,
    "ranked": 4,
    "approved": 5,
    "qualified":6,
    "loved": 7
}

export const beatmap_status_reversed = {
    "-1": "all",
    "0": "unknown",
    "1": "unsubmitted",
    "2": "pending", 
    "3": "unused",
    "4": "ranked",
    "5": "approved",
    "6": "qualified",
    "7": "loved"
}

export const lazer_status = {
    "LocallyModified": -4,
    "None": -3,
    "Graveyard": -2,
    "WIP": -1,
    "Pending": 0,
    "Ranked": 1,
    "Approved": 2,
    "Qualified": 3,
    "Loved": 4
}

export const lazer_status_reversed = {
    "-4": "LocallyModified",
    "-3": "None",
    "-2": "Graveyard",
    "-1": "WIP",
    "0": "Pending",
    "1": "Ranked",
    "2": "Approved",
    "3": "Qualified",
    "4": "Loved"
}
