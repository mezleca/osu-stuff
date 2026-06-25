import type { OsuFileFormat } from "@shared/types";
import fs from "fs";

export interface BeatmapMediaInfo {
    AudioFilename: string;
    Background: string;
    Video: string;
    Duration: number;
}

const DEFAULT_VERSION = "unknown";
const DEFAULT_SLIDER_MULTIPLIER = 1;
const BASE_SLIDER_FACTOR = 100;

const to_number = (value: string | undefined, fallback: number = 0): number => {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
        return fallback;
    }

    return parsed;
};

const split_key_value = (line: string): { key: string; value: string } | null => {
    const separator = line.indexOf(":");

    if (separator == -1) {
        return null;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (!key) {
        return null;
    }

    return { key, value };
};

const parse_events_line = (line: string, events: OsuFileFormat["Events"]): void => {
    const values = line.split(",").map((part) => part.trim());

    if (values.length < 3) {
        return;
    }

    const first = values[0]?.toLowerCase() ?? "";

    if (first == "0" || first == "background") {
        events.background = {
            filename: values[2]?.replace(/^"|"$/g, "") ?? "",
            xOffset: to_number(values[3], 0),
            yOffset: to_number(values[4], 0)
        };
        return;
    }

    if (first == "1" || first == "video") {
        events.video = {
            startTime: to_number(values[1], 0),
            filename: values[2]?.replace(/^"|"$/g, "") ?? "",
            xOffset: to_number(values[3], 0),
            yOffset: to_number(values[4], 0)
        };
        return;
    }

    if (first == "2" || first == "break") {
        events.breaks.push({
            startTime: to_number(values[1], 0),
            endTime: to_number(values[2], 0)
        });
    }
};

const parse_timing_point = (line: string): Record<string, number> | null => {
    const values = line.split(",");

    if (values.length < 2) {
        return null;
    }

    const point = {
        time: to_number(values[0], 0),
        beatLength: to_number(values[1], 0),
        meter: to_number(values[2], 4),
        sampleSet: to_number(values[3], 0),
        sampleIndex: to_number(values[4], 0),
        volume: to_number(values[5], 0),
        uninherited: to_number(values[6], 1),
        effects: to_number(values[7], 0)
    };

    return point;
};

const get_beat_length_at = (timing_points: Array<Record<string, number>>, time: number): number => {
    let current = 500;

    for (const point of timing_points) {
        const point_time = to_number(String(point.time ?? 0), 0);

        if (point_time > time) {
            break;
        }

        if (to_number(String(point.uninherited ?? 1), 1) == 1) {
            const beat_length = to_number(String(point.beatLength ?? 0), 0);

            if (beat_length > 0) {
                current = beat_length;
            }
        }
    }

    return current;
};

const estimate_hitobject_end_time = (line: string, timing_points: Array<Record<string, number>>, slider_multiplier: number): number => {
    const values = line.split(",");
    if (values.length < 5) {
        return 0;
    }

    const time = to_number(values[2], 0);
    const type = to_number(values[3], 0);

    const is_spinner = (type & 8) != 0;
    if (is_spinner) {
        return Math.max(time, to_number(values[5], time));
    }

    const is_slider = (type & 2) != 0;

    if (!is_slider) {
        return time;
    }

    if (values.length < 8) {
        return time;
    }

    const slides = Math.max(1, to_number(values[6], 1));
    const slider_length = Math.max(0, to_number(values[7], 0));
    const beat_length = get_beat_length_at(timing_points, time);
    const effective_multiplier = slider_multiplier > 0 ? slider_multiplier : DEFAULT_SLIDER_MULTIPLIER;
    const slider_duration = (slider_length * slides * beat_length) / (effective_multiplier * BASE_SLIDER_FACTOR);

    if (Number.isFinite(slider_duration) && slider_duration > 0) {
        return Math.round(time + slider_duration);
    }

    return time;
};

const get_default_beatmap = (): OsuFileFormat => {
    return {
        version: DEFAULT_VERSION,
        audio_duration: 0,
        General: {},
        Editor: {},
        Metadata: {},
        Difficulty: {},
        Events: {
            background: null,
            video: null,
            breaks: []
        },
        TimingPoints: [],
        Colours: {},
        HitObjects: []
    };
};

export class BeatmapParser {
    private data: OsuFileFormat = get_default_beatmap();

    parse = async (location: string): Promise<this> => {
        const content = fs.readFileSync(location, "utf8");
        this.data = this.parse_content(content);
        return this;
    };

    private parse_content = (content: string): OsuFileFormat => {
        const result = get_default_beatmap();
        const lines = content.split(/\r?\n/);

        let current_section = "";
        let max_hitobject_end_time = 0;

        for (const raw_line of lines) {
            const line = raw_line.trim();

            if (!line || line.startsWith("//")) {
                continue;
            }

            if (line.startsWith("osu file format v")) {
                result.version = line.replace("osu file format v", "").trim();
                continue;
            }

            if (line.startsWith("[") && line.endsWith("]")) {
                current_section = line.slice(1, -1);
                continue;
            }

            if (current_section == "General" || current_section == "Editor" || current_section == "Metadata" || current_section == "Difficulty") {
                const parsed = split_key_value(line);

                if (!parsed) {
                    continue;
                }

                const { key, value } = parsed;

                const numeric = Number(value);
                const resolved = Number.isNaN(numeric) ? value : numeric;

                if (current_section == "General") {
                    result.General[key] = resolved;
                } else if (current_section == "Editor") {
                    result.Editor[key] = resolved;
                } else if (current_section == "Metadata") {
                    result.Metadata[key] = resolved;
                } else {
                    result.Difficulty[key] = resolved;
                }

                continue;
            }

            if (current_section == "Events") {
                parse_events_line(line, result.Events);
                continue;
            }

            if (current_section == "TimingPoints") {
                const point = parse_timing_point(line);

                if (point) {
                    result.TimingPoints.push(point);
                }

                continue;
            }

            if (current_section == "HitObjects") {
                const slider_multiplier = to_number(
                    String(result.Difficulty.SliderMultiplier ?? DEFAULT_SLIDER_MULTIPLIER),
                    DEFAULT_SLIDER_MULTIPLIER
                );
                const end_time = estimate_hitobject_end_time(line, result.TimingPoints, slider_multiplier);

                if (end_time > max_hitobject_end_time) {
                    max_hitobject_end_time = end_time;
                }
            }
        }

        result.audio_duration = max_hitobject_end_time;
        return result;
    };

    get = (): OsuFileFormat => {
        return this.data;
    };

    get_media = (): BeatmapMediaInfo => {
        const background = this.data.Events.background?.filename ?? "";
        const video = this.data.Events.video?.filename ?? "";
        const audio = String(this.data.General.AudioFilename ?? "");

        return {
            AudioFilename: audio,
            Background: background,
            Video: video,
            Duration: this.data.audio_duration
        };
    };

    update = (patch: Partial<OsuFileFormat>): this => {
        this.data = {
            ...this.data,
            ...patch,
            General: { ...this.data.General, ...patch.General },
            Editor: { ...this.data.Editor, ...patch.Editor },
            Metadata: { ...this.data.Metadata, ...patch.Metadata },
            Difficulty: { ...this.data.Difficulty, ...patch.Difficulty },
            Events: {
                ...this.data.Events,
                ...patch.Events,
                breaks: patch.Events?.breaks ?? this.data.Events.breaks
            },
            TimingPoints: patch.TimingPoints ?? this.data.TimingPoints,
            HitObjects: patch.HitObjects ?? this.data.HitObjects,
            Colours: patch.Colours ?? this.data.Colours
        };

        return this;
    };

    write = async (): Promise<void> => {
        return;
    };

    free = (): void => {
        this.data = get_default_beatmap();
    };
}
