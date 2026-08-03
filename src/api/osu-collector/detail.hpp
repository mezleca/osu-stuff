#pragma once

#include "../api.hpp"

#include <cstdint>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

// NOTE:
// osu!collector has no public / stable API specification. these models are
// limited to the public read endpoints in osu-collector-frontend-v2

struct OsuCollectorFirestoreTimestamp {
    int64_t seconds = 0;
    std::optional<int64_t> nanoseconds;
    std::optional<std::string> iso8601;
};

struct OsuCollectorUploader {
    int32_t id = 0;
    std::string username;
    int32_t rank = 0;
};

struct OsuCollectorCollectionModeCounts {
    int32_t osu = 0;
    int32_t taiko = 0;
    int32_t fruits = 0;
    int32_t mania = 0;
};

struct OsuCollectorDifficultySpread {
    int32_t one = 0;
    int32_t two = 0;
    int32_t three = 0;
    int32_t four = 0;
    int32_t five = 0;
    int32_t six = 0;
    int32_t seven = 0;
    int32_t eight = 0;
    int32_t nine = 0;
    int32_t ten = 0;
};

struct OsuCollectorBpmSpread {
    int32_t bpm_150 = 0;
    int32_t bpm_160 = 0;
    int32_t bpm_170 = 0;
    int32_t bpm_180 = 0;
    int32_t bpm_190 = 0;
    int32_t bpm_200 = 0;
    int32_t bpm_210 = 0;
    int32_t bpm_220 = 0;
    int32_t bpm_230 = 0;
    int32_t bpm_240 = 0;
    int32_t bpm_250 = 0;
    int32_t bpm_260 = 0;
    int32_t bpm_270 = 0;
    int32_t bpm_280 = 0;
    int32_t bpm_290 = 0;
    int32_t bpm_300 = 0;
};

struct OsuCollectorCollectionBeatmapReference {
    std::string checksum;
    int32_t id = 0;
};

struct OsuCollectorCollectionBeatmapsetReference {
    int32_t id = 0;
    std::vector<OsuCollectorCollectionBeatmapReference> beatmaps;
};

struct OsuCollectorComment {
    OsuCollectorFirestoreTimestamp date;
    std::vector<int32_t> upvotes;
    std::string id;
    std::string message;
    int32_t user_id = 0;
    std::string username;
};

struct OsuCollectorCollectionSummary {
    int32_t id = 0;
    std::string name;
    std::optional<std::string> description;
    OsuCollectorUploader uploader;
    int32_t beatmap_count = 0;
    int32_t favourites = 0;
    OsuCollectorFirestoreTimestamp date_uploaded;
    OsuCollectorFirestoreTimestamp date_last_modified;
    OsuCollectorDifficultySpread difficulty_spread;
    OsuCollectorBpmSpread bpm_spread;
    OsuCollectorCollectionModeCounts modes;
};

struct OsuCollectorCollection : OsuCollectorCollectionSummary {
    int32_t unsubmitted_beatmap_count = 0;
    std::vector<std::string> unknown_checksums;
    std::vector<OsuCollectorComment> comments;
    std::vector<OsuCollectorCollectionBeatmapsetReference> beatmapsets;
};

struct OsuCollectorBeatmap {
    int32_t beatmapset_id = 0;
    int32_t id = 0;
    std::optional<std::string> checksum;
    std::optional<std::string> version;
    std::optional<std::string> mode;
    std::optional<double> difficulty_rating;
    std::optional<double> accuracy;
    std::optional<double> drain;
    std::optional<double> bpm;
    std::optional<double> cs;
    std::optional<double> ar;
    std::optional<int32_t> hit_length;
    std::optional<std::string> status;
};

struct OsuCollectorBeatmapset {
    int32_t id = 0;
    std::optional<std::string> creator;
    std::optional<std::string> artist;
    std::optional<std::string> artist_unicode;
    std::optional<std::string> title;
    std::optional<std::string> title_unicode;
    std::optional<double> bpm;
    std::optional<std::string> cover;
    std::optional<std::string> submitted_date;
    std::optional<std::string> last_updated;
    std::optional<std::string> ranked_date;
    std::optional<int32_t> favourite_count;
    std::optional<std::string> status;
};

struct OsuCollectorCollectionBeatmapsResponse {
    std::vector<OsuCollectorBeatmap> beatmaps;
    std::vector<OsuCollectorBeatmapset> beatmapsets;
};

struct OsuCollectorTournamentSummary {
    int32_t id = 0;
    std::string name;
    std::string link;
    std::string banner;
    std::string download_url;
    std::optional<std::string> description;
    OsuCollectorUploader uploader;
    OsuCollectorFirestoreTimestamp date_uploaded;
    OsuCollectorFirestoreTimestamp date_modified;
};

struct OsuCollectorTournamentBeatmapsetCover {
    std::optional<std::string> card;
};

struct OsuCollectorTournamentBeatmapset {
    std::optional<int32_t> id;
    std::optional<std::string> artist;
    std::optional<std::string> title;
    std::optional<std::string> creator;
    std::optional<OsuCollectorTournamentBeatmapsetCover> covers;
};

struct OsuCollectorTournamentBeatmap {
    int32_t id = 0;
    std::optional<std::string> checksum;
    std::optional<double> difficulty_rating;
    std::optional<double> accuracy;
    std::optional<std::string> version;
    std::optional<std::string> mode;
    std::optional<double> cs;
    std::optional<double> ar;
    std::optional<int32_t> hit_length;
    std::optional<double> bpm;
    std::optional<std::string> status;
    OsuCollectorTournamentBeatmapset beatmapset;
};

struct OsuCollectorTournamentMod {
    std::string mod;
    std::vector<OsuCollectorTournamentBeatmap> maps;
};

struct OsuCollectorTournamentRound {
    std::string round;
    std::vector<OsuCollectorTournamentMod> mods;
};

struct OsuCollectorTournamentOrganizer {
    int32_t id = 0;
    std::string username;
};

struct OsuCollectorTournament : OsuCollectorTournamentSummary {
    std::vector<int32_t> organizer_ids;
    std::vector<OsuCollectorTournamentOrganizer> organizers;
    std::vector<OsuCollectorTournamentRound> rounds;
};

struct OsuCollectorCollectionsPage {
    bool has_more = false;
    std::optional<int32_t> next_page_cursor;
    std::vector<OsuCollectorCollectionSummary> collections;
};

struct OsuCollectorTournamentsPage {
    bool has_more = false;
    std::optional<int32_t> next_page_cursor;
    std::vector<OsuCollectorTournamentSummary> tournaments;
};

struct OsuCollectorRecentRequest {
    std::optional<int32_t> cursor;
    std::optional<int32_t> per_page;
};

struct OsuCollectorPopularCollectionsRequest : OsuCollectorRecentRequest {
    std::string range = "today"; // today, week, month, year, alltime
};

struct OsuCollectorSearchRequest : OsuCollectorRecentRequest {
    std::string search;
    std::optional<std::string> sort_by;
    std::optional<std::string> order_by;
};

struct OsuCollectorCollectionRequest {
    int32_t id = 0;
    bool with_beatmapsets = false;
};

struct OsuCollectorCollectionBeatmapsRequest {
    int32_t id = 0;
    int32_t per_page = 50;
};

struct OsuCollectorTournamentRequest {
    int32_t id = 0;
};

inline void from_json(const nlohmann::json& j, OsuCollectorFirestoreTimestamp& value) {
    if (j.is_string()) {
        value.iso8601 = j.get<std::string>();
        return;
    }

    value.seconds = j.value("_seconds", 0LL);
    if (j.contains("_nanoseconds") && !j["_nanoseconds"].is_null()) {
        value.nanoseconds = j["_nanoseconds"].get<int64_t>();
    }
}

inline void to_json(nlohmann::json& j, const OsuCollectorFirestoreTimestamp& value) {
    if (value.iso8601) {
        j = *value.iso8601;
        return;
    }

    j = {{"_seconds", value.seconds}};
    if (value.nanoseconds) j["_nanoseconds"] = *value.nanoseconds;
}

inline void from_json(const nlohmann::json& j, OsuCollectorUploader& value) {
    value.id = j.value("id", 0);
    value.username = j.value("username", "");
    value.rank = j.value("rank", 0);
}

inline void to_json(nlohmann::json& j, const OsuCollectorUploader& value) {
    j = {{"id", value.id}, {"username", value.username}, {"rank", value.rank}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorCollectionModeCounts& value) {
    value.osu = j.value("osu", 0);
    value.taiko = j.value("taiko", 0);
    value.fruits = j.value("fruits", 0);
    value.mania = j.value("mania", 0);
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionModeCounts& value) {
    j = {{"osu", value.osu}, {"taiko", value.taiko}, {"fruits", value.fruits}, {"mania", value.mania}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorDifficultySpread& value) {
    value.one = j.value("1", 0);
    value.two = j.value("2", 0);
    value.three = j.value("3", 0);
    value.four = j.value("4", 0);
    value.five = j.value("5", 0);
    value.six = j.value("6", 0);
    value.seven = j.value("7", 0);
    value.eight = j.value("8", 0);
    value.nine = j.value("9", 0);
    value.ten = j.value("10", 0);
}

inline void to_json(nlohmann::json& j, const OsuCollectorDifficultySpread& value) {
    j = {{"1", value.one}, {"2", value.two},   {"3", value.three}, {"4", value.four}, {"5", value.five},
         {"6", value.six}, {"7", value.seven}, {"8", value.eight}, {"9", value.nine}, {"10", value.ten}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorBpmSpread& value) {
    value.bpm_150 = j.value("150", 0);
    value.bpm_160 = j.value("160", 0);
    value.bpm_170 = j.value("170", 0);
    value.bpm_180 = j.value("180", 0);
    value.bpm_190 = j.value("190", 0);
    value.bpm_200 = j.value("200", 0);
    value.bpm_210 = j.value("210", 0);
    value.bpm_220 = j.value("220", 0);
    value.bpm_230 = j.value("230", 0);
    value.bpm_240 = j.value("240", 0);
    value.bpm_250 = j.value("250", 0);
    value.bpm_260 = j.value("260", 0);
    value.bpm_270 = j.value("270", 0);
    value.bpm_280 = j.value("280", 0);
    value.bpm_290 = j.value("290", 0);
    value.bpm_300 = j.value("300", 0);
}

inline void to_json(nlohmann::json& j, const OsuCollectorBpmSpread& value) {
    j = {{"150", value.bpm_150}, {"160", value.bpm_160}, {"170", value.bpm_170}, {"180", value.bpm_180},
         {"190", value.bpm_190}, {"200", value.bpm_200}, {"210", value.bpm_210}, {"220", value.bpm_220},
         {"230", value.bpm_230}, {"240", value.bpm_240}, {"250", value.bpm_250}, {"260", value.bpm_260},
         {"270", value.bpm_270}, {"280", value.bpm_280}, {"290", value.bpm_290}, {"300", value.bpm_300}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorCollectionBeatmapReference& value) {
    value.checksum = j.value("checksum", "");
    value.id = j.value("id", 0);
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionBeatmapReference& value) {
    j = {{"checksum", value.checksum}, {"id", value.id}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorCollectionBeatmapsetReference& value) {
    value.id = j.value("id", 0);
    value.beatmaps = j.value("beatmaps", std::vector<OsuCollectorCollectionBeatmapReference>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionBeatmapsetReference& value) {
    j = {{"id", value.id}, {"beatmaps", value.beatmaps}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorComment& value) {
    value.date = j.value("date", OsuCollectorFirestoreTimestamp{});
    value.upvotes = j.value("upvotes", std::vector<int32_t>{});
    value.id = j.value("id", "");
    value.message = j.value("message", "");
    value.user_id = j.value("userId", 0);
    value.username = j.value("username", "");
}

inline void to_json(nlohmann::json& j, const OsuCollectorComment& value) {
    j = {{"date", value.date},       {"upvotes", value.upvotes}, {"id", value.id},
         {"message", value.message}, {"userId", value.user_id},  {"username", value.username}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorCollectionSummary& value) {
    value.id = j.value("id", 0);
    value.name = j.value("name", "");
    value.description = j.value("description", std::optional<std::string>{});
    value.uploader = j.value("uploader", OsuCollectorUploader{});
    value.beatmap_count = j.value("beatmapCount", 0);
    value.favourites = j.value("favourites", 0);
    value.date_uploaded = j.value("dateUploaded", OsuCollectorFirestoreTimestamp{});
    value.date_last_modified = j.value("dateLastModified", OsuCollectorFirestoreTimestamp{});
    value.difficulty_spread = j.value("difficultySpread", OsuCollectorDifficultySpread{});
    value.bpm_spread = j.value("bpmSpread", OsuCollectorBpmSpread{});
    value.modes = j.value("modes", OsuCollectorCollectionModeCounts{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionSummary& value) {
    j = {
        {"id", value.id},
        {"name", value.name},
        {"description", value.description},
        {"uploader", value.uploader},
        {"beatmapCount", value.beatmap_count},
        {"favourites", value.favourites},
        {"dateUploaded", value.date_uploaded},
        {"dateLastModified", value.date_last_modified},
        {"difficultySpread", value.difficulty_spread},
        {"bpmSpread", value.bpm_spread},
        {"modes", value.modes}
    };
}

inline void from_json(const nlohmann::json& j, OsuCollectorCollection& value) {
    from_json(j, static_cast<OsuCollectorCollectionSummary&>(value));
    value.unsubmitted_beatmap_count = j.value("unsubmittedBeatmapCount", 0);
    value.unknown_checksums = j.value("unknownChecksums", std::vector<std::string>{});
    value.comments = j.value("comments", std::vector<OsuCollectorComment>{});
    value.beatmapsets = j.value("beatmapsets", std::vector<OsuCollectorCollectionBeatmapsetReference>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollection& value) {
    to_json(j, static_cast<const OsuCollectorCollectionSummary&>(value));
    j["unsubmittedBeatmapCount"] = value.unsubmitted_beatmap_count;
    j["unknownChecksums"] = value.unknown_checksums;
    j["comments"] = value.comments;
    j["beatmapsets"] = value.beatmapsets;
}

inline void from_json(const nlohmann::json& j, OsuCollectorBeatmap& value) {
    value.beatmapset_id = j.value("beatmapset_id", 0);
    value.id = j.value("id", 0);
    value.checksum = j.value("checksum", std::optional<std::string>{});
    value.version = j.value("version", std::optional<std::string>{});
    value.mode = j.value("mode", std::optional<std::string>{});
    value.difficulty_rating = j.value("difficulty_rating", std::optional<double>{});
    value.accuracy = j.value("accuracy", std::optional<double>{});
    value.drain = j.value("drain", std::optional<double>{});
    value.bpm = j.value("bpm", std::optional<double>{});
    value.cs = j.value("cs", std::optional<double>{});
    value.ar = j.value("ar", std::optional<double>{});
    value.hit_length = j.value("hit_length", std::optional<int32_t>{});
    value.status = j.value("status", std::optional<std::string>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorBeatmap& value) {
    j = {
        {"beatmapset_id", value.beatmapset_id},
        {"id", value.id},
        {"checksum", value.checksum},
        {"version", value.version},
        {"mode", value.mode},
        {"difficulty_rating", value.difficulty_rating},
        {"accuracy", value.accuracy},
        {"drain", value.drain},
        {"bpm", value.bpm},
        {"cs", value.cs},
        {"ar", value.ar},
        {"hit_length", value.hit_length},
        {"status", value.status}
    };
}

inline void from_json(const nlohmann::json& j, OsuCollectorBeatmapset& value) {
    value.id = j.value("id", 0);
    value.creator = j.value("creator", std::optional<std::string>{});
    value.artist = j.value("artist", std::optional<std::string>{});
    value.artist_unicode = j.value("artist_unicode", std::optional<std::string>{});
    value.title = j.value("title", std::optional<std::string>{});
    value.title_unicode = j.value("title_unicode", std::optional<std::string>{});
    value.bpm = j.value("bpm", std::optional<double>{});
    value.cover = j.value("cover", std::optional<std::string>{});
    value.submitted_date = j.value("submitted_date", std::optional<std::string>{});
    value.last_updated = j.value("last_updated", std::optional<std::string>{});
    value.ranked_date = j.value("ranked_date", std::optional<std::string>{});
    value.favourite_count = j.value("favourite_count", std::optional<int32_t>{});
    value.status = j.value("status", std::optional<std::string>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorBeatmapset& value) {
    j = {
        {"id", value.id},
        {"creator", value.creator},
        {"artist", value.artist},
        {"artist_unicode", value.artist_unicode},
        {"title", value.title},
        {"title_unicode", value.title_unicode},
        {"bpm", value.bpm},
        {"cover", value.cover},
        {"submitted_date", value.submitted_date},
        {"last_updated", value.last_updated},
        {"ranked_date", value.ranked_date},
        {"favourite_count", value.favourite_count},
        {"status", value.status}
    };
}

inline void from_json(const nlohmann::json& j, OsuCollectorCollectionBeatmapsResponse& value) {
    value.beatmaps = j.value("beatmaps", std::vector<OsuCollectorBeatmap>{});
    value.beatmapsets = j.value("beatmapsets", std::vector<OsuCollectorBeatmapset>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionBeatmapsResponse& value) {
    j = {{"beatmaps", value.beatmaps}, {"beatmapsets", value.beatmapsets}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentSummary& value) {
    value.id = j.value("id", 0);
    value.name = j.value("name", "");
    value.link = j.value("link", "");
    value.banner = j.value("banner", "");
    value.download_url = j.value("downloadUrl", "");
    value.description = j.value("description", std::optional<std::string>{});
    value.uploader = j.value("uploader", OsuCollectorUploader{});
    value.date_uploaded = j.value("dateUploaded", OsuCollectorFirestoreTimestamp{});
    value.date_modified = j.value("dateModified", OsuCollectorFirestoreTimestamp{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentSummary& value) {
    j = {
        {"id", value.id},
        {"name", value.name},
        {"link", value.link},
        {"banner", value.banner},
        {"downloadUrl", value.download_url},
        {"description", value.description},
        {"uploader", value.uploader},
        {"dateUploaded", value.date_uploaded},
        {"dateModified", value.date_modified}
    };
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentBeatmapsetCover& value) {
    value.card = j.value("card", std::optional<std::string>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentBeatmapsetCover& value) {
    j = {{"card", value.card}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentBeatmapset& value) {
    value.id = j.value("id", std::optional<int32_t>{});
    value.artist = j.value("artist", std::optional<std::string>{});
    value.title = j.value("title", std::optional<std::string>{});
    value.creator = j.value("creator", std::optional<std::string>{});
    if (j.contains("covers") && !j["covers"].is_null()) {
        value.covers = j["covers"].get<OsuCollectorTournamentBeatmapsetCover>();
    }
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentBeatmapset& value) {
    j = {
        {"id", value.id},
        {"artist", value.artist},
        {"title", value.title},
        {"creator", value.creator},
        {"covers", value.covers}
    };
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentBeatmap& value) {
    value.id = j.value("id", 0);
    value.checksum = j.value("checksum", std::optional<std::string>{});
    value.difficulty_rating = j.value("difficulty_rating", std::optional<double>{});
    value.accuracy = j.value("accuracy", std::optional<double>{});
    value.version = j.value("version", std::optional<std::string>{});
    value.mode = j.value("mode", std::optional<std::string>{});
    value.cs = j.value("cs", std::optional<double>{});
    value.ar = j.value("ar", std::optional<double>{});
    value.hit_length = j.value("hit_length", std::optional<int32_t>{});
    value.bpm = j.value("bpm", std::optional<double>{});
    value.status = j.value("status", std::optional<std::string>{});
    value.beatmapset = j.value("beatmapset", OsuCollectorTournamentBeatmapset{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentBeatmap& value) {
    j = {
        {"id", value.id},
        {"checksum", value.checksum},
        {"difficulty_rating", value.difficulty_rating},
        {"accuracy", value.accuracy},
        {"version", value.version},
        {"mode", value.mode},
        {"cs", value.cs},
        {"ar", value.ar},
        {"hit_length", value.hit_length},
        {"bpm", value.bpm},
        {"status", value.status},
        {"beatmapset", value.beatmapset}
    };
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentMod& value) {
    value.mod = j.value("mod", "");
    value.maps = j.value("maps", std::vector<OsuCollectorTournamentBeatmap>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentMod& value) {
    j = {{"mod", value.mod}, {"maps", value.maps}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentRound& value) {
    value.round = j.value("round", "");
    value.mods = j.value("mods", std::vector<OsuCollectorTournamentMod>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentRound& value) {
    j = {{"round", value.round}, {"mods", value.mods}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentOrganizer& value) {
    value.id = j.value("id", 0);
    value.username = j.value("username", "");
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentOrganizer& value) {
    j = {{"id", value.id}, {"username", value.username}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournament& value) {
    from_json(j, static_cast<OsuCollectorTournamentSummary&>(value));
    value.organizer_ids = j.value("organizerIds", std::vector<int32_t>{});
    value.organizers = j.value("organizers", std::vector<OsuCollectorTournamentOrganizer>{});
    value.rounds = j.value("rounds", std::vector<OsuCollectorTournamentRound>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournament& value) {
    to_json(j, static_cast<const OsuCollectorTournamentSummary&>(value));
    j["organizerIds"] = value.organizer_ids;
    j["organizers"] = value.organizers;
    j["rounds"] = value.rounds;
}

inline void from_json(const nlohmann::json& j, OsuCollectorCollectionsPage& value) {
    value.has_more = j.value("hasMore", false);
    value.next_page_cursor = j.value("nextPageCursor", std::optional<int32_t>{});
    value.collections = j.value("collections", std::vector<OsuCollectorCollectionSummary>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionsPage& value) {
    j = {{"hasMore", value.has_more}, {"nextPageCursor", value.next_page_cursor}, {"collections", value.collections}};
}

inline void from_json(const nlohmann::json& j, OsuCollectorTournamentsPage& value) {
    value.has_more = j.value("hasMore", false);
    value.next_page_cursor = j.value("nextPageCursor", std::optional<int32_t>{});
    value.tournaments = j.value("tournaments", std::vector<OsuCollectorTournamentSummary>{});
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentsPage& value) {
    j = {{"hasMore", value.has_more}, {"nextPageCursor", value.next_page_cursor}, {"tournaments", value.tournaments}};
}

inline void to_json(nlohmann::json& j, const OsuCollectorRecentRequest& value) {
    j = nlohmann::json::object();
    if (value.cursor) j["cursor"] = *value.cursor;
    if (value.per_page) j["perPage"] = *value.per_page;
}

inline void to_json(nlohmann::json& j, const OsuCollectorPopularCollectionsRequest& value) {
    to_json(j, static_cast<const OsuCollectorRecentRequest&>(value));
    j["range"] = value.range;
}

inline void to_json(nlohmann::json& j, const OsuCollectorSearchRequest& value) {
    to_json(j, static_cast<const OsuCollectorRecentRequest&>(value));
    j["search"] = value.search;
    if (value.sort_by) j["sortBy"] = *value.sort_by;
    if (value.order_by) j["orderBy"] = *value.order_by;
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionRequest& value) {
    j = {{"id", value.id}, {"withBeatmapsets", value.with_beatmapsets}};
}

inline void to_json(nlohmann::json& j, const OsuCollectorCollectionBeatmapsRequest& value) {
    j = {{"id", value.id}, {"perPage", value.per_page}};
}

inline void to_json(nlohmann::json& j, const OsuCollectorTournamentRequest& value) {
    j = {{"id", value.id}};
}

class OsuCollectorAPI : public OAuthApi {
public:
    OsuCollectorAPI();
    ~OsuCollectorAPI() = default;

    std::optional<OsuCollectorCollectionsPage> get_recent_collections(const OsuCollectorRecentRequest& request = {});
    std::optional<OsuCollectorCollectionsPage>
    get_popular_collections(const OsuCollectorPopularCollectionsRequest& request = {});
    std::optional<OsuCollectorCollectionsPage> search_collections(const OsuCollectorSearchRequest& request);
    std::optional<OsuCollectorCollection> get_collection(const OsuCollectorCollectionRequest& request);
    std::optional<OsuCollectorCollectionBeatmapsResponse>
    get_collection_beatmaps(const OsuCollectorCollectionBeatmapsRequest& request);

    std::optional<OsuCollectorTournamentsPage> get_recent_tournaments(const OsuCollectorRecentRequest& request = {});
    std::optional<OsuCollectorTournamentsPage> search_tournaments(const OsuCollectorSearchRequest& request);
    std::optional<OsuCollectorTournament> get_tournament(const OsuCollectorTournamentRequest& request);
};
