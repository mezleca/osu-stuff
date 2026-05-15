#pragma once

#include <cstdint>
#include <filesystem>
#include <optional>
#include <string>
#include <vector>

struct LegacyFloatPair {
  int mod_combination = 0;
  double star_rating = 0.0;
};

struct LegacyTimingPoint {
  double bpm = 0.0;
  double offset = 0.0;
  int inherited = 0;
};

struct LegacyBeatmap {
  std::optional<int> entry_size;
  std::string artist;
  std::string artist_unicode;
  std::string title;
  std::string title_unicode;
  std::string creator;
  std::string difficulty;
  std::string audio_file_name;
  std::string md5;
  std::string osu_file_name;
  int status = 0;
  int hitcircle = 0;
  int sliders = 0;
  int spinners = 0;
  int64_t last_modification_time = 0;
  double approach_rate = 0.0;
  double circle_size = 0.0;
  double hp_drain = 0.0;
  double overall_difficulty = 0.0;
  double slider_velocity = 0.0;
  std::vector<LegacyFloatPair> star_rating_standard;
  std::vector<LegacyFloatPair> star_rating_taiko;
  std::vector<LegacyFloatPair> star_rating_ctb;
  std::vector<LegacyFloatPair> star_rating_mania;
  int drain_time = 0;
  int total_time = 0;
  std::optional<double> duration;
  int audio_preview_time = 0;
  std::vector<LegacyTimingPoint> timing_points;
  int difficulty_id = 0;
  int beatmap_id = 0;
  int thread_id = 0;
  int grade_standard = 0;
  int grade_taiko = 0;
  int grade_ctb = 0;
  int grade_mania = 0;
  int local_offset = 0;
  double stack_leniency = 0.0;
  int mode = 0;
  std::string source;
  std::string tags;
  int online_offset = 0;
  std::string title_font;
  int unplayed = 0;
  int64_t last_played = 0;
  int is_osz2 = 0;
  std::string folder_name;
  int64_t last_checked = 0;
  int ignore_sounds = 0;
  int ignore_skin = 0;
  int disable_storyboard = 0;
  int disable_video = 0;
  int visual_override = 0;
  std::optional<int> unknown;
  int last_modified = 0;
  int mania_scroll_speed = 0;
};

struct OsuLegacyDatabase {
  int version = 0;
  int folder_count = 0;
  int account_unlocked = 0;
  int64_t account_unlock_time = 0;
  std::string player_name;
  int beatmaps_count = 0;
  std::vector<LegacyBeatmap> beatmaps;
  int permissions = 0;
};

struct LegacyScoreBase {
  int mode = 0;
  int version = 0;
  std::string beatmap_md5;
  std::string player_name;
  std::string replay_md5;
  int count_300 = 0;
  int count_100 = 0;
  int count_50 = 0;
  int count_geki = 0;
  int count_katu = 0;
  int count_miss = 0;
  int score = 0;
  int max_combo = 0;
  int perfect = 0;
  int mods = 0;
  std::string life_bar_graph;
  int64_t timestamp = 0;
  std::optional<double> additional_mod_info;
};

struct LegacyScore : LegacyScoreBase {
  int replay_data_length = -1;
  std::vector<uint8_t> replay_data;
  int64_t online_score_id = 0;
};

struct LegacyScoresBeatmap {
  std::string beatmap_md5;
  int scores_count = 0;
  std::vector<LegacyScore> scores;
};

struct LegacyScoresDb {
  int version = 0;
  int beatmaps_count = 0;
  std::vector<LegacyScoresBeatmap> beatmaps;
};

struct LegacyReplay : LegacyScoreBase {
  int replay_data_length = 0;
  std::vector<uint8_t> replay_data;
  int64_t online_score_id = 0;
};

namespace legacy_parser {
bool parse(std::filesystem::path &location, OsuLegacyDatabase *data);
bool write(std::filesystem::path &location, OsuLegacyDatabase *data);
}; // namespace legacy_parser
