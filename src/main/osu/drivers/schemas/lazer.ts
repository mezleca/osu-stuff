import Realm from "realm";

export class BeatmapDifficultySchema extends Realm.Object<BeatmapDifficultySchema> {
    DrainRate!: number;
    CircleSize!: number;
    OverallDifficulty!: number;
    ApproachRate!: number;
    SliderMultiplier!: number;
    SliderTickRate!: number;

    static schema = {
        name: "BeatmapDifficulty",
        embedded: true,
        properties: {
            DrainRate: "float",
            CircleSize: "float",
            OverallDifficulty: "float",
            ApproachRate: "float",
            SliderMultiplier: "double",
            SliderTickRate: "double"
        }
    };
}

export class BeatmapMetadataSchema extends Realm.Object<BeatmapMetadataSchema> {
    Title!: string | null;
    TitleUnicode!: string | null;
    Artist!: string | null;
    ArtistUnicode!: string | null;
    Author!: RealmUserSchema | null;
    Source!: string | null;
    Tags!: string | null;
    PreviewTime!: number;
    AudioFile!: string | null;
    BackgroundFile!: string | null;
    UserTags!: string[];

    static schema = {
        name: "BeatmapMetadata",
        properties: {
            Title: "string?",
            TitleUnicode: "string?",
            Artist: "string?",
            ArtistUnicode: "string?",
            Author: "RealmUser?",
            Source: "string?",
            Tags: "string?",
            PreviewTime: "int",
            AudioFile: "string?",
            BackgroundFile: "string?",
            UserTags: "string?[]"
        }
    };
}

export class BeatmapUserSettingsSchema extends Realm.Object<BeatmapUserSettingsSchema> {
    Offset!: number;

    static schema = {
        name: "BeatmapUserSettings",
        embedded: true,
        properties: {
            Offset: "double"
        }
    };
}

export class RealmUserSchema extends Realm.Object<RealmUserSchema> {
    OnlineID!: number;
    Username!: string | null;
    CountryCode!: string | null;

    static schema = {
        name: "RealmUser",
        embedded: true,
        properties: {
            OnlineID: "int",
            Username: "string?",
            CountryCode: "string?"
        }
    };
}

export class RulesetSchema extends Realm.Object<RulesetSchema> {
    ShortName!: string | null;
    OnlineID!: number;
    Name!: string | null;
    InstantiationInfo!: string | null;
    LastAppliedDifficultyVersion!: number;
    Available!: boolean;

    static schema = {
        name: "Ruleset",
        primaryKey: "ShortName",
        properties: {
            ShortName: "string?",
            OnlineID: { type: "int", default: -1, indexed: true, optional: false },
            Name: "string?",
            InstantiationInfo: "string?",
            LastAppliedDifficultyVersion: "int",
            Available: "bool"
        }
    };
}

export class FileSchema extends Realm.Object<FileSchema> {
    Hash!: string | null;

    static schema = {
        name: "File",
        primaryKey: "Hash",
        properties: {
            Hash: "string?"
        }
    };
}

export class RealmNamedFileUsageSchema extends Realm.Object<RealmNamedFileUsageSchema> {
    File!: FileSchema | null;
    Filename!: string | null;

    static schema = {
        name: "RealmNamedFileUsage",
        embedded: true,
        properties: {
            File: "File?",
            Filename: "string?"
        }
    };
}

export class BeatmapCollectionSchema extends Realm.Object<BeatmapCollectionSchema> {
    ID!: Realm.BSON.UUID;
    Name!: string | null;
    BeatmapMD5Hashes!: string[];
    LastModified!: Date;

    static schema = {
        name: "BeatmapCollection",
        primaryKey: "ID",
        properties: {
            ID: "uuid",
            Name: "string?",
            BeatmapMD5Hashes: "string?[]",
            LastModified: "date"
        }
    };
}

export class BeatmapSetSchema extends Realm.Object<BeatmapSetSchema> {
    ID!: Realm.BSON.UUID;
    OnlineID!: number;
    DateAdded!: Date;
    DateSubmitted!: Date | null;
    DateRanked!: Date | null;
    Beatmaps!: Realm.List<BeatmapSchema>;
    Files!: Realm.List<RealmNamedFileUsageSchema>;
    Status!: number;
    DeletePending!: boolean;
    Hash!: string | null;
    Protected!: boolean;

    static schema = {
        name: "BeatmapSet",
        primaryKey: "ID",
        properties: {
            ID: "uuid",
            OnlineID: { type: "int", default: -1, indexed: true, optional: false },
            DateAdded: "date",
            DateSubmitted: "date?",
            DateRanked: "date?",
            Beatmaps: "Beatmap[]",
            Files: "RealmNamedFileUsage[]",
            Status: { type: "int", default: 0 },
            DeletePending: { type: "bool", default: false },
            Hash: "string?",
            Protected: { type: "bool", default: false }
        }
    };
}

export class BeatmapSchema extends Realm.Object<BeatmapSchema> {
    ID!: Realm.BSON.UUID;
    DifficultyName!: string | null;
    Ruleset!: RulesetSchema;
    Difficulty!: BeatmapDifficultySchema;
    Metadata!: BeatmapMetadataSchema;
    UserSettings!: BeatmapUserSettingsSchema;
    BeatmapSet!: BeatmapSetSchema;
    OnlineID!: number;
    Length!: number;
    BPM!: number;
    Hash!: string | null;
    StarRating!: number;
    MD5Hash!: string | null;
    OnlineMD5Hash!: string | null;
    LastLocalUpdate!: Date | null;
    LastOnlineUpdate!: Date | null;
    Status!: number;
    Hidden!: boolean;
    EndTimeObjectCount!: number;
    TotalObjectCount!: number;
    LastPlayed!: Date | null;
    BeatDivisor!: number;
    EditorTimestamp!: number | null;

    static schema = {
        name: "Beatmap",
        primaryKey: "ID",
        properties: {
            ID: "uuid",
            DifficultyName: "string?",
            Ruleset: "Ruleset",
            Difficulty: "BeatmapDifficulty",
            Metadata: "BeatmapMetadata",
            UserSettings: "BeatmapUserSettings",
            BeatmapSet: "BeatmapSet",
            OnlineID: { type: "int", default: -1, indexed: true, optional: false },
            Length: { type: "double", default: 0 },
            BPM: { type: "double", default: 0 },
            Hash: "string?",
            StarRating: { type: "double", default: -1 },
            MD5Hash: "string?",
            OnlineMD5Hash: "string?",
            LastLocalUpdate: "date?",
            LastOnlineUpdate: "date?",
            Status: { type: "int", default: 0 },
            Hidden: { type: "bool", default: false },
            EndTimeObjectCount: { type: "int", default: -1 },
            TotalObjectCount: { type: "int", default: -1 },
            LastPlayed: "date?",
            BeatDivisor: { type: "int", default: 4 },
            EditorTimestamp: "double?"
        }
    };
}
