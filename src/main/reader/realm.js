import { GAMEMODES } from "../beatmaps/beatmaps";
import { config } from "../database/config";

import Realm from "realm";
import path from "path";

const LAZER_SCHEMA_VERSION = 51;

export const lazer_beatmap_status = {
    "-4": "LocacllyModified",
    "-3": "Unsubmitted",
    "-2": "graveyard",
    "-1": "wip",
    0: "pending",
    1: "ranked",
    2: "approved",
    3: "qualified",
    4: "loved"
};

export const get_realm_instance = (path, schemas) => {
    const instance = new Realm({
        path,
        schema: schemas,
        schemaVersion: LAZER_SCHEMA_VERSION
    });
    return instance;
};

export const get_lazer_beatmaps = (instance) => {
    return instance.objects("Beatmap");
};

const create_mode_star_rating = (star_rating) => ({
    nm: Math.round(star_rating * 100) / 100,
    pair: [[0, Math.round(star_rating * 100) / 100]]
});

const create_star_rating = (rating) => {
    return GAMEMODES.map(() => create_mode_star_rating(rating));
};

export const get_lazer_file_location = (name) => {
    if (!name) return "";
    const lazer_files_path = path.resolve(config.lazer_path, "files");
    return path.resolve(lazer_files_path, `${name.substring(0, 1)}/${name.substring(0, 2)}/${name}`);
};

export const convert_lazer_to_stable = (lazer_beatmaps) => {
    const beatmaps = new Map();

    for (let i = 0; i < lazer_beatmaps.length; i++) {
        const beatmap = lazer_beatmaps[i];

        // ignore unknwon beatmaps
        if (!beatmap?.MD5Hash || !beatmap?.BeatmapSet) {
            continue;
        }

        const metadata = beatmap.Metadata;
        const difficulty = beatmap.Difficulty;
        const user_settings = beatmap.UserSettings;
        const last_update = beatmap.LastLocalUpdate;
        const last_played = beatmap.LastPlayed;
        const beatmapset = beatmap.BeatmapSet.toJSON();
        const last_update_time = last_update?.getTime() || 0;
        const last_played_time = last_played?.getTime() || 0;
        const hash = beatmap.Hash;

        delete beatmapset.Beatmaps;

        // get audio file location
        const audio_file_data = beatmapset.Files.find((f) => f.Filename == metadata.AudioFile);
        const background_file_data = beatmapset.Files.find((f) => f.Filename == metadata.BackgroundFile);
        const audio_file = audio_file_data ? get_lazer_file_location(audio_file_data.File.Hash) : "";
        const background_file = background_file_data ? get_lazer_file_location(background_file_data.File.Hash) : "";

        const converted_beatmap = {
            beatmap_start: 0,
            entry: 0,
            artist: metadata.Artist || "",
            artist_unicode: metadata.ArtistUnicode || "",
            title: metadata.Title || "",
            title_unicode: metadata.TitleUnicode || "",
            mapper: metadata.Author.Username || "",
            difficulty: beatmap.DifficultyName || "",
            audio_file_name: audio_file || "",
            md5: beatmap.MD5Hash,
            file: beatmap.Hash || "",
            status: beatmap.Status || 0,
            status_text: lazer_beatmap_status[beatmap.Status],
            beatmapset: beatmapset,
            hitcircle: beatmap.TotalObjectCount || 0,
            bpm: beatmap.BPM || 0,
            sliders: 0,
            spinners: 0,
            last_modification: last_update_time,
            ar: difficulty.ApproachRate || 0,
            cs: difficulty.CircleSize || 0,
            hp: difficulty.DrainRate || 0,
            od: difficulty.OverallDifficulty || 0,
            slider_velocity: difficulty.SliderMultiplier || 0,
            star_rating: create_star_rating(beatmap.StarRating || 0),
            star: beatmap.StarRating || 0,
            drain_time: beatmap.Length || 0,
            length: beatmap.Length || 0,
            audio_preview: metadata?.PreviewTime || 0,
            timing_points_length: 0,
            timing_points: [],
            difficulty_id: beatmap.OnlineID,
            beatmapset_id: beatmapset.OnlineID,
            thread_id: -1,
            grade_standard: 0,
            grade_taiko: 0,
            grade_ctb: 0,
            grade_mania: 0,
            local_offset: user_settings?.Offset || 0,
            stack_leniency: 0.7,
            mode: beatmap.Ruleset?.OnlineID || 0,
            source: metadata?.Source || "",
            tags: metadata?.Tags || "",
            online_offset: 0,
            font: "",
            unplayed: !last_played,
            last_played: last_played_time,
            is_osz2: false,
            folder_name: "",
            file_path: get_lazer_file_location(hash),
            unique_id: beatmapset.OnlineID ? `${beatmapset.OnlineID}_${metadata.AudioFile}` : beatmap.MD5Hash,
            last_checked: 0,
            ignore_sounds: false,
            ignore_skin: false,
            disable_storyboard: false,
            disable_video: false,
            visual_override: false,
            last_modification: last_update_time ? Math.floor(last_update_time / 1000) : 0,
            mania_scroll_speed: 0,
            beatmap_end: 0,
            downloaded: true,
            local: true,
            audio_path: audio_file,
            image_path: background_file
        };

        beatmaps.set(converted_beatmap.md5, converted_beatmap);
    }

    return beatmaps;
};

export const lazer_to_osu_db = (instance) => {
    const lazer_beatmaps = get_lazer_beatmaps(instance);
    const converted_beatmaps = convert_lazer_to_stable(lazer_beatmaps);

    return {
        version: LAZER_SCHEMA_VERSION,
        folders: 0,
        account_unlocked: true,
        last_unlocked_time: Date.now(),
        player_name: "",
        beatmaps_count: converted_beatmaps.size,
        beatmaps: converted_beatmaps,
        extra_start: 0,
        permission_id: 0
    };
};

/** @param {Realm} instance */
export const update_collection = (instance, collections) => {
    const result = { success: false, reason: "" };

    if (!instance) {
        result.reason = "invalid instance";
        return result;
    }

    const saved_collections = Array.from(instance.objects("BeatmapCollection"));

    // create new transaction
    instance.write(() => {
        try {
            // save new collections
            for (const collection of collections) {
                const existing_collection = saved_collections.find((c) => c.ID.equals(collection.uuid));

                // if the collection already exists just update
                if (existing_collection) {
                    existing_collection.Name = collection.name;
                    ((existing_collection.BeatmapMD5Hashes = collection.maps || []), (existing_collection.LastModified = new Date()));
                    continue;
                }

                // create a new one instead
                const uuid = new Realm.BSON.UUID();

                instance.create("BeatmapCollection", {
                    ID: uuid,
                    Name: collection.name,
                    BeatmapMD5Hashes: collection.maps || [],
                    LastModified: new Date()
                });
            }

            // remove collections that are not part of the current collection object

            for (const collection of saved_collections) {
                const does_exist = collections.find((c) => c.name == collection.Name);
                // @TODO: create a buffer to store deleted collections so the user can undo
                if (!does_exist) {
                    instance.delete(collection);
                }
            }
        } catch (err) {
            result.reason = err;
        }
    });

    return result;
};

/** @param {Realm} instance */
export const delete_collection = (instance, collection) => {
    const result = { success: false, reason: "" };

    if (!instance) {
        result.reason = "invalid instance";
        return result;
    }

    const saved_collections = Array.from(instance.objects("BeatmapCollection"));
    const collection_to_delete = saved_collections.find((c) => c.Name == collection.name);

    if (!collection_to_delete) {
        console.log("could not find", collection.name);
        return;
    }

    // create new transaction
    instance.write(() => {
        instance.delete(collection_to_delete);
    });

    return result;
};
