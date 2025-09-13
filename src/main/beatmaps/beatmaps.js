import { createHash } from "crypto";
import { config } from "../database/config";
import { process_beatmaps } from "../database/indexer";
import { reader } from "../reader/reader";

import fs from "fs";
import path from "path";
import Realm from "realm";

export const GAMEMODES = ["osu!", "taiko", "ctb", "mania"];
export const MAX_STAR_RATING_VALUE = 10; // lazer

// sort shit
const TEXT_SORT_KEYS = ["title", "artist"];
const NUMBER_SORT_KEYS = ["duration", "length", "ar", "cs", "od", "hp"];

let osu_data = null;

// get nm star rating based on gamemode
export const get_beatmap_sr = (beatmap, gamemode = 0) => {
    try {
        const star_rating = beatmap?.star_rating;

        if (!star_rating || star_rating.length == 0) {
            return Number(0).toFixed(2);
        }

        const result = star_rating[gamemode].pair[1] ?? 0;
        return Number(result).toFixed(2);
    } catch (err) {
        console.log(err);
        return Number(0).toFixed(2);
    }
};

// https://github.com/ppy/osu/blob/775cdc087eda5c1525d763c6fa3d422db0e93f66/osu.Game/Beatmaps/Beatmap.cs#L81
export const get_common_bpm = (timing_points, length) => {
    if (!timing_points || timing_points?.length == 0) {
        return 0;
    }

    const beat_length_map = new Map();
    const last_time = length > 0 ? length : timing_points[timing_points.length - 1].offset;

    for (let i = 0; i < timing_points.length; i++) {
        const point = timing_points[i];

        if (point.offset > last_time) {
            continue;
        }

        const bpm = Math.round((60000 / point.beat_length) * 1000) / 1000;
        const current_time = i == 0 ? 0 : point.offset;
        const next_time = i == timing_points.length - 1 ? last_time : timing_points[i + 1].offset;
        const duration = next_time - current_time;

        beat_length_map.set(bpm, (beat_length_map.get(bpm) || 0) + duration);
    }

    return [...beat_length_map.entries()].reduce((max, [bpm, duration]) => (duration > max.duration ? { bpm, duration } : max), {
        bpm: 0,
        duration: 0
    }).bpm;
};

const to_type = (v) => {
    if (typeof v == "string" && v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1);
    }

    const value = Number(v);
    return isNaN(value) ? v : value;
};

const renamed_list = new Map([["star", "star_rating"]]);
const get_key = (key) => renamed_list.get(key) || key;

const validate_filter = (key, op, value) => {
    if (key == null) {
        return false;
    }

    switch (op) {
        case "=":
            return key == value;
        case "!=":
            return key != value;
        case ">":
            return key > value;
        case ">=":
            return key >= value;
        case "<":
            return key < value;
        case "<=":
            return key <= value;
        default:
            return true;
    }
};

// filter beatmap based on query and search filters
export const search_filter = (beatmap, query, search_filters) => {
    let valid = true;

    if (beatmap == null) {
        return false;
    }

    const artist = beatmap.artist || "unknown";
    const title = beatmap.title || "unknown";
    const difficulty = beatmap?.difficulty || "unknown";
    const creator = beatmap?.mapper || "unknown";
    const tags = beatmap?.tags || "";
    const searchable_text = `${artist} ${title} ${difficulty} ${creator} ${tags}`.toLowerCase();

    // clean query by removing filter expressions
    let clean_query = query;

    for (const filter of search_filters) {
        clean_query = clean_query.replace(filter.text, "");
    }

    clean_query = clean_query.trim();

    // check text match if theres remaining query
    const text_included = clean_query == "" || searchable_text.includes(clean_query.toLowerCase());

    if (search_filters.length == 0) {
        return text_included;
    }

    for (const filter of search_filters) {
        const thing = to_type(filter.v);

        // ignore invalid filters
        if (!thing || thing == "") {
            continue;
        }

        const key = get_key(filter.k);

        // hack
        // also need global gamemode variable
        if (key == "star_rating") {
            if (!validate_filter(beatmap?.[key][0]?.nm, filter.o, thing)) {
                valid = false;
                break;
            }
        } else {
            if (!validate_filter(beatmap?.[key], filter.o, thing)) {
                valid = false;
                break;
            }
        }
    }

    return valid && text_included;
};

export const filter_beatmap = (beatmap, query) => {
    const search_filters = [];
    const regex = /\b(?<key>\w+)(?<op>!?[:=]|[><][:=]?)(?<value>(".*?"|\S+))/g;

    for (const match of query.matchAll(regex)) {
        const [text, k, o, v] = match;
        search_filters.push({ text, k, o, v });
    }

    // filter by search
    return search_filter(beatmap, query, search_filters);
};

export const get_playername = () => {
    return osu_data.player_name;
};

export const minify_beatmap_result = (result) => {
    return {
        md5: result.md5,
        title: result.title,
        artist: result.title,
        creator: result.creator,
        beatmapset_id: result.beatmapset_id,
        difficulty_id: result.difficulty_id,
        bpm: result?.bpm,
        star_rating: result.star_rating,
        status_text: result.status_text,
        audio_path: result.audio_path,
        image_path: result.image_path,
        mode: result.mode,
        local: result.local,
        downloaded: result.downloaded
    };
};

export const get_beatmap_by_md5 = (md5) => {
    const result = osu_data.beatmaps.get(md5);

    if (!result) {
        return false;
    }

    return minify_beatmap_result(result);
};

export const get_beatmaps_by_id = (id) => {
    const beatmaps = [];
    for (const [_, beatmap] of osu_data.beatmaps) {
        if (beatmap.unique_id == id) {
            beatmaps.push(beatmap);
        }
    }
    return beatmaps;
};

export const get_beatmap_by_set_id = (id) => {
    for (const [_, beatmap] of osu_data.beatmaps) {
        if (beatmap.beatmapset_id == id) {
            return minify_beatmap_result(beatmap);
        }
    }
    return false;
};

export const get_beatmap_data = (id, query, is_unique_id) => {
    const result = { filtered: false, beatmap: null };

    // ignore unknown maps if we dont have a query yet
    if (!id || id == "") {
        result.filtered = true;
        return result;
    }

    result.beatmap = is_unique_id ? get_beatmaps_by_id(id) : get_beatmap_by_md5(id);

    // ignore unknown maps if we dont have a query yet
    if (!result.beatmap && query == "") {
        result.beatmap = { [is_unique_id ? "id" : "md5"]: id };
        return result;
    }

    if (query && query != "") {
        const passes_filter = filter_beatmap(result.beatmap, query);
        result.filtered = !passes_filter;
        return result;
    }

    return result;
};

const normalize_text = (text) => {
    if (!text) {
        return "";
    }

    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
};

// sort beatmaps by type (descending)
export const sort_beatmaps = (beatmaps, type) => {
    // mhm
    if (!TEXT_SORT_KEYS.includes(type) && !NUMBER_SORT_KEYS.includes(type)) {
        return beatmaps;
    }

    const result = beatmaps.sort((a, b) => {
        if (TEXT_SORT_KEYS.includes(type)) {
            const a_val = normalize_text(a[type]);
            const b_val = normalize_text(b[type]);

            // push empty/invalid values to the end
            if (!a_val && b_val) return 1;
            if (a_val && !b_val) return -1;
            if (!a_val && !b_val) return 0;

            return a_val.localeCompare(b_val);
        } else {
            const a_val = a[type] || 0;
            const b_val = b[type] || 0;

            // push null/undefined values to the end
            if ((a_val == null || a_val == undefined) && b_val != null && b_val != undefined) return 1;
            if (a_val != null && a_val != undefined && (b_val == null || b_val == undefined)) return -1;
            if ((a_val == null || a_val == undefined) && (b_val == null || b_val == undefined)) return 0;

            return b_val - a_val;
        }
    });

    return result;
};

export const filter_by_sr = (beatmap, min, max) => {
    // ignore unknown beatmaps
    if (!beatmap || typeof beatmap == "string") {
        return true;
    }

    // again
    if (!beatmap?.star_rating || beatmap.star_rating?.length == 0 || isNaN(beatmap.mode)) {
        return true;
    }

    // normalize inputs
    const min_val = min == undefined || min == null ? null : Number(min);
    const max_val = max == undefined || max == null ? null : Number(max);

    // no sr filter
    if (min_val == null && max_val == null) {
        return true;
    }

    // get numeric star rating for the beatmap (based on its mode)
    const sr = Number(get_beatmap_sr(beatmap, beatmap.mode ?? 0));
    if (isNaN(sr)) return true;

    // apply min/max checks
    if (min_val != null && sr < min_val) return false;
    if (max_val != null && max_val != MAX_STAR_RATING_VALUE && sr > max_val) return false;

    return true;
};

export const get_missing_beatmaps = (beatmaps) => {
    const missing_beatmaps = [];

    if (!beatmaps) {
        return missing_beatmaps;
    }

    for (let i = 0; i < beatmaps.length; i++) {
        const md5 = beatmaps[i];
        const beatmap = osu_data.beatmaps.get(md5) || {};

        // if you download something from osu!Collector, the function will add basic metadata to reader object such as: title, artist, etc...
        // so we need to make sure this variable is false
        if (beatmap?.downloaded) {
            continue;
        }

        missing_beatmaps.push({ md5 });
    }

    return missing_beatmaps;
};

export const filter_beatmaps = (list, query, extra = { unique: false, invalid: false, sort: null, sr: null, status: null }) => {
    if (!osu_data) {
        return [];
    }

    const beatmaps = list ? list : Array.from(osu_data.beatmaps.keys());
    const seen_unique_ids = new Set();

    if (!beatmaps) {
        console.log("failed to get beatmaps array");
        return [];
    }

    let filtered_beatmaps = [];

    // filter beatmaps based on query and stuff
    for (let i = 0; i < beatmaps.length; i++) {
        const list_beatmap = beatmaps[i];
        const { beatmap, filtered } = get_beatmap_data(list_beatmap, query ?? "", false);

        if (filtered) {
            continue;
        }

        // extra.invalid == i dont give a fuck if the map is invalid bro, just gimme ts
        if (!extra.invalid && !beatmap.hasOwnProperty("downloaded")) {
            continue;
        }

        // filter by status
        if (extra.status) {
            // oh yeah, more hacks
            if (!config.lazer_mode && (extra.status == "graveyard" || extra.status == "wip")) {
                extra.status = "pending";
            }

            if (beatmap.status_text != extra.status) continue;
        }

        // check if we already added this unique id
        if (extra.unique && beatmap?.unique_id && seen_unique_ids.has(beatmap?.unique_id)) {
            continue;
        }

        // filter by sr
        if (beatmap && extra.sr) {
            const result = filter_by_sr(beatmap, extra.sr.min, extra.sr.max);

            if (!result) {
                continue;
            }
        }

        filtered_beatmaps.push(beatmap);

        if (extra.unique && beatmap?.unique_id) {
            seen_unique_ids.add(beatmap.unique_id);
        }
    }

    // sort pass
    if (extra.sort != null) {
        filtered_beatmaps = sort_beatmaps(filtered_beatmaps, extra.sort);
    }

    // return only hashes
    return filtered_beatmaps.map((b) => (typeof b == "string" ? b : b?.md5));
};

export const add_beatmap = (hash, beatmap) => {
    if (!hash || !beatmap) {
        console.log("failed to add beatmap (missing shit)");
        return false;
    }

    osu_data.beatmaps.set(hash, beatmap);
};

export const get_beatmaps_from_database = async (force) => {
    if (force) {
        osu_data = null;
    }

    if (osu_data) {
        return true;
    }

    const osu_folder = config.lazer_mode ? config.lazer_path : config.stable_path;

    if (!osu_folder) {
        console.error("[get beatmaps] failed to get osu! folder");
        return false;
    }

    const file_path = config.lazer_mode ? path.resolve(osu_folder, "client.realm") : path.resolve(osu_folder, "osu!.db");

    if (!fs.existsSync(file_path)) {
        console.error("[get beatmaps] failed to get osu.db file in", file_path);
        return false;
    }

    const result = await reader.get_osu_data(file_path);

    if (!result) {
        console.error("[get beatmaps] failed to read osu file");
        return false;
    }

    osu_data = result;
    osu_data.beatmaps = await process_beatmaps(osu_data.beatmaps);

    return true;
};

const get_md5_hash = (file_path) => {
    const content = fs.readFileSync(file_path);
    return createHash("md5").update(content).digest("hex");
};

const create_lazer_beatmap = (metadata, beatmapset_files) => {
    const realm = reader.instance;

    if (!realm) {
        console.error("realm instance not found");
        return null;
    }

    // find or create ruleset
    let ruleset = realm.objectForPrimaryKey("Ruleset", "osu");

    if (!ruleset) {
        console.error("ruleset osu not found");
        return null;
    }

    let beatmap_result = null;

    realm.write(() => {
        const files = [];

        let beatmap_hash = null;
        let beatmap_md5 = null;
        let audio_file = null;
        let background_file = null;
        let osu_file_path = null;

        // process files
        for (const file of beatmapset_files) {
            let realm_file = realm.objectForPrimaryKey("File", file.hash);

            if (!realm_file) {
                realm_file = realm.create("File", {
                    Hash: file.hash
                });
            }

            const ext = path.extname(file.name).toLowerCase();

            if (ext == ".osu") {
                beatmap_hash = file.hash;
                osu_file_path = file.location;
            } else if ([".mp3", ".ogg", ".wav"].includes(ext)) {
                audio_file = file.name;
            } else if ([".jpg", ".jpeg", ".png"].includes(ext)) {
                background_file = file.name;
            }

            // update
            files.push({
                File: realm_file,
                Filename: file.name
            });
        }

        // calculate proper md5 hash from .osu file content
        if (osu_file_path && fs.existsSync(osu_file_path)) {
            beatmap_md5 = get_md5_hash(osu_file_path);
            console.log("calculated md5 hash:", beatmap_md5);
        } else {
            console.warn("osu file not found, using sha256 as fallback");
            beatmap_md5 = beatmap_hash;
        }

        // create beatmap set
        const beatmap_set = realm.create("BeatmapSet", {
            ID: new Realm.BSON.UUID(),
            OnlineID: -1,
            Files: files,
            Hash: beatmap_hash,
            DateAdded: new Date(),
            Status: -3,
            DeletePending: false,
            Protected: false
        });

        // create metadata
        const beatmap_metadata = realm.create("BeatmapMetadata", {
            Title: metadata.title || "Untitled",
            Artist: metadata.artist || "osu-stuff",
            TitleUnicode: metadata.title || "Untitled",
            ArtistUnicode: metadata.artist || "osu-stuff",
            AudioFile: audio_file,
            BackgroundFile: background_file,
            Author: { OnlineID: 1, Username: "mzle", CountryCode: "Unknown" },
            Tags: "",
            Source: "",
            PreviewTime: 0
        });

        // create the beatmap
        const beatmap = realm.create("Beatmap", {
            ID: new Realm.BSON.UUID(),
            DifficultyName: "Normal",
            Ruleset: ruleset,
            Difficulty: {
                DrainRate: 5.0,
                CircleSize: 4.0,
                OverallDifficulty: 5.0,
                ApproachRate: 5.0,
                SliderMultiplier: 1.4,
                SliderTickRate: 1.0
            },
            Metadata: beatmap_metadata,
            UserSettings: {
                Offset: 0.0
            },
            Hash: beatmap_hash, // thats prob not what its supossed to be
            MD5Hash: beatmap_md5,
            BeatmapSet: beatmap_set,
            OnlineID: -1,
            Length: 0.0,
            BPM: 120.0,
            StarRating: -1.0,
            Status: -3,
            Hidden: false,
            EndTimeObjectCount: -1,
            TotalObjectCount: -1,
            BeatDivisor: 4
        });

        beatmap_set.Beatmaps.push(beatmap);
        beatmap_result = beatmap;
    });

    return beatmap_result;
};

export const add_local_beatmap = async (metadata, files) => {
    if (config.lazer_mode) {
        if (!reader.instance) {
            console.error("realm instace not found");
            return false;
        }

        const files_data = [];

        // get hashes
        for (const file of files) {
            const hash = get_md5_hash(file);
            const name = path.basename(file);

            // move files to lazer
            const destination = path.resolve(config.lazer_path, "files", hash.substring(0, 1), hash.substring(0, 2), hash);
            fs.cpSync(file, destination);

            console.log(`copied ${file} to ${destination}`);

            // add
            files_data.push({ hash, name, location: file });
        }

        // create new lazer beatmap
        create_lazer_beatmap(metadata, files_data);
    } else {
        return false;
    }

    return true;
};
