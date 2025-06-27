import { osdb_versions, beatmap_status_reversed, lazer_status_reversed, beatmap_status, lazer_status } from "./models/stable.js";
import { get_beatmap_sr, get_common_bpm } from "../tools/beatmap.js";
import { get_realm_instance, lazer_to_osu_db } from "./lazer.js";
import { BinaryReader } from "./binary.js";
import { config } from "../../store.js";
import { collections_db, osu_db } from "./models/stable.js";

// placeholder
const create_alert = () => {};

export class Reader extends BinaryReader {
	/** @type {collections_db} */
	collections_data;
	/** @type {osu_db} */
	osu;
	/** @type {Map} */
	image_cache;
	/* */
	instance;

	constructor() {
		super();
		this.osu = new Map();
		this.pending_deletion = new Set();
		this.offset = 0;
		this.image_cache = new Map();
		this.beatmap_offset_start = 0;
	}

	create_instance = async (path, schemas) => {
		if (this.instance) {
			return;
		}
		this.instance = await get_realm_instance(path, schemas);
	};

	write_osu_data = async (maps) => {
		// ensure we have a buffer
		if (this.buffer?.byteLength == 0) {
			console.error("invalid buffer. call set_buffer before write_osu_data.");
			return false;
		}

		const buffer = [];

		buffer.push(this.writeInt(this.osu.version));
		buffer.push(this.writeInt(this.osu.folders));
		buffer.push(this.writeBool(this.osu.account_unlocked));
		buffer.push(this.writeLong(this.osu.last_unlocked_time));
		buffer.push(this.writeString(this.osu.player_name));
		buffer.push(this.writeInt(this.osu.beatmaps_count));

		let last_index = this.beatmap_offset_start;

		// sort to make end as last_index
		maps = maps.sort((a, b) => a.beatmap_start - b.beatmap_start);

		for (let i = 0; i < maps.length; i++) {
			// if the map object is invalid ignore it
			if (!maps[i].beatmap_start || !maps[i].beatmap_end) {
				create_alert("failed to recreate osu!.db", {
					type: "error"
				});
				return;
			}

			if (last_index < maps[i].beatmap_start) {
				const bf = new Uint8Array(this.buffer.slice(last_index, maps[i].beatmap_start));
				buffer.push(bf);
			}

			last_index = maps[i].beatmap_end;
		}

		if (last_index < this.buffer.byteLength) {
			buffer.push(new Uint8Array(this.buffer.slice(last_index)));
		}

		window.fs.save_osu_file(this.join_buffer(buffer));
		return true;
	};

	write_stable_collection = () => {
		if (!this.collections_data) {
			console.log("[reader] no collections found");
			return;
		}

		const buffer = [];

		buffer.push(this.writeInt(this.collections_data.version));
		buffer.push(this.writeInt(this.collections_data.beatmaps.size));

		for (const [name, collection] of this.collections_data.beatmaps) {
			buffer.push(this.writeString(name));
			buffer.push(this.writeInt(collection.maps.size));

			for (const map of collection.maps) {
				if (!map) {
					console.log("[reader] failed to get beatmap from collection!");
					return;
				}

				buffer.push(this.writeString(map));
			}
		}

		return this.join_buffer(buffer);
	};

	write_collections_data = async (_path) => {
		const lazer_mode = config.get("lazer_mode");

		if (lazer_mode) {
			if (!this.instance) {
				console.log("[reader] failed to get instance (cant write collection)", this.instance);
				return;
			}

			try {
				// delete pending collections
				for (const pending of this.pending_deletion) {
					await window.realmjs.delete_collection(this.instance, pending.uuid);
					this.pending_deletion.delete(pending);
				}

				// update/create the rest
				// @NOTE: sometimes for some reason this fail saying the subject is null
				// it only gave that error 1 time i cant seem to reproduce...
				for (const [name, data] of Array.from(this.collections_data.beatmaps)) {
					const result = await window.realmjs.update_collection(this.instance, data.uuid, name, data.maps);

					// true == new one
					if (result.new) {
						this.collections_data.beatmaps.get(name).uuid = result.id;
					}
				}

				return true;
			} catch (err) {
				create_alert("failed to save collection, check logs for more info", {
					type: "error"
				});
				console.log("[reader] error while saving", err);
				return false;
			}
		}

		const buffer = this.write_stable_collection();
		window.fs.save_collection_file(buffer, _path);

		return true;
	};

	// update collections with extra information like bpm, etc...
	update_collections = () => {
		if (this.collections_data.beatmaps.size == 0) {
			console.log("[reader] cant update collection cuz no beatmaps found");
			return;
		}

		for (const [name] of this.collections_data.beatmaps) {
			this.update_collection(name);
		}
	};

	update_collection = (name) => {
		if (!this.collections_data.beatmaps.has(name)) {
			console.log("[reader] collection not found");
			return;
		}

		const collection = this.collections_data.beatmaps.get(name);

		collection.bpm_max = 0;
		collection.sr_max = 0;

		for (const md5 of collection.maps) {
			const map = this.osu.beatmaps.get(md5);

			if (!map) {
				continue;
			}

			const sr = map?.star || Number(get_beatmap_sr(map));
			const bpm = map?.bpm || Number(get_common_bpm(map));

			// save to make sure
			if (!map?.bpm) {
				map.bpm = bpm;
			}

			if (!map?.star) {
				map.star = sr;
			}

			if (sr > collection.sr_max) collection.sr_max = sr;
			if (bpm > collection.bpm_max) collection.bpm_max = bpm;
		}

		// update the collection with extra info
		this.collections_data.beatmaps.set(name, collection);
	};

	/**
	 *
	 * @returns { Promise<osdb_schema> }
	 * @link https://github.com/Piotrekol/CollectionManager/blob/master/CollectionManagerDll/Modules/FileIO/FileCollections/OsdbCollectionHandler.cs
	 *
	 */
	get_osdb_data = async (buffer) => {
		// set buffer to use it later
		if (buffer) {
			this.set_buffer(buffer);
		}

		// ensure we have a valid buffer
		if (this.buffer.byteLength == 0) {
			console.log("invalid buffer");
			return false;
		}

		try {
			const data = {};
			const version_string = this.string2();
			const version = osdb_versions[version_string];

			if (!version) {
				throw new Error(`invalid osdb version (got: ${version_string})`);
			}

			const is_minimal = version_string.endsWith("min");

			if (version >= 7) {
				const compressed_data = this.buffer.buffer.slice(this.offset);
				const decompressed_data = window.zlib.gunzipSync(compressed_data);

				this.set_buffer(decompressed_data);
				this.offset = 0;

				this.string2();
			}

			data.save_date = this.long();
			data.last_editor = this.string2();
			data.collections_count = this.int();

			data.collections = [];

			for (let i = 0; i < data.collections_count; i++) {
				const collection = {
					name: this.string2(),
					beatmaps: [],
					hash_only_beatmaps: []
				};

				if (version >= 7) {
					collection.online_id = this.int();
				}

				const beatmaps_count = this.int();

				for (let j = 0; j < beatmaps_count; j++) {
					const beatmap = {
						map_id: this.int(),
						map_set_id: version >= 2 ? this.int() : -1
					};

					if (!is_minimal) {
						beatmap.artist = this.string2();
						beatmap.title = this.string2();
						beatmap.diff_name = this.string2();
					}

					beatmap.md5 = this.string2();

					if (version >= 4) {
						beatmap.user_comment = this.string2();
					}

					if (version >= 8 || (version >= 5 && !is_minimal)) {
						beatmap.play_mode = this.byte();
					}

					if (version >= 8 || (version >= 6 && !is_minimal)) {
						beatmap.stars_nomod = this.double();
					}

					collection.beatmaps.push(beatmap);
				}

				if (version >= 3) {
					const hash_count = this.int();
					for (let j = 0; j < hash_count; j++) {
						collection.hash_only_beatmaps.push(this.string2());
					}
				}

				data.collections.push(collection);
			}

			const footer = this.string2();

			if (footer != "By Piotrekol") {
				throw new Error("invalid file footer, this collection might be corrupted.");
			}

			return true;
		} catch (error) {
			console.log(error);
			return false;
		}
	};

	write_osdb_data = async (data, version_string) => {
		try {
			// ensure we have valid collections
			if (!data || !data.collections) {
				console.log("[osdb] invalid data structure");
				return null;
			}

			const version = osdb_versions[version_string];

			if (!version) {
				console.log(`[osdb] invalid osdb version: ${version_string}`);
				return null;
			}

			const is_minimal = version_string.endsWith("min");

			const buffers = [];
			const buffer = [];

			buffers.push(this.writeString2(version_string));

			if (version >= 7) {
				buffer.push(this.writeString2(version_string));
			}

			buffer.push(this.writeLong(data.save_date || new Date().getTime()));
			buffer.push(this.writeString2(data.last_editor || ""));
			buffer.push(this.writeInt(data.collections.length));

			for (let i = 0; i < data.collections.length; i++) {
				const collection = data.collections[i];

				buffer.push(this.writeString2(collection.name || ""));

				if (version >= 7) {
					buffer.push(this.writeInt(collection.online_id || 0));
				}

				buffer.push(this.writeInt(collection.beatmaps.length || 0));

				for (let i = 0; i < collection.beatmaps.length; i++) {
					const beatmap = collection.beatmaps[i];

					buffer.push(this.writeInt(beatmap.map_id || 0));

					if (version >= 2) {
						buffer.push(this.writeInt(beatmap.map_set_id || -1));
					}

					if (!is_minimal) {
						buffer.push(this.writeString2(beatmap.artist || ""));
						buffer.push(this.writeString2(beatmap.title || ""));
						buffer.push(this.writeString2(beatmap.diff_name || ""));
					}

					buffer.push(this.writeString2(beatmap.md5 || ""));

					if (version >= 4) {
						buffer.push(this.writeString2(beatmap?.user_comment || ""));
					}

					if (version >= 8 || (version >= 5 && !is_minimal)) {
						buffer.push(this.writeByte(beatmap?.play_mode || 0));
					}

					if (version >= 8 || (version >= 6 && !is_minimal)) {
						buffer.push(this.writeDouble(beatmap?.stars_nomod || 0.0));
					}
				}

				if (version >= 3) {
					const all_hashes = collection.hash_only_beatmaps;
					buffer.push(this.writeInt(all_hashes.length));

					for (let i = 0; i < all_hashes.length; i++) {
						const hash = all_hashes[i];
						buffer.push(this.writeString2(hash || ""));
					}
				}
			}

			buffer.push(this.writeString2("By Piotrekol"));
			const content_buffer = this.join_buffer(buffer);

			if (version >= 7) {
				buffers.push(new Uint8Array(window.zlib.gzipSync(content_buffer)));
			} else {
				buffers.push(content_buffer);
			}

			const final_buffer = this.join_buffer(buffers);
			return final_buffer;
		} catch (error) {
			console.log(error);
			return null;
		}
	};

	/**
	 *
	 * @returns { Promise<osu_db> }
	 *
	 */
	get_osu_data = async (buffer) => {
		// check if we already have the osu! file object
		if (this.osu.beatmaps?.size) {
			return this.osu;
		}

		const lazer_mode = config.get("lazer_mode");

		if (lazer_mode) {
			console.log("[reader] reading lazer data...");

			try {
				// get instance
				await this.create_instance(window.path.resolve(config.get("lazer_path"), "client.realm"), ["All"]);

				// convert lazer data to match current osu! stable obj
				this.osu = lazer_to_osu_db(this.instance);

				return {};
			} catch (err) {
				this.instance = null;
				create_alert("[reader] failed to read lazer db file\ncheck logs for more info", {
					type: "error"
				});
				console.log(err);
				return {};
			}
		}

		this.set_buffer(buffer);
		this.offset = 0;

		console.log("[reader] reading osu! stable data...");

		const beatmaps = new Map();
		const version = this.int();
		const folders = this.int();
		const account_unlocked = this.bool();

		const last_unlocked_time = this.long();

		const player_name = this.string();
		const beatmaps_count = this.int();

		this.beatmap_offset_start = this.offset;

		for (let i = 0; i < beatmaps_count; i++) {
			const beatmap = this.read_beatmap(version);
			beatmaps.set(beatmap.md5, beatmap);
		}

		const extra_start = this.offset;
		const permission_id = this.int();

		this.offset = 0;
		this.osu = {
			version,
			folders,
			account_unlocked,
			last_unlocked_time,
			player_name,
			beatmaps_count,
			beatmaps,
			extra_start,
			permission_id
		};

		return this.osu;
	};

	read_beatmap = (version) => {
		const data = {};

		data.beatmap_start = this.offset;
		data.entry = version < 20191106 ? this.int() : 0;
		data.artist = this.string();
		data.artist_unicode = this.string();
		data.title = this.string();
		data.title_unicode = this.string();
		data.mapper = this.string();
		data.difficulty = this.string();
		data.audio_file_name = this.string();
		data.md5 = this.string();
		data.file = this.string();
		data.status = this.byte();
		data.hitcircle = this.short();
		data.sliders = this.short();
		data.spinners = this.short();
		data.last_modification = this.long();

		const is_old_version = version < 20140609;
		data.ar = is_old_version ? this.byte() : this.single();
		data.cs = is_old_version ? this.byte() : this.single();
		data.hp = is_old_version ? this.byte() : this.single();
		data.od = is_old_version ? this.byte() : this.single();
		data.slider_velocity = this.double();

		data.sr = [];
		const is_new_version = version >= 20250107;

		for (let i = 0; i < 4; i++) {
			const length = this.int();

			if (length > 0) {
				this.byte(); // skip
				const mod = this.int();
				this.byte(); // skip
				const diff = is_new_version ? this.single() : this.double();
				data.sr[0] = [mod, diff];

				// skip remaining bytes
				const skip_bytes = is_new_version ? 10 : 14;
				this.offset += skip_bytes * (length - 1);
			}
		}

		data.drain_time = this.int();
		data.length = this.int();
		data.audio_preview = this.int();

		// get timing points
		const timing_points_length = this.int();
		data.timing_points_length = timing_points_length;
		data.timing_points = new Array(timing_points_length);

		for (let i = 0; i < timing_points_length; i++) {
			data.timing_points[i] = {
				beat_length: this.double(),
				offset: this.double(),
				inherited: this.bool()
			};
		}

		// read rest of the metadata
		data.difficulty_id = this.int();
		data.beatmapset_id = this.int();
		data.thread_id = this.int();
		data.grade_standard = this.byte();
		data.grade_taiko = this.byte();
		data.grade_ctb = this.byte();
		data.grade_mania = this.byte();
		data.local_offset = this.short();
		data.stack_leniency = this.single();
		data.mode = this.byte();
		data.source = this.string();
		data.tags = this.string();
		data.online_offset = this.short();
		data.font = this.string();
		data.unplayed = this.bool();
		data.last_played = this.long();
		data.is_osz2 = this.bool();
		data.folder_name = this.string();
		data.last_checked = this.long();
		data.ignore_sounds = this.bool();
		data.ignore_skin = this.bool();
		data.disable_storyboard = this.bool();
		data.disable_video = this.bool();
		data.visual_override = this.bool();

		if (version < 20140609) {
			data.unknown = this.short();
		}

		data.last_modified = this.int();
		data.mania_scroll_speed = this.byte();
		data.beatmap_end = this.offset;
		data.local = true;
		data.downloaded = true;

		return data;
	};

	/**
	 *
	 * @returns { Promise<collections_db> }
	 *
	 */
	get_collections_data = async (buffer) => {
		const lazer_mode = config.get("lazer_mode");

		// return store collection on stable mode
		if (this.collections_data?.length && !lazer_mode) {
			return this.collections_data;
		}

		if (lazer_mode && !buffer) {
			try {
				// get instance
				await this.create_instance(window.path.resolve(config.get("lazer_path"), "client.realm"), ["All"]);

				// get collections data
				const data = await window.realmjs.objects(this.instance, "BeatmapCollection");
				this.collections_data = {
					length: data.length,
					beatmaps: new Map()
				};

				for (let i = 0; i < data.length; i++) {
					const collection = data[i];
					this.collections_data.beatmaps.set(collection.Name, {
						uuid: collection.ID,
						maps: new Set(collection.BeatmapMD5Hashes)
					});
				}

				return true;
			} catch (e) {
				this.instance = null;
				create_alert("error getting lazer collections<br>check logs for more info", {
					type: "error",
					html: true
				});
				console.error(e);
				return false;
			}
		}

		this.set_buffer(buffer);
		this.offset = 0;

		const collections = new Map();
		const version = this.int();
		const count = this.int();

		for (let i = 0; i < count; i++) {
			const name = this.string();
			const bm_count = this.int();
			const md5 = [];

			for (let i = 0; i < bm_count; i++) {
				const map = this.string();
				md5.push(map);
			}

			collections.set(name, {
				name: name,
				maps: new Set(md5)
			});
		}

		this.offset = 0;
		this.collections_data = { version, length: count, collections };

		return this.collections_data;
	};

	delete_collection = (id) => {
		const lazer_mode = config.get("lazer_mode");

		if (lazer_mode) {
			try {
				if (!this.instance) {
					create_alert("failed to delete collection (no instance)");
					return;
				}

				const collection = this.collections_data.beatmaps.get(id);

				if (!collection?.uuid) {
					this.collections_data.beatmaps.delete(id);
				} else {
					// @TODO: need to implement this to stable collections so i can create a "undo" feature
					this.pending_deletion.add(collection);
					this.collections_data.beatmaps.delete(id);
				}
			} catch (err) {
				create_alert("failed to delete collection<br>check logs for more info", {
					type: "error",
					html: true
				});
				console.log("[reader]", err);
			}
		} else {
			this.collections_data.beatmaps.delete(id);
		}
	};

	get_beatmap_location = (beatmap) => {
		const lazer_mode = config.get("lazer_mode");

		if (lazer_mode) {
			if (!beatmap?.beatmapset || !beatmap?.folder_name) {
				return "";
			}

			const file_data = beatmap.beatmapset.Files.find((f) => f.Filename.split(".")[1] == "osu");

			if (!file_data) {
				return "";
			}

			const file_hash = file_data.File.Hash;
			return window.path.resolve(config.get("lazer_path"), "files", file_hash.substring(0, 1), file_hash.substring(0, 2), file_hash);
		} else {
			const folder = window.path.resolve(config.get("stable_songs_path"), beatmap.folder_name);
			return window.path.resolve(folder, beatmap.file);
		}
	};

	search_image = async (beatmap) => {
		try {
			const file_location = this.get_beatmap_location(beatmap);

			if (!file_location) {
				return null;
			}

			const content = await window.fs.get_osu_file(file_location);

			if (!content) {
				return null;
			}

			const events_start = content.indexOf("[Events]");

			if (!events_start) {
				return null;
			}

			const events_end = content.indexOf("[", events_start + 1);
			const events_section = content.substring(events_start, events_end != -1 ? events_end : undefined);
			const image_matches = events_section.matchAll(/0,0,"([^"]+)"/g);
			const valid = ["avi", "mp4", "mov"];

			for (let i = 0; i < image_matches.length; i++) {
				const match = image_matches[i];
				const image_name = match[1];

				if (!image_name || !image_name.includes(".")) {
					continue;
				}

				const ext = image_name.split(".").pop().toLowerCase();

				if (valid.includes(ext)) {
					continue;
				}

				return image_name;
			}
		} catch (err) {
			console.log("[reader] search image error:", err);
			return null;
		}
	};

	/**
	 * @param {beatmaps_schema} beatmap
	 * @returns { Promise<{ path: String }> }
	 *
	 */
	get_beatmap_image = async (beatmap) => {
		if (!beatmap?.beatmapset_id) {
			return null;
		}

		if (this.image_cache.has(beatmap.beatmapset_id)) {
			return this.image_cache.get(beatmap.beatmapset_id);
		}

		try {
			const image_name = await this.search_image(beatmap);

			if (!image_name) {
				return null;
			}

			const lazer_mode = config.get("lazer_mode");
			let result = null;

			if (lazer_mode) {
				if (!beatmap.beatmapset?.Files) {
					return null;
				}

				const thing = beatmap.beatmapset.Files.find((f) => f.Filename == image_name);

				if (!thing?.File?.Hash) {
					return null;
				}

				const hash = thing.File.Hash;
				result = window.path.resolve(config.get("lazer_path"), "files", hash.substring(0, 1), hash.substring(0, 2), hash);
			} else {
				if (!beatmap.folder_name) {
					return null;
				}

				result = window.path.resolve(config.get("stable_songs_path"), beatmap.folder_name, image_name);
			}

			if (result) {
				this.image_cache.set(beatmap.beatmapset_id, result);
			}

			return result;
		} catch (error) {
			console.log("[reader] get_beatmap_image error:", error);
			return null;
		}
	};

	zip_file = async (files) => {
		const result = await window.JSZip.zip_file(files);
		return result;
	};

	export_beatmap = async (beatmap) => {
		const lazer_mode = config.get("lazer_mode");
		const osu_path = lazer_mode ? config.get("lazer_path") : window.path.resolve(config.get("stable_path"), config.get("stable_songs_path"));
		const export_path = config.get("export_path");

		let buffer = "";

		if (export_path == "") {
			create_alert("please update your export path before using this feature");
			return false;
		}

		if (lazer_mode) {
			const files = beatmap.beatmapset.Files.map((f) => {
				const hash = f.File.Hash;
				const location = window.path.resolve(osu_path, "files", hash.substring(0, 1), hash.substring(0, 2), hash);

				return {
					name: f.Filename,
					location: location
				};
			});

			buffer = await this.zip_file(files);
		} else {
			const folder_path = window.path.resolve(osu_path, beatmap.folder_name);
			const files = window.fs.readdirSync(folder_path).map((f) => {
				return {
					name: f,
					location: window.path.resolve(folder_path, f)
				};
			});

			buffer = await this.zip_file(files);
		}

		if (!config.get("export_path")) {
			create_alert("export path not found");
			return false;
		}

		window.fs.save_exported(`${beatmap.beatmapset_id}.osz`, buffer);
		return true;
	};

	static get_beatmap_status = (code) => {
		const lazer_mode = config.get("lazer_mode");

		if (lazer_mode) {
			return lazer_status_reversed[code];
		}

		return beatmap_status_reversed[code];
	};

	static get_beatmap_status_code = (status) => {
		if (!status) {
			return 0;
		}

		const lazer_mode = config.get("lazer_mode");

		if (lazer_mode) {
			const key = Object.keys(lazer_status).find((k) => k.toLowerCase() == status.toLowerCase());
			return lazer_status[key];
		}

		return beatmap_status[status];
	};

	static get_status_object = () => {
		const lazer_mode = config.get("lazer_mode");
		return lazer_mode ? lazer_status : beatmap_status;
	};

	static get_status_object_reversed = () => {
		const lazer_mode = config.get("lazer_mode");
		return lazer_mode ? lazer_status_reversed : beatmap_status_reversed;
	};
}

export const reader = new Reader();
