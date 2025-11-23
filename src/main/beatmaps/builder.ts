// @ts-ignore
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { GenericResult } from "@shared/types";

// @TODO: video support
class LegacyBeatmapFile {
    properties: Map<string, any> = new Map();
    version: string = "osu file format v14\n";
    section_data = new Map([
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

    constructor() {}

    // set option
    set(key: string, value: string) {
        this.properties.set(key, value);
    }

    set_audio(location: string) {
        if (!fs.existsSync(location)) {
            throw new Error("audio file does not exists: " + location);
        }

        this.properties.set("AudioFilename", {
            value: location,
            path: true
        });
    }

    set_image(location: string) {
        // ensure file actually exists
        if (!fs.existsSync(location)) {
            throw new Error("image file does not exists");
        }

        this.properties.set("Background", {
            value: [0, 0, location], // x, y, filename (full path for now)
            path: true
        });
    }

    get(key: string) {
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

    has(key: string) {
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

    write(file: LegacyBeatmapFile) {
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
                            // @ts-ignore
                            value = [...value]; // copy array
                            // @ts-ignore
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
                        // @ts-ignore
                        value = property.value;
                    }

                    buffer.push(`${property.key}:${value}`);
                }
            }

            buffer.push(""); // add blank line between each section
        }

        return buffer.join("\n");
    }

    async zip(file: LegacyBeatmapFile): Promise<GenericResult<Buffer>> {
        const buffer = this.write(file);
        const zip = new JSZip();

        const audio_prop = file.properties.get("AudioFilename");
        const audio_location = audio_prop && audio_prop.path ? audio_prop.value : null;
        const file_name = file.get("Title");

        const bg_prop = file.properties.get("Background");
        const background_location = bg_prop && bg_prop.path ? bg_prop.value[2] : null;
        const background_filename = file.get_image();

        // ensure audio file exists
        if (!audio_location || !fs.existsSync(audio_location)) {
            console.error("builder: failed to find audio file");
            return { success: false, reason: "failed to find audio file" };
        }

        // add audio file with correct name in zip
        const audio_filename = path.basename(audio_location);
        zip.file(audio_filename, fs.readFileSync(audio_location));

        // add background if present
        if (background_filename && background_location && fs.existsSync(background_location)) {
            zip.file(background_filename, fs.readFileSync(background_location));
        }

        // add .osu file
        zip.file(`${file_name}.osu`, Buffer.from(buffer));

        const target_buffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 9 }
        });

        return { success: true, data: target_buffer };
    }
}

export const beatmap_builder = new BeatmapBuilder();
