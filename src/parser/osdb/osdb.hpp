#pragma once

#include <cstdint>
#include <string>
#include <vector>

struct OsdbBeatmap {
    int difficulty_id = 0;
    int beatmapset_id = -1;
    std::string artist;
    std::string title;
    std::string difficulty;
    std::string checksum;
    std::string user_comment;
    int mode = 0;
    double difficulty_rating = 0.0;
};

struct OsdbCollection {
    std::string name;
    int online_id = 0;
    std::vector<OsdbBeatmap> beatmaps;
    std::vector<std::string> hash_only_beatmaps;
};

struct OsdbData {
    std::string version_string;
    int64_t save_data = 0;
    std::string last_editor;
    int count = 0;
    std::vector<OsdbCollection> collections;
};

namespace osdb_parser {
    bool parse(std::string location);
    bool write();

    inline OsdbData* data;
    inline std::string location("");
}; // namespace osdb_parser
