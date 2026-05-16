#pragma once

#include <cpprealm/sdk.hpp>

#include <cstdint>
#include <optional>
#include <string>

namespace realm {
    struct BeatmapDifficulty {
        float DrainRate = 0.0f;
        float CircleSize = 0.0f;
        float OverallDifficulty = 0.0f;
        float ApproachRate = 0.0f;
        double SliderMultiplier = 0.0;
        double SliderTickRate = 0.0;
    };

    REALM_EMBEDDED_SCHEMA(BeatmapDifficulty, DrainRate, CircleSize, OverallDifficulty, ApproachRate, SliderMultiplier,
                          SliderTickRate);

    struct BeatmapUserSettings {
        double Offset = 0.0;
    };

    REALM_EMBEDDED_SCHEMA(BeatmapUserSettings, Offset);

    struct RealmUser {
        int64_t OnlineID = 0;
        std::optional<std::string> Username;
        std::optional<std::string> CountryCode;
    };

    REALM_EMBEDDED_SCHEMA(RealmUser, OnlineID, Username, CountryCode);

    struct Ruleset {
        realm::primary_key<std::optional<std::string>> ShortName;
        int64_t OnlineID = -1;
        std::optional<std::string> Name;
        std::optional<std::string> InstantiationInfo;
        int64_t LastAppliedDifficultyVersion = 0;
        bool Available = false;
    };

    REALM_SCHEMA(Ruleset, ShortName, OnlineID, Name, InstantiationInfo, LastAppliedDifficultyVersion, Available);

    struct File {
        realm::primary_key<std::optional<std::string>> Hash;
    };

    REALM_SCHEMA(File, Hash);

    struct RealmNamedFileUsage {
        File* File = nullptr;
        std::optional<std::string> Filename;
    };

    REALM_EMBEDDED_SCHEMA(RealmNamedFileUsage, File, Filename);

    struct BeatmapMetadata {
        std::optional<std::string> Title;
        std::optional<std::string> TitleUnicode;
        std::optional<std::string> Artist;
        std::optional<std::string> ArtistUnicode;
        RealmUser* Author = nullptr;
        std::optional<std::string> Source;
        std::optional<std::string> Tags;
        int64_t PreviewTime = 0;
        std::optional<std::string> AudioFile;
        std::optional<std::string> BackgroundFile;
        std::vector<std::optional<std::string>> UserTags;
    };

    REALM_SCHEMA(BeatmapMetadata, Title, TitleUnicode, Artist, ArtistUnicode, Author, Source, Tags, PreviewTime,
                 AudioFile, BackgroundFile, UserTags);

    struct BeatmapCollection {
        realm::primary_key<realm::uuid> ID;
        std::optional<std::string> Name;
        std::vector<std::optional<std::string>> BeatmapMD5Hashes;
        std::chrono::time_point<std::chrono::system_clock> LastModified;
    };

    REALM_SCHEMA(BeatmapCollection, ID, Name, BeatmapMD5Hashes, LastModified);

    struct Beatmap;

    struct BeatmapSet {
        realm::primary_key<realm::uuid> ID;
        int64_t OnlineID = -1;
        std::chrono::time_point<std::chrono::system_clock> DateAdded;
        std::optional<std::chrono::time_point<std::chrono::system_clock>> DateSubmitted;
        std::optional<std::chrono::time_point<std::chrono::system_clock>> DateRanked;
        std::vector<Beatmap*> Beatmaps;
        std::vector<RealmNamedFileUsage*> Files;
        int64_t Status = 0;
        bool DeletePending = false;
        std::optional<std::string> Hash;
        bool Protected = false;
    };

    REALM_SCHEMA(BeatmapSet, ID, OnlineID, DateAdded, DateSubmitted, DateRanked, Beatmaps, Files, Status, DeletePending,
                 Hash, Protected);

    struct Beatmap {
        realm::primary_key<realm::uuid> ID;
        std::optional<std::string> DifficultyName;
        Ruleset* Ruleset = nullptr;
        BeatmapDifficulty* Difficulty = nullptr;
        BeatmapMetadata* Metadata = nullptr;
        BeatmapUserSettings* UserSettings = nullptr;
        BeatmapSet* BeatmapSet = nullptr;
        int64_t OnlineID = -1;
        double Length = 0.0;
        double BPM = 0.0;
        std::optional<std::string> Hash;
        double StarRating = -1.0;
        std::optional<std::string> MD5Hash;
        std::optional<std::string> OnlineMD5Hash;
        std::optional<std::chrono::time_point<std::chrono::system_clock>> LastLocalUpdate;
        std::optional<std::chrono::time_point<std::chrono::system_clock>> LastOnlineUpdate;
        int64_t Status = 0;
        bool Hidden = false;
        int64_t EndTimeObjectCount = -1;
        int64_t TotalObjectCount = -1;
        std::optional<std::chrono::time_point<std::chrono::system_clock>> LastPlayed;
        int64_t BeatDivisor = 4;
        std::optional<double> EditorTimestamp;
    };

    REALM_SCHEMA(Beatmap, ID, DifficultyName, Ruleset, Difficulty, Metadata, UserSettings, BeatmapSet, OnlineID, Length,
                 BPM, Hash, StarRating, MD5Hash, OnlineMD5Hash, LastLocalUpdate, LastOnlineUpdate, Status, Hidden,
                 EndTimeObjectCount, TotalObjectCount, LastPlayed, BeatDivisor, EditorTimestamp);
} // namespace realm
