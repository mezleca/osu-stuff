import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

const DEFAULT_AUDIO_NAME = "audio.mp3";

// @TODO: background / storyboard support
class LegacyBeatmapFile {
    constructor() {
        this.properties = new Map();
        this.version = "osu file format v14\n";
        this.section_data = new Map([
            // @TODO: idk if this is broken, tested with a .opus file and dint work (maybe .opus issue? idk)
            [
                "General",
                [
                    { key: "AudioFilename", required: true },
                    { key: "SampleSet", value: "None" },
                    { key: "AudioLeadIn", value: 0 },
                    { key: "PreviewTime", value: -1 },
                    { key: "Countdown", value: 0 },
                    { key: "StackLeniency", value: 0.7 },
                    { key: "Mode", value: 0 },
                    { key: "LetterboxInBreaks", value: 0 },
                    { key: "WidescreenStoryboard", value: 0 }
                ]
            ],
            [
                "Editor",
                [
                    { key: "DistanceSpacing", value: 2 },
                    { key: "BeatDivisor", value: 4 },
                    { key: "GridSize", value: 1 },
                    { key: "TimelineZoom", value: 1 }
                ]
            ],
            [
                "Metadata",
                [
                    { key: "Title", required: true },
                    { key: "TitleUnicode", value: "" },
                    { key: "Artist", required: true },
                    { key: "ArtistUnicode", value: "" },
                    { key: "Creator", value: "osu-stuff" },
                    { key: "Version", value: "hello, world!" },
                    { key: "Source", value: "" },
                    { key: "Tags", value: "" },
                    { key: "BeatmapID", value: 0 },
                    { key: "BeatmapSetID", value: -1 }
                ]
            ],
            [
                "Difficulty",
                [
                    { key: "HPDrainRate", value: 5 },
                    { key: "CircleSize", value: 5 },
                    { key: "OverallDifficulty", value: 5 },
                    { key: "ApproachRate", value: 5 },
                    { key: "SliderMultiplier", value: 1.4 },
                    { key: "SliderTickRate", value: 1 }
                ]
            ],
            ["Events", []],
            ["HitObject", []]
        ]);
    }

    set(key, value) {
        this.properties.set(key, value);
    }

    get(key) {
        return this.properties.get(key);
    }

    has(key) {
        return this.properties.has(key);
    }
}

class BeatmapBuilder {
    constructor() {}

    create() {
        return new LegacyBeatmapFile();
    }

    read() {
        throw new Error("read(): not implemented yet");
    }

    /** @param {LegacyBeatmapFile} file */
    write(file) {
        if (!(file instanceof LegacyBeatmapFile)) {
            throw new Error("builder: not a instance of LegacyBeatmapFile...");
        }

        // initialize buffer with version
        const buffer = [file.version];

        for (const [section, data] of file.section_data) {
            // write new section
            buffer.push(`[${section}]`);

            // add section properties
            for (const property of data) {
                let value = "";
                const has_custom_value = file.has(property.key);

                // throws if we dont have a required key
                if (property.required && !has_custom_value) {
                    throw new Error(`builder: missing ${property.key}`);
                }

                // Use explicit mapping for Unicode keys to their fallback values
                if (!has_custom_value && (property.key === "ArtistUnicode" || property.key === "TitleUnicode")) {
                    const fallbackMap = {
                        ArtistUnicode: "Artist",
                        TitleUnicode: "Title"
                    };
                    const fallbackKey = fallbackMap[property.key];
                    value = file.get(fallbackKey) ?? "";
                }

                // fallback to default value if available
                if (!value) {
                    value = has_custom_value ? file.get(property.key) : property.value;
                }

                buffer.push(`${property.key}:${value}`);
            }

            buffer.push(""); // add blank line between each section
        }

        return buffer.join("\n");
    }

    /** @param {LegacyBeatmapFile} file */
    zip(file) {
        const buffer = this.write(file);
        const zip = new AdmZip();

        const file_location = file.get("AudioLocation");
        const file_name = file.get("Title");

        // ensure audio file exists
        if (!fs.existsSync(file_location)) {
            console.log("builder: failed to find audio file");
            return false;
        }

        // add audio file
        zip.addLocalFile(DEFAULT_AUDIO_NAME, file_location);

        // add .osu file
        zip.addFile(`${file_name}.osu`, buffer);

        return zip.toBuffer();
    }
}

export const beatmap_builder = new BeatmapBuilder();
