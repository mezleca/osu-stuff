#pragma once

#include <array>
#include <optional>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

enum OSU_SECTIONS {
  General = 0,
  Editor,
  Metadata,
  Difficulty,
  Events,
  TimingPoints,
  Colours,
  HitObjects
};

struct GeneralSection {
  std::string audio_filename;
  int audio_lead_in = 0;
  std::string audio_hash; // deprecated
  int preview_time = -1;
  int countdown = 1; // 0=none, 1=normal, 2=half, 3=double
  std::string sample_set = "Normal";
  double stack_leniency = 0.7;
  int mode = 0; // 0=std, 1=taiko, 2=ctb, 3=mania
  int letterbox_in_breaks = 0;
  int story_fire_in_front = 1; // deprecated
  int use_skin_sprites = 0;
  int always_show_playfield = 0; // deprecated
  std::string overlay_position = "NoChange";
  std::string skin_preference;
  int epilepsy_warning = 0;
  int countdown_offset = 0;
  int special_style = 0;
  int widescreen_storyboard = 0;
  int samples_match_playback_rate = 0;
};

struct EditorSection {
  std::vector<int> bookmarks;
  double distance_spacing = 1.0;
  int beat_divisor = 4;
  int grid_size = 4;
  double timeline_zoom = 1.0;
};

struct MetadataSection {
  std::string title;
  std::string title_unicode;
  std::string artist;
  std::string artist_unicode;
  std::string creator;
  std::string version;
  std::string source;
  std::string tags;
  int beatmap_id = -1;
  int beatmap_set_id = -1;
};

struct DifficultySection {
  double hp_drain_rate = 5.0;
  double circle_size = 5.0;
  double overall_difficulty = 5.0;
  double approach_rate = 5.0;
  double slider_multiplier = 1.4;
  double slider_tick_rate = 1.0;
};

struct EventBackground {
  std::string filename;
  int x_offset = 0;
  int y_offset = 0;
};

struct EventVideo {
  std::string filename;
  int start_time = 0;
  int x_offset = 0;
  int y_offset = 0;
};

struct EventBreak {
  int start_time = 0;
  int end_time = 0;
};

struct TimingPoint {
  int time = 0;
  double beat_length = 0.0;
  int meter = 4;
  int sample_set = 0; // 0=default, 1=normal, 2=soft, 3=drum
  int sample_index = 0;
  int volume = 100;
  int uninherited = 1; // 1=red line (BPM), 0=green line (SV)
  int effects = 0;     // bit 0=kiai, bit 3=omit first barline
};

struct ColourSection {
  std::vector<std::array<int, 3>> combos;
  std::optional<std::array<int, 3>> slider_track_override;
  std::optional<std::array<int, 3>> slider_border;
};

struct HitSample {
  int normal_set = 0;
  int addition_set = 0;
  int index = 0;
  int volume = 0;
  std::string filename;
};

struct HitObject {
  int x = 0; // 0-512 (playfield coords)
  int y = 0; // 0-384
  int time = 0;
  int type = 0;
  int hit_sound = 0;
  HitSample sample;

  char curve_type = 'L'; // B=bezier, C=catmull, L=linear, P=perfect circle
  std::vector<std::pair<int, int>> curve_points;
  int slides = 1;
  double length = 0.0;
  std::vector<int> edge_sounds;
  std::vector<std::pair<int, int>> edge_sets;

  int end_time = 0;
};

struct OsuBeatmap {
  int version = 14;
  GeneralSection general;
  EditorSection editor;
  MetadataSection metadata;
  DifficultySection difficulty;
  std::optional<EventBackground> background;
  std::optional<EventVideo> video;
  std::vector<EventBreak> breaks;
  std::vector<TimingPoint> timing_points;
  ColourSection colours;
  std::vector<HitObject> hit_objects;
};

inline const std::unordered_map<std::string, std::string> &key_to_section() {
  static const std::unordered_map<std::string, std::string> map = {
      {"AudioFilename", "[General]"},
      {"AudioLeadIn", "[General]"},
      {"AudioHash", "[General]"},
      {"PreviewTime", "[General]"},
      {"Countdown", "[General]"},
      {"SampleSet", "[General]"},
      {"StackLeniency", "[General]"},
      {"Mode", "[General]"},
      {"LetterboxInBreaks", "[General]"},
      {"StoryFireInFront", "[General]"},
      {"UseSkinSprites", "[General]"},
      {"AlwaysShowPlayfield", "[General]"},
      {"OverlayPosition", "[General]"},
      {"SkinPreference", "[General]"},
      {"EpilepsyWarning", "[General]"},
      {"CountdownOffset", "[General]"},
      {"SpecialStyle", "[General]"},
      {"WidescreenStoryboard", "[General]"},
      {"SamplesMatchPlaybackRate", "[General]"},
      {"Bookmarks", "[Editor]"},
      {"DistanceSpacing", "[Editor]"},
      {"BeatDivisor", "[Editor]"},
      {"GridSize", "[Editor]"},
      {"TimelineZoom", "[Editor]"},
      {"Title", "[Metadata]"},
      {"TitleUnicode", "[Metadata]"},
      {"Artist", "[Metadata]"},
      {"ArtistUnicode", "[Metadata]"},
      {"Creator", "[Metadata]"},
      {"Version", "[Metadata]"},
      {"Source", "[Metadata]"},
      {"Tags", "[Metadata]"},
      {"BeatmapID", "[Metadata]"},
      {"BeatmapSetID", "[Metadata]"},
      {"HPDrainRate", "[Difficulty]"},
      {"CircleSize", "[Difficulty]"},
      {"OverallDifficulty", "[Difficulty]"},
      {"ApproachRate", "[Difficulty]"},
      {"SliderMultiplier", "[Difficulty]"},
      {"SliderTickRate", "[Difficulty]"},
      {"Background", "[Events]"},
      {"Video", "[Events]"},
      {"Storyboard", "[Events]"},
  };

  return map;
}

inline const std::unordered_set<std::string> &get_special_keys() {
  static const std::unordered_set<std::string> set{"Background", "Video",
                                                   "Storyboard"};
  return set;
}

namespace beatmap_parser {
bool parse(std::string location);
bool write();

inline OsuBeatmap *data;
inline std::string location;
inline std::string last_error;
}; // namespace beatmap_parser
