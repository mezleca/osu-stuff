#include <chrono>
#include <cstring>
#include <unordered_map>

#include "../../utils/binary.hpp"
#include "../../utils/gzip.hpp"
#include "osdb.hpp"

static bool ends_with(const std::string& value, const char* suffix) {
    const size_t suffix_len = std::strlen(suffix);

    if (value.size() < suffix_len) {
        return false;
    }

    return value.compare(value.size() - suffix_len, suffix_len, suffix) == 0;
}

static int osdb_version_to_code(const std::string& version) {
    static const std::unordered_map<std::string, int> version_map = {
        {"o!dm", 1},  {"o!dm2", 2}, {"o!dm3", 3}, {"o!dm4", 4},       {"o!dm5", 5},
        {"o!dm6", 6}, {"o!dm7", 7}, {"o!dm8", 8}, {"o!dm7min", 1007}, {"o!dm8min", 1008},
    };

    const auto it = version_map.find(version);
    return it != version_map.end() ? it->second : 0;
}

bool osdb_parser::parse(std::string location) {
    if (data == nullptr) {
        return false;
    }

    std::string target_location = std::move(location);
    std::vector<uint8_t> buffer;

    if (!binary::read_file_buffer(target_location, buffer)) {
        return false;
    }

    try {
        binary::BinaryCursor cursor;
        binary::set_cursor(cursor, buffer);

        const std::string version_string = binary::read_string2(cursor);
        const int version = osdb_version_to_code(version_string);

        if (version == 0) {
            return false;
        }

        const bool is_minimal = ends_with(version_string, "min");
        OsdbData temp;

        temp.version_string = version_string;
        std::vector<uint8_t> decompressed;

        if (version >= 7) {
            std::vector<uint8_t> compressed(buffer.begin() + static_cast<std::ptrdiff_t>(cursor.offset), buffer.end());

            if (!binary::gzip_decompress(compressed, decompressed)) {
                return false;
            }

            binary::set_cursor(cursor, decompressed);
            binary::read_string2(cursor);
        }

        temp.save_data = binary::read_i64(cursor);
        temp.last_editor = binary::read_string2(cursor);
        temp.count = binary::read_i32(cursor);

        if (temp.count < 0) {
            return false;
        }

        temp.collections.clear();
        temp.collections.reserve(static_cast<size_t>(temp.count));

        for (int i = 0; i < temp.count; i++) {
            OsdbCollection collection;
            collection.name = binary::read_string2(cursor);

            if (version >= 7) {
                collection.online_id = binary::read_i32(cursor);
            } else {
                collection.online_id = 0;
            }

            const int beatmaps_count = binary::read_i32(cursor);

            if (beatmaps_count < 0) {
                return false;
            }

            collection.beatmaps.clear();
            collection.beatmaps.reserve(static_cast<size_t>(beatmaps_count));

            for (int j = 0; j < beatmaps_count; j++) {
                OsdbBeatmap beatmap;

                beatmap.difficulty_id = binary::read_i32(cursor);
                beatmap.beatmapset_id = version >= 2 ? binary::read_i32(cursor) : -1;

                if (!is_minimal) {
                    beatmap.artist = binary::read_string2(cursor);
                    beatmap.title = binary::read_string2(cursor);
                    beatmap.difficulty = binary::read_string2(cursor);
                }

                beatmap.checksum = binary::read_string2(cursor);

                if (version >= 4) {
                    beatmap.user_comment = binary::read_string2(cursor);
                }

                if (version >= 8 || (version >= 5 && !is_minimal)) {
                    beatmap.mode = binary::read_u8(cursor);
                }

                if (version >= 8 || (version >= 6 && !is_minimal)) {
                    beatmap.difficulty_rating = binary::read_f64(cursor);
                }

                collection.beatmaps.push_back(std::move(beatmap));
            }

            if (version >= 3) {
                const int hash_count = binary::read_i32(cursor);
                collection.hash_only_beatmaps.clear();

                if (hash_count < 0) {
                    return false;
                }

                collection.hash_only_beatmaps.reserve(static_cast<size_t>(hash_count));

                for (int j = 0; j < hash_count; j++) {
                    collection.hash_only_beatmaps.push_back(binary::read_string2(cursor));
                }
            }

            temp.collections.push_back(std::move(collection));
        }

        const std::string footer = binary::read_string2(cursor);

        if (footer != "By Piotrekol") {
            return false;
        }

        *data = std::move(temp);
        return true;
    } catch (const std::exception& e) {
        return false;
    }
}

bool osdb_parser::write() {
    if (data == nullptr || location.empty()) {
        return false;
    }

    const std::string version_string = data->version_string.empty() ? "o!dm8min" : data->version_string;
    const int version = osdb_version_to_code(version_string);

    if (version == 0) {
        return false;
    }

    const bool is_minimal = ends_with(version_string, "min");

    std::vector<uint8_t> content;
    if (version >= 7) {
        binary::write_string2(content, version_string);
    }

    const int64_t save_time = data->save_data != 0
                                  ? data->save_data
                                  : static_cast<int64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(
                                                             std::chrono::system_clock::now().time_since_epoch())
                                                             .count());

    data->count = static_cast<int>(data->collections.size());

    binary::write_i64(content, save_time);
    binary::write_string2(content, data->last_editor);
    binary::write_i32(content, data->count);

    for (const auto& collection : data->collections) {
        binary::write_string2(content, collection.name);

        if (version >= 7) {
            binary::write_i32(content, collection.online_id);
        }

        binary::write_i32(content, static_cast<int>(collection.beatmaps.size()));

        for (const auto& beatmap : collection.beatmaps) {
            binary::write_i32(content, beatmap.difficulty_id);

            if (version >= 2) {
                binary::write_i32(content, beatmap.beatmapset_id);
            }

            if (!is_minimal) {
                binary::write_string2(content, beatmap.artist);
                binary::write_string2(content, beatmap.title);
                binary::write_string2(content, beatmap.difficulty);
            }

            binary::write_string2(content, beatmap.checksum);

            if (version >= 4) {
                binary::write_string2(content, beatmap.user_comment);
            }

            if (version >= 8 || (version >= 5 && !is_minimal)) {
                binary::write_u8(content, static_cast<uint8_t>(beatmap.mode));
            }

            if (version >= 8 || (version >= 6 && !is_minimal)) {
                binary::write_f64(content, beatmap.difficulty_rating);
            }
        }

        if (version >= 3) {
            binary::write_i32(content, static_cast<int>(collection.hash_only_beatmaps.size()));
            for (const auto& hash : collection.hash_only_beatmaps) {
                binary::write_string2(content, hash);
            }
        }
    }

    binary::write_string2(content, "By Piotrekol");

    std::vector<uint8_t> buffer;
    binary::write_string2(buffer, version_string);

    if (version >= 7) {
        std::vector<uint8_t> compressed;

        if (!binary::gzip_compress(content, compressed)) {
            return false;
        }

        buffer.insert(buffer.end(), compressed.begin(), compressed.end());
    } else {
        buffer.insert(buffer.end(), content.begin(), content.end());
    }

    if (!binary::write_file_buffer(location, buffer)) {
        return false;
    }

    return true;
}
