#include "legacy_collection.hpp"
#include "../../utils/binary.hpp"

#include <algorithm>

bool legacy_collection_parser::parse(const std::string location, OsuLegacyCollection* data) {
    std::vector<uint8_t> buffer;

    if (!binary::read_file_buffer(location, buffer)) {
        return false;
    }

    try {
        binary::BinaryCursor cursor;
        binary::set_cursor(cursor, buffer);

        data->version = binary::read_i32(cursor);
        data->collections_count = binary::read_i32(cursor);

        if (data->collections_count < 0) {
            throw std::runtime_error("invalid collections count");
        }

        data->collections.clear();
        data->collections.reserve(static_cast<size_t>(std::max(0, data->collections_count)));

        for (int i = 0; i < data->collections_count; i++) {
            LegacyCollection collection;

            collection.name = binary::read_string(cursor);
            collection.beatmaps_count = binary::read_i32(cursor);

            if (collection.beatmaps_count < 0) {
                throw std::runtime_error("invalid collection beatmaps count");
            }

            collection.beatmap_md5.clear();
            collection.beatmap_md5.reserve(static_cast<size_t>(std::max(0, collection.beatmaps_count)));

            for (int j = 0; j < collection.beatmaps_count; j++) {
                collection.beatmap_md5.push_back(binary::read_string(cursor));
            }

            data->collections.push_back(std::move(collection));
        }

        return true;
    } catch (const std::exception& e) {
        return false;
    }
}

bool legacy_collection_parser::write(const std::string location, OsuLegacyCollection* data) {
    if (data == nullptr || location.empty()) {
        return false;
    }

    std::vector<uint8_t> buffer;
    buffer.reserve(1024);

    data->collections_count = static_cast<int>(data->collections.size());

    binary::write_i32(buffer, data->version);
    binary::write_i32(buffer, data->collections_count);

    for (auto& collection : data->collections) {
        collection.beatmaps_count = static_cast<int>(collection.beatmap_md5.size());
        binary::write_string(buffer, collection.name);
        binary::write_i32(buffer, static_cast<int>(collection.beatmap_md5.size()));

        for (const auto& checksum : collection.beatmap_md5) {
            binary::write_string(buffer, checksum);
        }
    }

    if (!binary::write_file_buffer(location, buffer)) {
        return false;
    }

    return true;
}
