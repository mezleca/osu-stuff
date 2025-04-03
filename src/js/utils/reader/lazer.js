import { lazer_status, lazer_status_reversed } from './definitions.js';

const Realm = require('realm');
const fs = require('fs');

const LAZER_SCHEMA_VERSION = 48;

class BeatmapDifficulty extends Realm.Object {
    static schema = {
        name: 'BeatmapDifficulty',
        embedded: true,
        properties: {
            DrainRate: 'float',
            CircleSize: 'float',
            OverallDifficulty: 'float',
            ApproachRate: 'float',
            SliderMultiplier: 'double',
            SliderTickRate: 'double'
        }
    };
};

class BeatmapMetadata extends Realm.Object {
    static schema = {
        name: 'BeatmapMetadata',
        properties: {
            Title: 'string?',
            TitleUnicode: 'string?',
            Artist: 'string?',
            ArtistUnicode: 'string?',
            Author: "RealmUser?",
            Source: 'string?',
            Tags: 'string?',
            PreviewTime: 'int',
            AudioFile: 'string?',
            BackgroundFile: 'string?',
        }
    };
};

class BeatmapUserSettings extends Realm.Object {
    static schema = {
        name: 'BeatmapUserSettings',
        embedded: true,
        properties: {
            Offset: 'double',
        }
    };
};

class RealmUser extends Realm.Object {
    static schema = {
        name: 'RealmUser',
        embedded: true,
        properties: {
            OnlineID: 'int',
            Username: 'string?',
            CountryCode: 'string?',
        }
    };
};

class Ruleset extends Realm.Object {
    static schema = {
        name: 'Ruleset',
        primaryKey: 'ShortName',
        properties: {
            ShortName: 'string?',
            OnlineID: { type: 'int', default: -1, indexed: true, optional: false },
            Name: 'string?',
            InstantiationInfo: 'string?',
            LastAppliedDifficultyVersion: 'int',
            Available: 'bool',
        }
    };
};

class File extends Realm.Object {
    static schema = {
        name: 'File',
        primaryKey: 'Hash',
        properties: {
            Hash: 'string?',
        }
    };
};

class RealmNamedFileUsage extends Realm.Object {
    static schema = {
        name: 'RealmNamedFileUsage',
        embedded: true,
        properties: {
            File: 'File?',
            Filename: 'string?',
        }
    };
};

class BeatmapCollection extends Realm.Object {
    static schema = {
        name: 'BeatmapCollection',
        primaryKey: "ID",
        properties: {
            ID: 'uuid',
            Name: 'string?',
            BeatmapMD5Hashes: 'string?[]',
            LastModified: 'date',
        }
    };
};

class BeatmapSet extends Realm.Object {
    static schema = {
        name: 'BeatmapSet',
        primaryKey: 'ID',
        properties: {
            ID: 'uuid',
            OnlineID: { type: 'int', default: -1, indexed: true, optional: false },
            DateAdded: 'date',
            DateSubmitted: 'date?',
            DateRanked: 'date?',
            Beatmaps: 'Beatmap[]',
            Files: 'RealmNamedFileUsage[]',
            Status: { type: 'int', default: 0 },
            DeletePending: { type: 'bool', default: false },
            Hash: 'string?',
            Protected: { type: 'bool', default: false },
        }
    };
};

class Beatmap extends Realm.Object {
    static schema = {
        name: 'Beatmap',
        primaryKey: 'ID',
        properties: {
            ID: 'uuid',
            DifficultyName: 'string?',
            Ruleset: 'Ruleset',
            Difficulty: 'BeatmapDifficulty',
            Metadata: 'BeatmapMetadata',
            UserSettings: 'BeatmapUserSettings',
            BeatmapSet: 'BeatmapSet', 
            OnlineID: { type: 'int', default: -1, indexed: true, optional: false },
            Length: { type: 'double', default: 0 },
            BPM: { type: 'double', default: 0 },
            Hash: 'string?',
            StarRating: { type: 'double', default: -1 },
            MD5Hash: 'string?',
            OnlineMD5Hash: 'string?',
            LastLocalUpdate: 'date?',
            LastOnlineUpdate: 'date?',
            Status: { type: 'int', default: 0 },
            Hidden: { type: 'bool', default: false },
            EndTimeObjectCount: { type: 'int', default: -1 },
            TotalObjectCount: { type: 'int', default: -1 },
            LastPlayed: 'date?',
            BeatDivisor: { type: 'int', default: 4 },
            EditorTimestamp: 'double?',
        }
    };
};

export const get_realm_instance = (path, schemas) => {

    return new Promise((resolve, reject) => {

        if (!fs.existsSync(path)) {
            return reject("path does not exist");
        }

        const realm = new Realm({
            path: path,
            schema: [...schemas],
            schemaVersion: LAZER_SCHEMA_VERSION
        });

        resolve(realm);
    });
};

/**
 * 
 * @param {Realm} realm 
*/
export const get_lazer_beatmaps = (realm) => {
    const beatmaps = realm.objects(Beatmap);
    return beatmaps.toJSON();
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

export const all_schemas = [
    Beatmap, 
    BeatmapCollection,
    BeatmapDifficulty,
    BeatmapMetadata,
    BeatmapSet,
    BeatmapUserSettings,
    File,
    RealmNamedFileUsage,
    RealmUser,
    Ruleset,
];
