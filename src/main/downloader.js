import fs from "fs";
import path from "path";

let downloads = [];
let mirrors = [];
let beatmap_cache = new Map();
let token = "";
let processing = false;
let download_progress = new Map();

const MAX_PARALLEL_DOWNLOADS = 3;
const COOLDOWN_MINUTES = 5;
const DELAY_MS = 100;

// to process multiple beatmaps
const parallel_map = async (array, mapper, concurrency) => {
	const results = [];

	let index = 0;
	let should_stop = false;

	const run = async () => {
		//
		if (index >= array.length || should_stop) {
			return;
		}

		const current_index = index++;

		try {
			const result = await mapper(array[current_index], current_index, array);

			if (result?.stop) {
				should_stop = true;
				return;
			}

			results[current_index] = result;
		} catch (error) {
			console.log(`error processing item at index ${current_index}:`, error);
		}

		await run();
	};

	await Promise.all(
		Array(Math.min(concurrency, array.length))
			.fill()
			.map(() => run())
	);
	return results;
};

const main = (ipc_main, main_window) => {
	// setup handlers
	ipc_main.handle("add-download", (_, download) => add_download(download));
	ipc_main.handle("add-mirror", (_, mirror) => add_mirror(mirror));
	ipc_main.handle("set-token", (_, new_token) => set_token(new_token));
	ipc_main.handle("start-download", (_, name) => start_processing(name));
	ipc_main.handle("stop-download", () => stop_processing());
	ipc_main.handle("get-downloads", () => get_downloads());
	ipc_main.handle("remove-download", (_, name) => remove_download(name));
	ipc_main.handle("remove-mirror", (_, name) => remove_mirror(name));

	// send progress to the frontend
	const send_progress = (name, current, total) => {
		main_window.webContents.send("download-progress", {
			name,
			current,
			total
		});
	};

	return { send_progress };
};

const start_processing = async (name) => {
	if (processing) {
		return;
	}

	processing = true;

	while (processing && downloads.length > 0) {
		// make sure we have a token
		if (!token) {
			break;
		}

		// finished?
		if (mirrors.length == 0) {
			// @TODO: tell something to the frontend
			break;
		}

		// get the index of the old download
		const download_index = name && name != "" ? downloads.findIndex((d) => d.name == name) : 0;

		// ensure we dont have a negative index
		const current_download = downloads[download_index < 0 ? 0 : download_index];

		// process current download
		await process_download(current_download);

		// go to the next one
		if (processing) {
			downloads.shift();
			download_progress.delete(current_download.name);
		}
	}

	processing = false;
};

const stop_processing = () => {
	processing = false;
};

const process_download = async (download) => {
	// ensure we have the beatmaps to download
	if (!download.beatmaps || download.beatmaps.length == 0) {
		console.log("failed to get beatmaps", download);
		return;
	}

	const start_index = download_progress.get(download.name) || 0;
	const beatmaps_to_process = download.beatmaps.slice(start_index);

	await parallel_map(
		beatmaps_to_process,
		async (beatmap, index) => {
			//
			if (!processing || !downloads.includes(download)) {
				return { stop: true };
			}

			const actual_index = start_index + index;
			const success = await process_beatmap(download, beatmap);

			if (success) {
				download_progress.set(download.name, actual_index + 1);
			}

			return success;
		},
		MAX_PARALLEL_DOWNLOADS
	);
};

const process_beatmap = async (download, beatmap) => {
	// check if we're still downloading
	if (!processing || !downloads.includes(download)) {
		console.log("downlaod not found", download);
		return { stop: true };
	}

	/* 
    const beatmap_data = await get_beatmap_info(beatmap.md5);

    if (!beatmap_data) {
        console.log(`Failed to get beatmap info for ${beatmap.md5}`);
        return false;
    }

    const osz_stream = await get_osz(beatmap_data.id);

    if (!osz_stream) {
        console.log(`Failed to download beatmap ${beatmap_data.id}`);
        return false;
    }

    const save_path = get_save_path();

    if (!save_path) {
        processing = false;
        return false;
    }

    const filename = `${beatmap_data.beatmapset_id}.osz`;
    const full_path = path.join(save_path, filename);
    
    await save_file(osz_stream, full_path);
    
	*/

	beatmap;

	await sleep(1000);

	return true;
};

const get_beatmap_info = async (hash) => {
	// return cached beatmap data if possible
	if (beatmap_cache.has(hash)) {
		return beatmap_cache.get(hash);
	}

	try {
		const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});

		// valid response?
		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		beatmap_cache.set(hash, data);

		return data;
	} catch (error) {
		console.log(`error fetching beatmap info: ${error.message}`);
		return null;
	}
};

const get_osz = async (beatmap_id) => {
	for (let i = 0; i < mirrors.length; i++) {
		const mirror = mirrors[i];

		// ignore if mirror is in a cooldown (rate limited)
		if (mirror.cooldown && mirror.cooldown > Date.now()) {
			continue;
		}

		// remove rate limit
		if (mirror.cooldown && mirror.cooldown <= Date.now()) {
			mirror.cooldown = null;
			console.log(`removed rate limit from ${mirror.name}`);
		}

		let url = mirror.url;

		// remove to preven double "/"
		if (url.endsWith("/")) {
			url = url.slice(0, -1);
		}

		try {
			const response = await fetch(`${url}/${beatmap_id}`);

			if (response.status == 429) {
				console.log(`added rate limit to ${mirror.name}`);
				mirror.cooldown = Date.now() + COOLDOWN_MINUTES * 60 * 1000;
				continue;
			}

			if (response.ok) {
				return await response.arrayBuffer();
			}
		} catch (error) {
			console.log(`error downloading from ${mirror.name}: ${error.message}`);
		}
	}

	return null;
};

const save_file = async (buffer, file_path) => {
	try {
		fs.mkdirSync(path.dirname(file_path), { recursive: true });
		fs.writeFileSync(file_path, Buffer.from(buffer));
	} catch (error) {
		console.log(`Error saving file: ${error.message}`);
	}
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const add_download = (download) => {
	downloads.push(download);
};

const add_mirror = (mirror) => {
	mirrors.push(mirror);
};

const remove_download = (name) => {
	const index = downloads.findIndex((d) => d.name == name);
	if (index != -1) {
		downloads.splice(index, 1);
	}
};

const remove_mirror = (name) => {
	const index = mirrors.findIndex((m) => m.name == name);
	if (index != -1) {
		mirrors.splice(index, 1);
	}
};

const set_token = (new_token) => {
	token = new_token;
};

const get_downloads = () => downloads;

const get_save_path = () => {
	return "./";
};

export const downloader = {
	main,
	add_download,
	add_mirror,
	remove_download,
	remove_mirror,
	set_token,
	get_downloads,
	start_processing,
	stop_processing
};
