const Realm = require("realm");

export class BeatmapDifficulty extends Realm.Object {
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

export class BeatmapMetadata extends Realm.Object {
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

export class BeatmapUserSettings extends Realm.Object {
    static schema = {
        name: 'BeatmapUserSettings',
        embedded: true,
        properties: {
            Offset: 'double',
        }
    };
};

export class RealmUser extends Realm.Object {
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

export class Ruleset extends Realm.Object {
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

export class File extends Realm.Object {
    static schema = {
        name: 'File',
        primaryKey: 'Hash',
        properties: {
            Hash: 'string?',
        }
    };
};

export class RealmNamedFileUsage extends Realm.Object {
    static schema = {
        name: 'RealmNamedFileUsage',
        embedded: true,
        properties: {
            File: 'File?',
            Filename: 'string?',
        }
    };
};

export class BeatmapCollection extends Realm.Object {
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

export class BeatmapSet extends Realm.Object {
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

export class Beatmap extends Realm.Object {
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
