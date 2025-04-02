const Realm = require('realm');
const fs = require('fs');

const LAZER_SCHEMA_VERSION = 48;

class PlayModeStarEntry extends Realm.Object {
    static schema = {
        name: 'PlayModeStarEntry',
        properties: {
            playMode: 'int',
            modValue: 'int',
            starValue: 'double'
        }
    };
}

// will be the new beatmap object definition (lazer and stable)
class BeatmapData {

    static schema = {

        TitleUnicode: 'string',
        TitleRoman: 'string',
        ArtistUnicode: 'string',
        ArtistRoman: 'string',
        Creator: 'string',
        DiffName: 'string',
        Mp3Name: 'string',
        Md5: 'string',
        OsuFileName: 'string',
        Tags: 'string',
        Source: 'string',
        LetterBox: 'string',
        Dir: 'string',
        State: 'int',
        Circles: 'int',
        Sliders: 'int',
        Spinners: 'int',
        ApproachRate: 'float',
        CircleSize: 'float',
        HpDrainRate: 'float',
        OverallDifficulty: 'float',
        SliderVelocity: 'float?',
        DrainingTime: 'int',
        TotalTime: 'int',
        PreviewTime: 'int',
        MapId: 'int',
        MapSetId: 'int',
        ThreadId: 'int',
        OsuGrade: 'int',
        TaikoGrade: 'int',
        CatchGrade: 'int',
        ManiaGrade: 'int',
        Offset: 'double',
        StackLeniency: 'float?',
        PlayMode: 'int',
        AudioOffset: 'int',
        Somestuff: 'int',
        BgDim: 'int',
        MaxBpm: 'double',
        MinBpm: 'double',
        MainBpm: 'double',
        Played: 'bool',
        IsOsz2: 'bool',
        DisableHitsounds: 'bool',
        DisableSkin: 'bool',
        DisableSb: 'bool',
        EditDate: 'date?',
        LastPlayed: 'date?',
        LastSync: 'date?',
        ModPpStars: 'PlayModeStarEntry[]'
    }
};

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

export const test_lazer = (path) => {

    const schemas = [
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

    return get_realm_instance(path, schemas);
}
