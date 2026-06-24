#pragma once

#include "./filter/filter.hpp"

#include "../parser/legacy/legacy.hpp"
#include "../schemas/lazer.hpp"
#include "../utils/binary.hpp"
#include "./detail.hpp"

#include <format>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

struct OsuCollection {
    std::string name;
    std::vector<std::string> hashes;
};

struct OsuBeatmap {
    // stable -> result
    explicit OsuBeatmap(const LegacyBeatmap& b)
        : artist(b.artist), title(b.title), creator(b.creator), difficulty(b.difficulty),
          audio_file_name(b.audio_file_name), md5(b.md5), source(b.source), osu_file_name(b.osu_file_name),
          tags(b.tags), searchable(""), artist_unicode(b.artist_unicode), title_unicode(b.title_unicode),
          duration(b.duration), approach_rate(b.approach_rate), circle_size(b.circle_size),
          overall_difficulty(b.overall_difficulty), hp_drain(b.hp_drain), slider_velocity(b.slider_velocity),
          last_modification_time(b.last_modification_time), hitcircle(b.hitcircle), sliders(b.sliders),
          spinners(b.spinners), drain_time(b.drain_time), total_time(b.total_time),
          audio_preview_time(b.audio_preview_time), difficulty_id(b.difficulty_id), beatmap_id(b.beatmap_id),
          mode((BeatmapGamemode)b.mode), status((BeatmapStatus)b.status) {
    }

    // lazer -> result
    explicit OsuBeatmap(const realm::managed<realm::Beatmap>& b)
        : artist(b.Metadata ? client_detail::detach_or_empty(b.Metadata->Artist) : ""),
          title(b.Metadata ? client_detail::detach_or_empty(b.Metadata->Title) : ""),
          creator(b.Metadata && b.Metadata->Author ? client_detail::detach_or_empty(b.Metadata->Author->Username) : ""),
          difficulty(client_detail::detach_or_empty(b.DifficultyName)),
          audio_file_name(b.Metadata ? client_detail::detach_or_empty(b.Metadata->AudioFile) : ""),
          md5(client_detail::detach_or_empty(b.MD5Hash)),
          source(b.Metadata ? client_detail::detach_or_empty(b.Metadata->Source) : ""), osu_file_name(""),
          tags(b.Metadata ? client_detail::detach_or_empty(b.Metadata->Tags) : ""), searchable(""),
          artist_unicode(b.Metadata ? client_detail::detach_or_empty(b.Metadata->ArtistUnicode) : ""),
          title_unicode(b.Metadata ? client_detail::detach_or_empty(b.Metadata->TitleUnicode) : ""),
          duration(b.Length.detach()), approach_rate(b.Difficulty ? b.Difficulty->ApproachRate.detach() : 0.0),
          circle_size(b.Difficulty ? b.Difficulty->CircleSize.detach() : 0.0),
          overall_difficulty(b.Difficulty ? b.Difficulty->OverallDifficulty.detach() : 0.0),
          hp_drain(b.Difficulty ? b.Difficulty->DrainRate.detach() : 0.0),
          slider_velocity(b.Difficulty ? b.Difficulty->SliderMultiplier.detach() : 0.0),
          last_modification_time(client_detail::detach_time_ms(b.LastLocalUpdate)), hitcircle(0),
          sliders((int)b.EndTimeObjectCount.detach()), spinners(0), drain_time((int)b.Length.detach()),
          total_time((int)b.Length.detach()),
          audio_preview_time(b.Metadata ? (int)b.Metadata->PreviewTime.detach() : 0),
          difficulty_id((int)b.OnlineID.detach()), beatmap_id(b.BeatmapSet ? (int)b.BeatmapSet->OnlineID.detach() : 0),
          mode(client_detail::detach_mode(b.Ruleset)), status((BeatmapStatus)b.Status.detach()) {
    }

    std::string artist;
    std::string title;
    std::string creator;
    std::string difficulty;
    std::string audio_file_name;
    std::string md5;
    std::string source;
    std::string osu_file_name;
    std::string tags;
    std::string searchable;
    std::string artist_unicode;
    std::string title_unicode;
    std::optional<double> duration;
    double approach_rate = 0.0;
    double circle_size = 0.0;
    double overall_difficulty = 0.0;
    double hp_drain = 0.0;
    double slider_velocity = 0.0;
    int64_t last_modification_time = 0;
    int hitcircle = 0;
    int sliders = 0;
    int spinners = 0;
    int drain_time = 0;
    int total_time = 0;
    int audio_preview_time = 0;
    int difficulty_id = 0;
    int beatmap_id = 0;
    BeatmapGamemode mode{};
    BeatmapStatus status{};

    void build_search() {
        searchable = binary::normalize_and_lower(std::format("{} {} {} {} {} {} {} {} {} {}", title, title_unicode,
                                                             artist, artist_unicode, creator, difficulty, source, tags,
                                                             difficulty_id, beatmap_id));
    }
};

struct OsuBeatmapSet {
    std::string artist;
    std::string artist_unicode;
    std::string title;
    std::string title_unicode;
    std::string creator;
    int beatmapset_id;
    std::vector<OsuBeatmap*> beatmaps;
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
    double difficulty_min = 0.0;
    double difficulty_max = 0.0;
    bool unique = false;
    bool has_duration = false;
};

class ClientBase {
public:
    virtual ~ClientBase() = default;

    [[nodiscard]] virtual const char* player_name() const = 0;
    [[nodiscard]] virtual std::vector<std::string> search_beatmaps(const SearchOptions& options);
    [[nodiscard]] virtual std::vector<std::string>
    fetch_missing_beatmaps_from_collections(std::string_view collection_name) = 0;
    [[nodiscard]] virtual OsuCollection* get_collection(std::string_view name);
    [[nodiscard]] virtual bool add_collection(OsuCollection* collection);
    [[nodiscard]] virtual bool delete_collection(std::string_view name);
    [[nodiscard]] virtual bool update_collection();
    [[nodiscard]] virtual OsuBeatmap* get_beatmap(std::string md5);
    [[nodiscard]] virtual OsuBeatmap* get_beatmap_by_id(int id);
    [[nodiscard]] virtual OsuBeatmapSet* get_beatmapset(int id);
    [[nodiscard]] virtual std::vector<OsuCollection*> get_collections();

protected:
    [[nodiscard]] std::vector<OsuBeatmap*> filter_beatmaps(const SearchOptions& data);
    [[nodiscard]] virtual bool matches_filter(const OsuBeatmap& beatmap) const;

    void rebuild_beatmapsets_from_beatmaps();

    // shared data for osu related stuff
    std::unordered_map<std::string, std::unique_ptr<OsuCollection>> m_collections;
    std::unordered_map<std::string, std::unique_ptr<OsuBeatmap>> m_beatmaps;
    std::unordered_map<int, std::unique_ptr<OsuBeatmapSet>> m_beatmapsets;

    FilterCriteria m_criteria;
};
