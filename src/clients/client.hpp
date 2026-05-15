#pragma once

#include "../parser/legacy/legacy.hpp"
#include "../schemas/lazer.hpp"
#include "../utils/query.hpp"

#include <fmt/format.h>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

enum class BeatmapStatus : int {
  UKNOWN = 0,
  UNSUBMITTED,
  GRAVEYARD,
  WIP,
  PENDING,
  UNUSED,
  RANKED,
  APPROVED,
  QUALIFIED,
  LOVED
};

enum class Gamemode : int { OSU = 0, TAIKO, CATCH, MANIA };

struct OsuCollection {
  std::string name;
  std::vector<std::string> hashes;
};

// queryable fields with variations
#define CRITERIA_FIELDS                                                        \
  X(std::string, artist)                                                       \
  X(std::string, title)                                                        \
  X(std::string, creator)                                                      \
  X(std::string, difficulty)                                                   \
  X(Gamemode, mode)                                                            \
  X(BeatmapStatus, status)                                                     \
  X(double, approach_rate, "ar")                                               \
  X(double, circle_size, "cs")                                                 \
  X(double, overall_difficulty, "od")                                          \
  X(double, hp_drain, "hp")

// TODO: fields that requires custom dispatches like: played, key / keys, etc...

struct OsuBeatmap {
  // stable -> result
  explicit OsuBeatmap(const LegacyBeatmap &b)
      : artist(b.artist), title(b.title), creator(b.creator),
        difficulty(b.difficulty), mode((Gamemode)b.mode),
        status((BeatmapStatus)b.status), approach_rate(b.approach_rate),
        circle_size(b.circle_size), overall_difficulty(b.overall_difficulty),
        hp_drain(b.hp_drain), audio_file_name(b.audio_file_name), md5(b.md5),
        source(b.source), osu_file_name(b.osu_file_name), tags(b.tags),
        searchable(""), artist_unicode(b.artist_unicode),
        title_unicode(b.title_unicode),
        last_modification_time(b.last_modification_time),
        slider_velocity(b.slider_velocity), hitcircle(b.hitcircle),
        sliders(b.sliders), spinners(b.spinners), drain_time(b.drain_time),
        total_time(b.total_time), duration(b.duration),
        audio_preview_time(b.audio_preview_time),
        difficulty_id(b.difficulty_id), beatmap_id(b.beatmap_id) {}

  // lazer -> result
  explicit OsuBeatmap(const realm::Beatmap &b)
      : artist(b.Metadata->Artist.value_or("")),
        title(b.Metadata->Title.value_or("")),
        creator(b.Metadata->Author->Username.value_or("")),
        difficulty(b.DifficultyName.value_or("")), mode([&]() -> Gamemode {
          auto s = b.Ruleset->ShortName.value;
          if (s == "taiko")
            return Gamemode::TAIKO;
          if (s == "fruits")
            return Gamemode::CATCH;
          if (s == "mania")
            return Gamemode::MANIA;
          return Gamemode::OSU;
        }()),
        status((BeatmapStatus)b.Status),
        approach_rate(b.Difficulty->ApproachRate),
        circle_size(b.Difficulty->CircleSize),
        overall_difficulty(b.Difficulty->OverallDifficulty),
        hp_drain(b.Difficulty->DrainRate),
        audio_file_name(b.Metadata->AudioFile.value_or("")),
        md5(b.MD5Hash.value_or("")), source(b.Metadata->Source.value_or("")),
        osu_file_name(""), // to be filled later
        tags(b.Metadata->Tags.value_or("")), searchable(""),
        artist_unicode(b.Metadata->ArtistUnicode.value_or("")),
        title_unicode(b.Metadata->TitleUnicode.value_or("")),
        last_modification_time([&]() -> int64_t {
          if (!b.LastLocalUpdate.has_value())
            return 0;
          return std::chrono::duration_cast<std::chrono::milliseconds>(
                     b.LastLocalUpdate->time_since_epoch())
              .count();
        }()),
        slider_velocity(b.Difficulty->SliderMultiplier), hitcircle(0),
        sliders((int)b.EndTimeObjectCount), spinners(0),
        drain_time((int)b.Length), total_time((int)b.Length),
        duration(b.Length), audio_preview_time((int)b.Metadata->PreviewTime),
        difficulty_id((int)b.OnlineID),
        beatmap_id(b.BeatmapSet ? (int)b.BeatmapSet->OnlineID : 0) {}

#define X(type, name, ...) type name;
  CRITERIA_FIELDS
#undef X
  std::string audio_file_name;
  std::string md5;
  std::string source;
  std::string osu_file_name;
  std::string tags;
  std::string searchable;
  std::string artist_unicode;
  std::string title_unicode;
  int64_t last_modification_time = 0;
  double slider_velocity = 0.0;
  int hitcircle = 0;
  int sliders = 0;
  int spinners = 0;
  int drain_time = 0;
  int total_time = 0;
  std::optional<double> duration;
  int audio_preview_time = 0;
  int difficulty_id = 0;
  int beatmap_id = 0;

  void build_search() {
    searchable =
        fmt::format("{} {} {} {} {} {} {} {} {} {}", title, title_unicode,
                    artist, artist_unicode, creator, difficulty, source, tags,
                    difficulty_id, beatmap_id);
  }
};

struct OsuBeatmapSet {
  std::string artist;
  std::string artist_unicode;
  std::string title;
  std::string title_unicode;
  std::string creator;
  int beatmapset_id;
  std::vector<OsuBeatmap *> beatmaps;
};

struct ClientOptions {
  std::string osu_path;
  std::string lazer_realm_path;
  std::string lazer_files_path;
};

struct SearchOptions {
  std::string query;
  std::string sort;
  std::string status;
  std::string mode;
  bool unique = false;
  bool has_duration = false;
  double difficulty_min = 0.0;
  double difficulty_max = 0.0;
};

class ClientBase {
public:
  virtual ~ClientBase() = default;

  [[nodiscard]] virtual const char *player_name() const = 0;
  [[nodiscard]] virtual std::vector<std::string>
  search_beatmaps(const SearchOptions &options) = 0;
  [[nodiscard]] virtual std::vector<std::string>
  get_missing_beatmaps(std::string_view collection_name) = 0;
  [[nodiscard]] virtual OsuCollection *
  get_collection(std::string_view name) = 0;
  [[nodiscard]] virtual bool add_collection(OsuCollection *collection) = 0;
  [[nodiscard]] virtual bool delete_collection(std::string_view name) = 0;
  [[nodiscard]] virtual bool update_collection() = 0;
  [[nodiscard]] virtual OsuBeatmap *get_beatmap(std::string md5) = 0;
  [[nodiscard]] virtual OsuBeatmap *get_beatmap_by_id(int id) = 0;
  [[nodiscard]] virtual OsuBeatmapSet *get_beatmapset(int id) = 0;
  [[nodiscard]] virtual std::vector<OsuCollection *> get_collections() = 0;

  [[nodiscard]] std::vector<OsuBeatmap *> search_beatmaps(SearchOptions data);

protected:
  // TOFIX: move criteria related stuff to another class / struct
  void fill_criteria_table();

  void clear_criteria_table() { criteria_table.clear(); }

  // shared data for osu related stuff
  std::unordered_map<std::string, std::unique_ptr<OsuCollection>> m_collections;
  std::unordered_map<std::string, std::unique_ptr<OsuBeatmap>> m_beatmaps;
  std::unordered_map<int, std::unique_ptr<OsuBeatmapSet>> m_beatmapsets;

  using dispatch_fn = bool (*)(const OsuBeatmap &, std::string_view);
  using beatmap_dispatch = std::unordered_map<QueryOp, dispatch_fn>;

  std::unordered_map<std::string, beatmap_dispatch> criteria_table;
};
