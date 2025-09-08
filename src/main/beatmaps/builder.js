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

    set_audio(location) {
        this.properties.set("AudioFilename", {
            value: location,
            path: true
        });
    }

    set_image(location) {
        this.properties.set("Background", {
            value: [0, 0, location], // x, y, filename (full path for now)
            path: true
        });
    }

    get(key) {
        const prop = this.properties.get(key);
        // if its a path object, return the value
        if (prop && typeof prop == "object" && prop.path) {
            return prop.value;
        }
        return prop;
    }

    get_image() {
        const bg = this.properties.get("Background");
        if (!bg || !bg.value || !Array.isArray(bg.value)) {
            return false;
        }
        return path.basename(bg.value[2]); // return just the filename
    }

    has(key) {
        return this.properties.has(key);
    }
}

export class BeatmapBuilder {
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
                } else if (has_custom_value) {
                    const prop = file.properties.get(property.key);

                    // check if this property has path flag
                    if (prop && typeof prop == "object" && prop.path) {
                        value = prop.value;

                        // if its a string path (like audio), use basename for .osu
                        if (typeof value == "string") {
                            value = path.basename(value);
                        }
                        // if its array (like background), process the path at index 2
                        else if (Array.isArray(value)) {
                            value = [...value]; // copy array
                            value[2] = path.basename(value[2]); // convert path to basename
                        }
                    } else {
                        value = prop;
                    }
                }

                // handle array values
                if (Array.isArray(value)) {
                    let new_value = "";

                    for (let i = 0; i < value.length; i++) {
                        console.log("adding property", value[i]);

                        if (typeof value[i] == "number") {
                            new_value += value[i];
                        } else {
                            // images, videos needs double quotes
                            new_value += `"${value[i]}"`;
                        }

                        // separate values by ","
                        if (i != value.length - 1) {
                            new_value += ",";
                        }
                    }

                    buffer.push(new_value);
                } else {
                    // fallback to default value if available
                    if (!value) {
                        value = property.value;
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

        const audio_prop = file.properties.get("AudioFilename");
        const audio_location = audio_prop && audio_prop.path ? audio_prop.value : null;
        const file_name = file.get("Title");

        const bg_prop = file.properties.get("Background");
        const background_location = bg_prop && bg_prop.path ? bg_prop.value[2] : null;
        const background_filename = file.get_image();

        // ensure audio file exists
        if (!audio_location || !fs.existsSync(audio_location)) {
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
