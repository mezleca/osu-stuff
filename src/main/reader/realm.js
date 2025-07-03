import { GAMEMODES } from "../beatmaps/beatmaps";
import Realm from "realm";

const LAZER_SCHEMA_VERSION = 48;

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

const create_mode_star_rating = (star_rating, mode) => ({
	mode: GAMEMODES[mode],
	pair: [[0, star_rating]]
});

const create_star_rating = (rating) => {
	return GAMEMODES.map((_, i) => create_mode_star_rating(rating, i));
};

export const convert_lazer_to_stable = (lazer_beatmaps) => {
	const beatmaps = new Map();
	const length = lazer_beatmaps.length;

	for (let i = 0; i < length; i++) {
		const beatmap = lazer_beatmaps[i];

		if (!beatmap?.MD5Hash) {
			continue;
		}

		const metadata = beatmap.Metadata;
		const difficulty = beatmap.Difficulty;
		const user_settings = beatmap.UserSettings;
		const last_update = beatmap.LastLocalUpdate;
		const last_played = beatmap.LastPlayed;
		const beatmapset = beatmap.BeatmapSet;

		const last_update_time = last_update?.getTime() || 0;
		const last_played_time = last_played?.getTime() || 0;

		const converted_beatmap = {
			beatmap_start: 0,
			entry: 0,
			artist: metadata?.Artist || "",
			artist_unicode: metadata?.ArtistUnicode || "",
			title: metadata?.Title || "",
			title_unicode: metadata?.TitleUnicode || "",
			mapper: metadata?.Author?.Username || "",
			difficulty: beatmap.DifficultyName || "",
			audio_file_name: metadata?.AudioFile || "",
			md5: beatmap.MD5Hash,
			file: beatmap.Hash || "",
			status: beatmap.Status || 0,
			beatmapset,
			hitcircle: beatmap.TotalObjectCount || 0,
			bpm: beatmap.BPM || 0,
			sliders: 0,
			spinners: 0,
			last_modification: last_update_time,
			ar: difficulty?.ApproachRate || 0,
			cs: difficulty?.CircleSize || 0,
			hp: difficulty?.DrainRate || 0,
			od: difficulty?.OverallDifficulty || 0,
			slider_velocity: difficulty?.SliderMultiplier || 0,
			star_rating: create_star_rating(beatmap.StarRating || 0),
			star: beatmap.StarRating || 0,
			drain_time: beatmap.Length || 0,
			length: beatmap.Length || 0,
			audio_preview: metadata?.PreviewTime || 0,
			timing_points_length: 0,
			timing_points: [],
			difficulty_id: beatmap.OnlineID || -1,
			beatmapset_id: beatmapset?.OnlineID || -1,
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
			last_checked: 0,
			ignore_sounds: false,
			ignore_skin: false,
			disable_storyboard: false,
			disable_video: false,
			visual_override: false,
			last_modified: last_update_time ? Math.floor(last_update_time / 1000) : 0,
			mania_scroll_speed: 0,
			beatmap_end: 0,
			downloaded: true
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

export const update_collection = (instance, collection) => {

};

export const delete_collection = (instance, collection) => {

};

/*
update_collection: (realm, _uuid, name, maps) => {
	const uuid = _uuid ? new Realm.BSON.UUID(Buffer.from(_uuid.buffer)) : null;
	const result = { new: false, id: uuid };

	const instance = instances.get(realm);
	const exists = uuid ? instance.objectForPrimaryKey("BeatmapCollection", uuid) : null;

	instance.write(() => {
		try {
			if (exists == null) {
				const id = new Realm.BSON.UUID();
				result.id = id;
				result.new = true;

				instance.create("BeatmapCollection", {
					ID: id,
					Name: name,
					BeatmapMD5Hashes: Array.from(maps) || [],
					LastModified: new Date()
				});
			} else {
				const collection = exists;
				collection.Name = name;
				collection.BeatmapMD5Hashes = Array.from(maps);
				collection.LastModified = new Date();
			}
		} catch (err) {
			console.log("write error", err);
		}
	});

	return result;
},
delete_collection: (realm, uuid) => {
	const instance = instances.get(realm);

	instance.write(() => {
		const collection = instance.objectForPrimaryKey("BeatmapCollection", new Realm.BSON.UUID(Buffer.from(uuid.buffer)));
		instance.delete(collection);
	});
},
*/