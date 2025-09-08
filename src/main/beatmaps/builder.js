import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

// @TODO: video support
class LegacyBeatmapFile {
    constructor() {
        this.properties = new Map();
        this.version = "osu file format v14\n";
        this.section_data = new Map([
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
            ["Events", [{ key: "Background", value: "// not specified" }]],
            ["HitObject", []]
        ]);
    }

    // set option
    set(key, value) {
        this.properties.set(key, value);
    }

    set_image(location) {
        const file_name = path.basename(location);
        this.properties.set("Background", [0, 0, file_name]); // x, y, filename
        this.properties.set("BackgroundLocation", location); // store full path separately
    }

    get(key) {
        return this.properties.get(key);
    }

    get_image() {
        if (!this.properties.has("Background")) {
            return false;
        }
        return this.properties.get("Background")[2];
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

                // use explicit mapping for Unicode keys to their fallback values
                if (!has_custom_value && (property.key == "ArtistUnicode" || property.key == "TitleUnicode")) {
                    const fallback_map = {
                        ArtistUnicode: "Artist",
                        TitleUnicode: "Title"
                    };
                    const fallback_key = fallback_map[property.key];
                    value = file.get(fallback_key) ?? "";
                }

                // fix AudioFilename to use only basename, not full path
                if (property.key == "AudioFilename" && has_custom_value) {
                    const audio_path = file.get(property.key);
                    value = path.basename(audio_path);
                }

                // https://osu.ppy.sh/wiki/en/Client/File_formats/osu_%28file_format%29
                if (Array.isArray(value)) {
                    for (const v of value) {
                        if (isNaN(Number(v))) {
                            buffer.push(`"${v}"`);
                        } else {
                            buffer.push(v);
                        }
                    }
                } else {
                    // fallback to default value if available
                    if (!value) {
                        value = has_custom_value ? file.get(property.key) : property.value;
                    }

                    buffer.push(`${property.key}:${value}`);
                }
            }

            buffer.push(""); // add blank line between each section
        }

        return buffer.join("\n");
    }

    /** @param {LegacyBeatmapFile} file */
    zip(file) {
        const buffer = this.write(file);
        const zip = new AdmZip();

        const audio_location = file.get("AudioFilename");
        const file_name = file.get("Title");
        const background_location = file.get("BackgroundLocation");
        const background_filename = file.get_image();

        // ensure audio file exists
        if (!fs.existsSync(audio_location)) {
            console.error("builder: failed to find audio file");
            return false;
        }

        // add audio file with correct name in zip
        const audio_filename = path.basename(audio_location);
        zip.addLocalFile(audio_location, "", audio_filename);

        // add background if present
        if (background_location && fs.existsSync(background_location)) {
            zip.addLocalFile(background_location, "", background_filename);
        }

        // add .osu file
        zip.addFile(`${file_name}.osu`, Buffer.from(buffer));

        return zip.toBuffer();
    }
}

export const beatmap_builder = new BeatmapBuilder();
