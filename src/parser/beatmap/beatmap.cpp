#include "beatmap.hpp"
#include "../../utils/binary.hpp"
#include "writer.hpp"

#include <algorithm>
#include <climits>
#include <fstream>
#include <functional>
#include <string_view>
#include <unordered_set>

static const std::unordered_set<std::string> &get_video_extensions() {
  static const std::unordered_set<std::string> extensions = {
      ".mp4", ".avi", ".flv", ".mov", ".wmv", ".m4v", ".mpg", ".mpeg"};
  return extensions;
}

static const std::unordered_set<std::string> &get_image_extensions() {
  static const std::unordered_set<std::string> extensions = {
      ".jpg", ".jpeg", ".png", ".bmp", ".gif"};
  return extensions;
}

static std::string_view trim_view(std::string_view s) {
  size_t start = s.find_first_not_of(" \t\r\n");

  if (start == std::string_view::npos) {
    return "";
  }

  size_t end = s.find_last_not_of(" \t\r\n");
  return s.substr(start, end - start + 1);
}

static std::vector<std::string_view> split_view(std::string_view s,
                                                char delim) {
  std::vector<std::string_view> result;
  size_t start = 0;
  size_t end = s.find(delim);

  while (end != std::string_view::npos) {
    result.push_back(s.substr(start, end - start));
    start = end + 1;
    end = s.find(delim, start);
  }

  result.push_back(s.substr(start));
  return result;
}

static std::string normalize_path(const std::string &path) {
#ifdef _WIN32
  std::string normalized = path;
  std::replace(normalized.begin(), normalized.end(), '/', '\\');
  return normalized;
#else
  return path;
#endif
}

static std::string_view get_extension(std::string_view filename) {
  size_t dot = filename.find_last_of('.');
  return (dot != std::string_view::npos) ? filename.substr(dot) : "";
}

static std::string remove_quotes(std::string_view s) {
  if (s.size() >= 2 && s.front() == '"' && s.back() == '"') {
    return std::string(s.substr(1, s.size() - 2));
  }
  return std::string(s);
}

static std::string to_lower(std::string_view s) {
  std::string result(s);
  std::transform(result.begin(), result.end(), result.begin(), ::tolower);
  return result;
}

static std::pair<std::string_view, std::string_view>
split_key_value(std::string_view line) {
  size_t delim = line.find(':');

  if (delim == std::string_view::npos) {
    return {"", ""};
  }

  return {trim_view(line.substr(0, delim)), trim_view(line.substr(delim + 1))};
}

static void
iterate_lines(std::string_view content,
              const std::function<void(std::string_view)> &callback) {
  size_t start = 0;
  size_t end = content.find('\n');

  while (end != std::string_view::npos) {
    callback(trim_view(content.substr(start, end - start)));
    start = end + 1;
    end = content.find('\n', start);
  }

  if (start < content.size()) {
    callback(trim_view(content.substr(start)));
  }
}

static std::vector<std::string_view>
get_section(std::string_view content, std::string_view section_name) {
  std::vector<std::string_view> result;
  std::string target = "[" + std::string(section_name) + "]";
  bool in_section = false;
  bool done = false;

  iterate_lines(content, [&](std::string_view line) {
    if (done) {
      return;
    }
    if (line.empty()) {
      return;
    }

    if (line[0] == '[') {
      if (in_section) {
        done = true;
        return;
      }
      in_section = (line == target);
      return;
    }

    if (in_section && line[0] != '/') {
      result.push_back(line);
    }
  });

  return result;
}

static GeneralSection
parse_general(const std::vector<std::string_view> &lines) {
  GeneralSection s;

  for (const auto &line : lines) {
    auto [key, val] = split_key_value(line);

    if (key == "AudioFilename")
      s.audio_filename = std::string(val);
    else if (key == "AudioLeadIn")
      s.audio_lead_in = binary::convert_to<int>(val, 0);
    else if (key == "AudioHash")
      s.audio_hash = std::string(val);
    else if (key == "PreviewTime")
      s.preview_time = binary::convert_to<int>(val, -1);
    else if (key == "Countdown")
      s.countdown = binary::convert_to<int>(val, 1);
    else if (key == "SampleSet")
      s.sample_set = std::string(val);
    else if (key == "StackLeniency")
      s.stack_leniency = binary::convert_to<double>(val, 0.7);
    else if (key == "Mode")
      s.mode = binary::convert_to<int>(val, 0);
    else if (key == "LetterboxInBreaks")
      s.letterbox_in_breaks = binary::convert_to<int>(val, 0);
    else if (key == "StoryFireInFront")
      s.story_fire_in_front = binary::convert_to<int>(val, 1);
    else if (key == "UseSkinSprites")
      s.use_skin_sprites = binary::convert_to<int>(val, 0);
    else if (key == "AlwaysShowPlayfield")
      s.always_show_playfield = binary::convert_to<int>(val, 0);
    else if (key == "OverlayPosition")
      s.overlay_position = std::string(val);
    else if (key == "SkinPreference")
      s.skin_preference = std::string(val);
    else if (key == "EpilepsyWarning")
      s.epilepsy_warning = binary::convert_to<int>(val, 0);
    else if (key == "CountdownOffset")
      s.countdown_offset = binary::convert_to<int>(val, 0);
    else if (key == "SpecialStyle")
      s.special_style = binary::convert_to<int>(val, 0);
    else if (key == "WidescreenStoryboard")
      s.widescreen_storyboard = binary::convert_to<int>(val, 0);
    else if (key == "SamplesMatchPlaybackRate")
      s.samples_match_playback_rate = binary::convert_to<int>(val, 0);
  }

  return s;
}

static EditorSection parse_editor(const std::vector<std::string_view> &lines) {
  EditorSection s;

  for (const auto &line : lines) {
    auto [key, val] = split_key_value(line);

    if (key == "Bookmarks") {
      for (const auto &p : split_view(val, ',')) {
        auto t = trim_view(p);
        if (!t.empty()) {
          s.bookmarks.push_back(binary::convert_to<int>(t, 0));
        }
      }
    } else if (key == "DistanceSpacing")
      s.distance_spacing = binary::convert_to<double>(val, 1.0);
    else if (key == "BeatDivisor")
      s.beat_divisor = binary::convert_to<int>(val, 4);
    else if (key == "GridSize")
      s.grid_size = binary::convert_to<int>(val, 4);
    else if (key == "TimelineZoom")
      s.timeline_zoom = binary::convert_to<double>(val, 1.0);
  }

  return s;
}

static MetadataSection
parse_metadata(const std::vector<std::string_view> &lines) {
  MetadataSection s;

  for (const auto &line : lines) {
    auto [key, val] = split_key_value(line);

    if (key == "Title")
      s.title = std::string(val);
    else if (key == "TitleUnicode")
      s.title_unicode = std::string(val);
    else if (key == "Artist")
      s.artist = std::string(val);
    else if (key == "ArtistUnicode")
      s.artist_unicode = std::string(val);
    else if (key == "Creator")
      s.creator = std::string(val);
    else if (key == "Version")
      s.version = std::string(val);
    else if (key == "Source")
      s.source = std::string(val);
    else if (key == "Tags")
      s.tags = std::string(val);
    else if (key == "BeatmapID")
      s.beatmap_id = binary::convert_to<int>(val, -1);
    else if (key == "BeatmapSetID")
      s.beatmap_set_id = binary::convert_to<int>(val, -1);
  }

  return s;
}

static DifficultySection
parse_difficulty(const std::vector<std::string_view> &lines) {
  DifficultySection s;

  for (const auto &line : lines) {
    auto [key, val] = split_key_value(line);

    if (key == "HPDrainRate")
      s.hp_drain_rate = binary::convert_to<double>(val, 5.0);
    else if (key == "CircleSize")
      s.circle_size = binary::convert_to<double>(val, 5.0);
    else if (key == "OverallDifficulty")
      s.overall_difficulty = binary::convert_to<double>(val, 5.0);
    else if (key == "ApproachRate")
      s.approach_rate = binary::convert_to<double>(val, 5.0);
    else if (key == "SliderMultiplier")
      s.slider_multiplier = binary::convert_to<double>(val, 1.4);
    else if (key == "SliderTickRate")
      s.slider_tick_rate = binary::convert_to<double>(val, 1.0);
  }

  return s;
}

void parse_events(const std::vector<std::string_view> &lines,
                  std::optional<EventBackground> &bg,
                  std::optional<EventVideo> &vid,
                  std::vector<EventBreak> &breaks) {
  for (const auto &line : lines) {
    auto parts = split_view(line, ',');
    if (parts.empty()) {
      continue;
    }

    auto type = trim_view(parts[0]);

    if (type == "0" && parts.size() >= 3 && trim_view(parts[1]) == "0") {
      std::string filename = remove_quotes(trim_view(parts[2]));
      std::string ext = to_lower(get_extension(filename));

      if (get_image_extensions().count(ext)) {
        EventBackground b;
        b.filename = normalize_path(filename);
        if (parts.size() >= 4)
          b.x_offset = binary::convert_to<int>(parts[3], 0);
        if (parts.size() >= 5)
          b.y_offset = binary::convert_to<int>(parts[4], 0);
        bg = b;
      }
    } else if ((type == "1" || type == "Video") && parts.size() >= 3) {
      std::string filename = remove_quotes(trim_view(parts[2]));
      std::string ext = to_lower(get_extension(filename));

      if (get_video_extensions().count(ext)) {
        EventVideo v;
        v.start_time = binary::convert_to<int>(parts[1], 0);
        v.filename = normalize_path(filename);
        if (parts.size() >= 4)
          v.x_offset = binary::convert_to<int>(parts[3], 0);
        if (parts.size() >= 5)
          v.y_offset = binary::convert_to<int>(parts[4], 0);
        vid = v;
      }
    } else if ((type == "2" || type == "Break") && parts.size() >= 3) {
      EventBreak b;
      b.start_time = binary::convert_to<int>(parts[1], 0);
      b.end_time = binary::convert_to<int>(parts[2], 0);
      breaks.push_back(b);
    }
  }
}

static std::vector<TimingPoint>
parse_timing_points(const std::vector<std::string_view> &lines) {
  std::vector<TimingPoint> points;
  points.reserve(lines.size());

  for (const auto &line : lines) {
    auto parts = split_view(line, ',');
    if (parts.size() < 2) {
      continue;
    }

    TimingPoint tp;
    tp.time = binary::convert_to<int>(parts[0], 0);
    tp.beat_length = binary::convert_to<double>(parts[1], 0.0);
    if (parts.size() > 2)
      tp.meter = binary::convert_to<int>(parts[2], 4);
    if (parts.size() > 3)
      tp.sample_set = binary::convert_to<int>(parts[3], 0);
    if (parts.size() > 4)
      tp.sample_index = binary::convert_to<int>(parts[4], 0);
    if (parts.size() > 5)
      tp.volume = binary::convert_to<int>(parts[5], 100);
    if (parts.size() > 6)
      tp.uninherited = binary::convert_to<int>(parts[6], 1);
    if (parts.size() > 7)
      tp.effects = binary::convert_to<int>(parts[7], 0);

    points.push_back(tp);
  }

  return points;
}

static ColourSection parse_colours(const std::vector<std::string_view> &lines) {
  ColourSection s;

  for (const auto &line : lines) {
    auto [key, val] = split_key_value(line);
    auto parts = split_view(val, ',');

    if (parts.size() < 3) {
      continue;
    }

    std::array<int, 3> color = {binary::convert_to<int>(parts[0], 0),
                                binary::convert_to<int>(parts[1], 0),
                                binary::convert_to<int>(parts[2], 0)};

    if (key.find("Combo") != std::string_view::npos) {
      s.combos.push_back(color);
    } else if (key == "SliderTrackOverride") {
      s.slider_track_override = color;
    } else if (key == "SliderBorder") {
      s.slider_border = color;
    }
  }

  return s;
}

static HitSample parse_hit_sample(std::string_view str) {
  HitSample hs;
  auto parts = split_view(str, ':');

  if (!parts.empty())
    hs.normal_set = binary::convert_to<int>(parts[0], 0);
  if (parts.size() > 1)
    hs.addition_set = binary::convert_to<int>(parts[1], 0);
  if (parts.size() > 2)
    hs.index = binary::convert_to<int>(parts[2], 0);
  if (parts.size() > 3)
    hs.volume = binary::convert_to<int>(parts[3], 0);
  if (parts.size() > 4)
    hs.filename = std::string(trim_view(parts[4]));

  return hs;
}

static HitSample default_hit_sample() { return parse_hit_sample("0:0:0:0:"); }

static std::vector<HitObject>
parse_hit_objects(const std::vector<std::string_view> &lines) {
  std::vector<HitObject> objects;
  objects.reserve(lines.size());

  for (const auto &line : lines) {
    auto parts = split_view(line, ',');
    if (parts.size() < 5) {
      continue;
    }

    HitObject ho;
    ho.x = binary::convert_to<int>(parts[0], 0);
    ho.y = binary::convert_to<int>(parts[1], 0);
    ho.time = binary::convert_to<int>(parts[2], 0);
    ho.type = binary::convert_to<int>(parts[3], 0);
    ho.hit_sound = binary::convert_to<int>(parts[4], 0);

    bool is_circle = (ho.type & 1) != 0;
    bool is_slider = (ho.type & 2) != 0;
    bool is_spinner = (ho.type & 8) != 0;
    bool is_hold = (ho.type & 128) != 0;

    if (is_slider && parts.size() >= 8) {
      auto curve_parts = split_view(parts[5], '|');

      if (!curve_parts.empty()) {
        auto type_str = trim_view(curve_parts[0]);
        if (!type_str.empty()) {
          ho.curve_type = type_str[0];
        }

        for (size_t i = 1; i < curve_parts.size(); i++) {
          auto point = split_view(curve_parts[i], ':');
          if (point.size() >= 2) {
            ho.curve_points.push_back({binary::convert_to<int>(point[0], 0),
                                       binary::convert_to<int>(point[1], 0)});
          }
        }
      }

      ho.slides = std::max(0, binary::convert_to<int>(parts[6], 1));
      ho.length = binary::convert_to<double>(parts[7], 0.0);
      size_t edge_count = static_cast<size_t>(ho.slides) + 1;

      if (parts.size() > 8) {
        for (const auto &s : split_view(parts[8], '|')) {
          ho.edge_sounds.push_back(binary::convert_to<int>(s, 0));
        }
      } else {
        ho.edge_sounds.assign(edge_count, 0);
      }

      if (parts.size() > 9) {
        for (const auto &ep : split_view(parts[9], '|')) {
          auto set = split_view(ep, ':');
          if (set.size() >= 2) {
            ho.edge_sets.push_back({binary::convert_to<int>(set[0], 0),
                                    binary::convert_to<int>(set[1], 0)});
          }
        }
      } else {
        ho.edge_sets.assign(edge_count, {0, 0});
      }

      if (parts.size() > 10) {
        ho.sample = parse_hit_sample(parts[10]);
      } else {
        ho.sample = default_hit_sample();
      }
    } else if (is_spinner && parts.size() >= 6) {
      ho.end_time = binary::convert_to<int>(parts[5], 0);
      if (parts.size() > 6) {
        ho.sample = parse_hit_sample(parts[6]);
      } else {
        ho.sample = default_hit_sample();
      }
    } else if (is_hold && parts.size() >= 6) {
      auto hold_parts = split_view(parts[5], ':');
      if (!hold_parts.empty()) {
        ho.end_time = binary::convert_to<int>(hold_parts[0], 0);
      }
      if (hold_parts.size() > 1) {
        std::string sample_str;
        for (size_t i = 1; i < hold_parts.size(); i++) {
          if (i > 1)
            sample_str += ":";
          sample_str += std::string(hold_parts[i]);
        }
        ho.sample = parse_hit_sample(sample_str);
      } else {
        ho.sample = default_hit_sample();
      }
    } else if (is_circle && parts.size() >= 6) {
      ho.sample = parse_hit_sample(parts[5]);
    } else if (is_circle) {
      ho.sample = default_hit_sample();
    }

    objects.push_back(ho);
  }

  return objects;
}

static int parse_version(std::string_view content) {
  size_t end = content.find('\n');
  auto first_line = trim_view(
      (end != std::string_view::npos) ? content.substr(0, end) : content);

  size_t v_pos = first_line.find('v');
  if (v_pos != std::string_view::npos) {
    return binary::convert_to<int>(first_line.substr(v_pos + 1), 14);
  }

  return 14;
}

static bool read_file_text(const std::string &location, std::string &out) {
  std::ifstream file(location, std::ios::binary | std::ios::ate);

  if (!file.is_open()) {
    return false;
  }

  const std::ifstream::pos_type size = file.tellg();

  if (size < 0) {
    return false;
  }

  out.resize(static_cast<size_t>(size));
  file.seekg(0, std::ios::beg);

  if (!file.read(out.data(), static_cast<std::streamsize>(out.size()))) {
    out.clear();
    return false;
  }

  return true;
}

static std::string serialize_hit_sample(const HitSample &hs) {
  return std::to_string(hs.normal_set) + ":" + std::to_string(hs.addition_set) +
         ":" + std::to_string(hs.index) + ":" + std::to_string(hs.volume) +
         ":" + hs.filename;
}

static std::string serialize_curve(const HitObject &ho) {
  std::ostringstream ss;
  ss << ho.curve_type;
  for (const auto &pt : ho.curve_points) {
    ss << "|" << pt.first << ":" << pt.second;
  }
  return ss.str();
}

bool beatmap_parser::parse(std::string location) {
  if (data == nullptr) {
    last_error = "parser data is null";
    return false;
  }

  beatmap_parser::location = std::move(location);
  std::string content;

  if (!read_file_text(beatmap_parser::location, content)) {
    last_error = "failed to read file";
    return false;
  }

  const int parsed_version = parse_version(content);

  *data = OsuBeatmap();
  data->version = parsed_version;
  data->general = parse_general(get_section(content, "General"));
  data->editor = parse_editor(get_section(content, "Editor"));
  data->metadata = parse_metadata(get_section(content, "Metadata"));
  data->difficulty = parse_difficulty(get_section(content, "Difficulty"));

  auto events = get_section(content, "Events");
  parse_events(events, data->background, data->video, data->breaks);

  data->timing_points =
      parse_timing_points(get_section(content, "TimingPoints"));
  data->colours = parse_colours(get_section(content, "Colours"));
  data->hit_objects = parse_hit_objects(get_section(content, "HitObjects"));

  data->version = parsed_version;
  last_error.clear();
  return true;
}

bool beatmap_parser::write() {
  if (data == nullptr || location.empty()) {
    last_error = data == nullptr ? "parser data is null" : "location is empty";
    return false;
  }

  BeatmapWriter writer;

  writer.line("osu file format v" + std::to_string(data->version));
  writer.blank();

  writer.section("General");
  writer.key_value("AudioFilename", data->general.audio_filename);
  writer.key_value("AudioLeadIn", data->general.audio_lead_in);

  if (!data->general.audio_hash.empty()) {
    writer.key_value("AudioHash", data->general.audio_hash);
  }

  writer.key_value("PreviewTime", data->general.preview_time);
  writer.key_value("Countdown", data->general.countdown);
  writer.key_value("SampleSet", data->general.sample_set);
  writer.key_value_double("StackLeniency", data->general.stack_leniency);
  writer.key_value("Mode", data->general.mode);
  writer.key_value("LetterboxInBreaks", data->general.letterbox_in_breaks);
  writer.key_value("StoryFireInFront", data->general.story_fire_in_front);
  writer.key_value("UseSkinSprites", data->general.use_skin_sprites);
  writer.key_value("AlwaysShowPlayfield", data->general.always_show_playfield);
  writer.key_value("OverlayPosition", data->general.overlay_position);

  if (!data->general.skin_preference.empty()) {
    writer.key_value("SkinPreference", data->general.skin_preference);
  }

  writer.key_value("EpilepsyWarning", data->general.epilepsy_warning);
  writer.key_value("CountdownOffset", data->general.countdown_offset);
  writer.key_value("SpecialStyle", data->general.special_style);
  writer.key_value("WidescreenStoryboard", data->general.widescreen_storyboard);
  writer.key_value("SamplesMatchPlaybackRate",
                   data->general.samples_match_playback_rate);

  writer.blank();

  writer.section("Editor");

  if (!data->editor.bookmarks.empty()) {
    writer.key_value("Bookmarks",
                     BeatmapWriter::join_ints(data->editor.bookmarks, ','));
  }

  writer.key_value_double("DistanceSpacing", data->editor.distance_spacing);
  writer.key_value("BeatDivisor", data->editor.beat_divisor);
  writer.key_value("GridSize", data->editor.grid_size);
  writer.key_value_double("TimelineZoom", data->editor.timeline_zoom);

  writer.blank();

  writer.section("Metadata");
  writer.key_value("Title", data->metadata.title);

  if (!data->metadata.title_unicode.empty()) {
    writer.key_value("TitleUnicode", data->metadata.title_unicode);
  }

  writer.key_value("Artist", data->metadata.artist);

  if (!data->metadata.artist_unicode.empty()) {
    writer.key_value("ArtistUnicode", data->metadata.artist_unicode);
  }

  writer.key_value("Creator", data->metadata.creator);
  writer.key_value("Version", data->metadata.version);

  if (!data->metadata.source.empty()) {
    writer.key_value("Source", data->metadata.source);
  }

  if (!data->metadata.tags.empty()) {
    writer.key_value("Tags", data->metadata.tags);
  }

  writer.key_value("BeatmapID", data->metadata.beatmap_id);
  writer.key_value("BeatmapSetID", data->metadata.beatmap_set_id);

  writer.blank();

  writer.section("Difficulty");

  writer.key_value_double("HPDrainRate", data->difficulty.hp_drain_rate);
  writer.key_value_double("CircleSize", data->difficulty.circle_size);
  writer.key_value_double("OverallDifficulty",
                          data->difficulty.overall_difficulty);
  writer.key_value_double("ApproachRate", data->difficulty.approach_rate);
  writer.key_value_double("SliderMultiplier",
                          data->difficulty.slider_multiplier);
  writer.key_value_double("SliderTickRate", data->difficulty.slider_tick_rate);

  writer.blank();

  writer.section("Events");

  if (data->video.has_value()) {
    const auto &v = data->video.value();
    writer.line("Video," + std::to_string(v.start_time) + ",\"" + v.filename +
                "\"," + std::to_string(v.x_offset) + "," +
                std::to_string(v.y_offset));
  }

  if (data->background.has_value()) {
    const auto &b = data->background.value();
    writer.line("0,0,\"" + b.filename + "\"," + std::to_string(b.x_offset) +
                "," + std::to_string(b.y_offset));
  }

  for (const auto &br : data->breaks) {
    writer.line("2," + std::to_string(br.start_time) + "," +
                std::to_string(br.end_time));
  }

  writer.blank();

  writer.section("TimingPoints");

  for (const auto &tp : data->timing_points) {
    writer.line(std::to_string(tp.time) + "," +
                BeatmapWriter::format_double(tp.beat_length) + "," +
                std::to_string(tp.meter) + "," + std::to_string(tp.sample_set) +
                "," + std::to_string(tp.sample_index) + "," +
                std::to_string(tp.volume) + "," +
                std::to_string(tp.uninherited) + "," +
                std::to_string(tp.effects));
  }

  writer.blank();

  writer.section("Colours");

  for (size_t i = 0; i < data->colours.combos.size(); i++) {
    const auto &c = data->colours.combos[i];
    writer.line("Combo" + std::to_string(i + 1) + " : " + std::to_string(c[0]) +
                "," + std::to_string(c[1]) + "," + std::to_string(c[2]));
  }

  if (data->colours.slider_track_override.has_value()) {
    const auto &c = data->colours.slider_track_override.value();
    writer.line("SliderTrackOverride : " + std::to_string(c[0]) + "," +
                std::to_string(c[1]) + "," + std::to_string(c[2]));
  }

  if (data->colours.slider_border.has_value()) {
    const auto &c = data->colours.slider_border.value();
    writer.line("SliderBorder : " + std::to_string(c[0]) + "," +
                std::to_string(c[1]) + "," + std::to_string(c[2]));
  }

  writer.blank();

  writer.section("HitObjects");

  for (const auto &ho : data->hit_objects) {
    std::ostringstream line;
    line << ho.x << "," << ho.y << "," << ho.time << "," << ho.type << ","
         << ho.hit_sound;

    bool is_circle = (ho.type & 1) != 0;
    bool is_slider = (ho.type & 2) != 0;
    bool is_spinner = (ho.type & 8) != 0;
    bool is_hold = (ho.type & 128) != 0;

    if (is_slider) {
      long long slides_plus = static_cast<long long>(ho.slides) + 1;

      if (slides_plus > INT_MAX) {
        slides_plus = INT_MAX;
      }

      const int edge_count = std::max(1, static_cast<int>(slides_plus));
      std::vector<int> edge_sounds = ho.edge_sounds;

      if (static_cast<int>(edge_sounds.size()) != edge_count) {
        edge_sounds.assign(edge_count, 0);
      }

      std::vector<std::pair<int, int>> edge_sets = ho.edge_sets;

      if (static_cast<int>(edge_sets.size()) != edge_count) {
        edge_sets.assign(edge_count, {0, 0});
      }

      line << "," << serialize_curve(ho);
      line << "," << ho.slides;
      line << "," << BeatmapWriter::format_double(ho.length);
      line << "," << BeatmapWriter::join_ints(edge_sounds, '|');
      line << "," << BeatmapWriter::join_pairs(edge_sets, '|');
      line << "," << serialize_hit_sample(ho.sample);
    } else if (is_spinner) {
      line << "," << ho.end_time;
      line << "," << serialize_hit_sample(ho.sample);
    } else if (is_hold) {
      line << "," << ho.end_time << ":" << serialize_hit_sample(ho.sample);
    } else if (is_circle) {
      line << "," << serialize_hit_sample(ho.sample);
    }

    writer.line(line.str());
  }

  std::ofstream file(location, std::ios::binary | std::ios::trunc);

  if (!file.is_open()) {
    last_error = "failed to write file";
    return false;
  }

  const std::string payload = writer.str();
  file.write(payload.data(), static_cast<std::streamsize>(payload.size()));

  if (!file.good()) {
    last_error = "failed to write file";
    return false;
  }

  last_error.clear();
  return true;
}
