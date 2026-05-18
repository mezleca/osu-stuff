#include "legacy.hpp"
#include "../../utils/binary.hpp"

#include <algorithm>
#include <stdexcept>

static LegacyFloatPair read_int_float_pair(binary::BinaryCursor& cursor, bool use_float) {
    LegacyFloatPair pair;

    uint8_t marker = binary::read_u8(cursor);

    if (marker != 0x08) {
        throw std::runtime_error("invalid int-float pair marker");
    }

    pair.mod_combination = static_cast<int>(binary::read_i32(cursor));

    uint8_t float_marker = binary::read_u8(cursor);

    if (use_float) {
        if (float_marker != 0x0C) {
            throw std::runtime_error("invalid float marker");
        }
        pair.star_rating = static_cast<double>(binary::read_f32(cursor));
    } else {
        if (float_marker != 0x0D) {
            throw std::runtime_error("invalid double marker");
        }
        pair.star_rating = binary::read_f64(cursor);
    }

    return pair;
}

static std::vector<LegacyFloatPair> read_star_ratings(binary::BinaryCursor& cursor, bool use_float) {
    std::vector<LegacyFloatPair> ratings;
    int count = binary::read_i32(cursor);

    if (count < 0) {
        throw std::runtime_error("invalid star rating count");
    }

    if (count == 0) {
        return ratings;
    }

    ratings.reserve(static_cast<size_t>(count));

    for (int i = 0; i < count; i++) {
        ratings.push_back(read_int_float_pair(cursor, use_float));
    }

    return ratings;
}

static void write_int_float_pair(std::vector<uint8_t>& buffer, const LegacyFloatPair& pair, bool use_float) {
    binary::write_u8(buffer, 0x08);
    binary::write_i32(buffer, pair.mod_combination);

    if (use_float) {
        binary::write_u8(buffer, 0x0C);
        binary::write_f32(buffer, static_cast<float>(pair.star_rating));
    } else {
        binary::write_u8(buffer, 0x0D);
        binary::write_f64(buffer, pair.star_rating);
    }
}

static void write_star_ratings(std::vector<uint8_t>& buffer, const std::vector<LegacyFloatPair>& ratings,
                               bool use_float) {
    binary::write_i32(buffer, static_cast<int>(ratings.size()));

    for (const auto& rating : ratings) {
        write_int_float_pair(buffer, rating, use_float);
    }
}

static LegacyBeatmap read_beatmap(binary::BinaryCursor& cursor, int version) {
    LegacyBeatmap beatmap;

    const bool has_entry_size = version < 20191106;
    const bool old_diff_format = version < 20140609;
    const bool use_float_star = version >= 20250107;

    size_t entry_start = 0;

    if (has_entry_size) {
        beatmap.entry_size = binary::read_i32(cursor);
        entry_start = cursor.offset;
    }

    beatmap.artist = binary::read_string(cursor);
    beatmap.artist_unicode = binary::read_string(cursor);
    beatmap.title = binary::read_string(cursor);
    beatmap.title_unicode = binary::read_string(cursor);
    beatmap.creator = binary::read_string(cursor);
    beatmap.difficulty = binary::read_string(cursor);
    beatmap.audio_file_name = binary::read_string(cursor);
    beatmap.md5 = binary::read_string(cursor);
    beatmap.osu_file_name = binary::read_string(cursor);
    beatmap.status = binary::read_u8(cursor);
    beatmap.hitcircle = binary::read_u16(cursor);
    beatmap.sliders = binary::read_u16(cursor);
    beatmap.spinners = binary::read_u16(cursor);
    beatmap.last_modification_time = binary::read_i64(cursor);

    if (old_diff_format) {
        beatmap.approach_rate = binary::read_u8(cursor);
        beatmap.circle_size = binary::read_u8(cursor);
        beatmap.hp_drain = binary::read_u8(cursor);
        beatmap.overall_difficulty = binary::read_u8(cursor);
    } else {
        beatmap.approach_rate = binary::read_f32(cursor);
        beatmap.circle_size = binary::read_f32(cursor);
        beatmap.hp_drain = binary::read_f32(cursor);
        beatmap.overall_difficulty = binary::read_f32(cursor);
    }

    beatmap.slider_velocity = binary::read_f64(cursor);

    if (!old_diff_format) {
        beatmap.star_rating_standard = read_star_ratings(cursor, use_float_star);
        beatmap.star_rating_taiko = read_star_ratings(cursor, use_float_star);
        beatmap.star_rating_ctb = read_star_ratings(cursor, use_float_star);
        beatmap.star_rating_mania = read_star_ratings(cursor, use_float_star);
    }

    beatmap.drain_time = binary::read_i32(cursor);
    beatmap.total_time = binary::read_i32(cursor);
    beatmap.audio_preview_time = binary::read_i32(cursor);

    int timing_count = binary::read_i32(cursor);

    if (timing_count < 0) {
        throw std::runtime_error("invalid timing point count");
    }

    beatmap.timing_points.reserve(static_cast<size_t>(std::max(0, timing_count)));

    for (int i = 0; i < timing_count; i++) {
        LegacyTimingPoint tp;
        tp.bpm = binary::read_f64(cursor);
        tp.offset = binary::read_f64(cursor);
        tp.inherited = binary::read_bool(cursor) ? 1 : 0;
        beatmap.timing_points.push_back(tp);
    }

    beatmap.difficulty_id = binary::read_i32(cursor);
    beatmap.beatmap_id = binary::read_i32(cursor);
    beatmap.thread_id = binary::read_i32(cursor);
    beatmap.grade_standard = binary::read_u8(cursor);
    beatmap.grade_taiko = binary::read_u8(cursor);
    beatmap.grade_ctb = binary::read_u8(cursor);
    beatmap.grade_mania = binary::read_u8(cursor);
    beatmap.local_offset = binary::read_i16(cursor);
    beatmap.stack_leniency = binary::read_f32(cursor);
    beatmap.mode = binary::read_u8(cursor);
    beatmap.source = binary::read_string(cursor);
    beatmap.tags = binary::read_string(cursor);
    beatmap.online_offset = binary::read_i16(cursor);
    beatmap.title_font = binary::read_string(cursor);
    beatmap.unplayed = binary::read_bool(cursor) ? 1 : 0;
    beatmap.last_played = binary::read_i64(cursor);
    beatmap.is_osz2 = binary::read_bool(cursor) ? 1 : 0;
    beatmap.folder_name = binary::read_string(cursor);
    beatmap.last_checked = binary::read_i64(cursor);
    beatmap.ignore_sounds = binary::read_bool(cursor) ? 1 : 0;
    beatmap.ignore_skin = binary::read_bool(cursor) ? 1 : 0;
    beatmap.disable_storyboard = binary::read_bool(cursor) ? 1 : 0;
    beatmap.disable_video = binary::read_bool(cursor) ? 1 : 0;
    beatmap.visual_override = binary::read_bool(cursor) ? 1 : 0;

    if (old_diff_format) {
        beatmap.unknown = binary::read_i16(cursor);
    }

    beatmap.last_modified = binary::read_i32(cursor);
    beatmap.mania_scroll_speed = binary::read_u8(cursor);

    if (has_entry_size && beatmap.entry_size.has_value()) {
        const size_t bytes_read = cursor.offset - entry_start;
        const int entry_size = beatmap.entry_size.value();

        if (entry_size <= 0 || static_cast<size_t>(entry_size) < bytes_read) {
            throw std::runtime_error("invalid beatmap entry size");
        }

        if (entry_size > 0 && static_cast<size_t>(entry_size) > bytes_read) {
            binary::skip(cursor, static_cast<size_t>(entry_size) - bytes_read);
        }
    }

    return beatmap;
}

bool legacy_parser::parse(const std::filesystem::path& location, OsuLegacyDatabase* data) {
    std::vector<uint8_t> buffer;

    if (!binary::read_file_buffer(location.string(), buffer)) {
        return false;
    }

    try {
        binary::BinaryCursor cursor;
        binary::set_cursor(cursor, buffer);

        data->version = binary::read_i32(cursor);
        data->folder_count = binary::read_i32(cursor);
        data->account_unlocked = binary::read_bool(cursor) ? 1 : 0;
        data->account_unlock_time = binary::read_i64(cursor);
        data->player_name = binary::read_string(cursor);
        data->beatmaps_count = binary::read_i32(cursor);

        if (data->beatmaps_count < 0) {
            throw std::runtime_error("invalid beatmaps count");
        }

        data->beatmaps.clear();
        data->beatmaps.reserve(static_cast<size_t>(std::max(0, data->beatmaps_count)));

        for (int i = 0; i < data->beatmaps_count; i++) {
            data->beatmaps.push_back(read_beatmap(cursor, data->version));
        }

        data->permissions = binary::read_i32(cursor);

        return true;
    } catch (const std::exception& e) {
        // TODO
        return false;
    }
}

bool legacy_parser::write(const std::filesystem::path& location, OsuLegacyDatabase* data) {
    if (data == nullptr || location.empty()) {
        return false;
    }

    std::vector<uint8_t> buffer;
    buffer.reserve(1024);

    const int version = data->version;
    const bool has_entry_size = version < 20191106;
    const bool old_diff_format = version < 20140609;
    const bool use_float_star = version >= 20250107;

    data->beatmaps_count = static_cast<int>(data->beatmaps.size());

    binary::write_i32(buffer, version);
    binary::write_i32(buffer, data->folder_count);
    binary::write_bool(buffer, data->account_unlocked != 0);
    binary::write_i64(buffer, data->account_unlock_time);
    binary::write_string(buffer, data->player_name);
    binary::write_i32(buffer, data->beatmaps_count);

    for (const auto& beatmap : data->beatmaps) {
        std::vector<uint8_t> entry;
        entry.reserve(512);

        binary::write_string(entry, beatmap.artist);
        binary::write_string(entry, beatmap.artist_unicode);
        binary::write_string(entry, beatmap.title);
        binary::write_string(entry, beatmap.title_unicode);
        binary::write_string(entry, beatmap.creator);
        binary::write_string(entry, beatmap.difficulty);
        binary::write_string(entry, beatmap.audio_file_name);
        binary::write_string(entry, beatmap.md5);
        binary::write_string(entry, beatmap.osu_file_name);
        binary::write_u8(entry, static_cast<uint8_t>(beatmap.status));
        binary::write_u16(entry, static_cast<uint16_t>(beatmap.hitcircle));
        binary::write_u16(entry, static_cast<uint16_t>(beatmap.sliders));
        binary::write_u16(entry, static_cast<uint16_t>(beatmap.spinners));
        binary::write_i64(entry, beatmap.last_modification_time);

        if (old_diff_format) {
            binary::write_u8(entry, static_cast<uint8_t>(beatmap.approach_rate));
            binary::write_u8(entry, static_cast<uint8_t>(beatmap.circle_size));
            binary::write_u8(entry, static_cast<uint8_t>(beatmap.hp_drain));
            binary::write_u8(entry, static_cast<uint8_t>(beatmap.overall_difficulty));
        } else {
            binary::write_f32(entry, static_cast<float>(beatmap.approach_rate));
            binary::write_f32(entry, static_cast<float>(beatmap.circle_size));
            binary::write_f32(entry, static_cast<float>(beatmap.hp_drain));
            binary::write_f32(entry, static_cast<float>(beatmap.overall_difficulty));
        }

        binary::write_f64(entry, beatmap.slider_velocity);

        if (!old_diff_format) {
            write_star_ratings(entry, beatmap.star_rating_standard, use_float_star);
            write_star_ratings(entry, beatmap.star_rating_taiko, use_float_star);
            write_star_ratings(entry, beatmap.star_rating_ctb, use_float_star);
            write_star_ratings(entry, beatmap.star_rating_mania, use_float_star);
        }

        binary::write_i32(entry, beatmap.drain_time);
        binary::write_i32(entry, beatmap.total_time);
        binary::write_i32(entry, beatmap.audio_preview_time);

        binary::write_i32(entry, static_cast<int>(beatmap.timing_points.size()));

        for (const auto& timing : beatmap.timing_points) {
            binary::write_f64(entry, timing.bpm);
            binary::write_f64(entry, timing.offset);
            binary::write_bool(entry, timing.inherited != 0);
        }

        binary::write_i32(entry, beatmap.difficulty_id);
        binary::write_i32(entry, beatmap.beatmap_id);
        binary::write_i32(entry, beatmap.thread_id);
        binary::write_u8(entry, static_cast<uint8_t>(beatmap.grade_standard));
        binary::write_u8(entry, static_cast<uint8_t>(beatmap.grade_taiko));
        binary::write_u8(entry, static_cast<uint8_t>(beatmap.grade_ctb));
        binary::write_u8(entry, static_cast<uint8_t>(beatmap.grade_mania));
        binary::write_i16(entry, static_cast<int16_t>(beatmap.local_offset));
        binary::write_f32(entry, static_cast<float>(beatmap.stack_leniency));
        binary::write_u8(entry, static_cast<uint8_t>(beatmap.mode));
        binary::write_string(entry, beatmap.source);
        binary::write_string(entry, beatmap.tags);
        binary::write_i16(entry, static_cast<int16_t>(beatmap.online_offset));
        binary::write_string(entry, beatmap.title_font);
        binary::write_bool(entry, beatmap.unplayed != 0);
        binary::write_i64(entry, beatmap.last_played);
        binary::write_bool(entry, beatmap.is_osz2 != 0);
        binary::write_string(entry, beatmap.folder_name);
        binary::write_i64(entry, beatmap.last_checked);
        binary::write_bool(entry, beatmap.ignore_sounds != 0);
        binary::write_bool(entry, beatmap.ignore_skin != 0);
        binary::write_bool(entry, beatmap.disable_storyboard != 0);
        binary::write_bool(entry, beatmap.disable_video != 0);
        binary::write_bool(entry, beatmap.visual_override != 0);

        if (old_diff_format) {
            binary::write_i16(entry, static_cast<int16_t>(beatmap.unknown.value_or(0)));
        }

        binary::write_i32(entry, beatmap.last_modified);
        binary::write_u8(entry, static_cast<uint8_t>(beatmap.mania_scroll_speed));

        if (has_entry_size) {
            binary::write_i32(buffer, static_cast<int>(entry.size()));
        }

        buffer.insert(buffer.end(), entry.begin(), entry.end());
    }

    binary::write_i32(buffer, data->permissions);

    if (!binary::write_file_buffer(location.string(), buffer)) {
        return false;
    }

    return true;
}
