import { writable, get } from "svelte/store";
import { format_time } from "../utils/utils.js";

const create_audio_store = () => {
	const { subscribe, update } = writable({
		audio: null,
		id: null,
		playing: false,
		ended: false,
		volume: 50, // %
		progress: "0:00",
		duration: "0:00",
		progress_bar_width: 0,
		is_fetching: false
	});

	let next_callback = null;
	let pause_interval = null;

	const on_canplay = (event) => {
		update((obj) => ({
			...obj,
			ended: false,
			duration: format_time(event.target.duration ?? 0),
			playing: obj.playing
		}));
	};

	const on_timeupdate = (event) => {
		update((obj) => ({
			...obj,
			ended: false,
			progress: format_time(event.target.currentTime ?? 0),
			progress_bar_width: (event.target.currentTime / event.target.duration) * 100
		}));
	};

	const on_end = async (event) => {
		update((obj) => ({
			...obj,
			progress: format_time(event.target.currentTime ?? 0),
			progress_bar_width: 100,
			ended: true,
			playing: false
		}));

		if (next_callback) {
			await get_next();
		}
	};

	const setup = async (id, audio) => {
		const old = get({ subscribe });

		if (old.audio) {
			remove(old.audio);
		}

		audio.addEventListener("canplay", on_canplay);
		audio.addEventListener("timeupdate", on_timeupdate);
		audio.addEventListener("ended", on_end);

		update((obj) => ({ ...obj, audio, id, ended: false, is_fetching: false }));
		return true;
	};

	const play = async (audio) => {
		if (pause_interval) {
			clearInterval(pause_interval);
		}

		update((obj) => ({
			...obj,
			playing: true,
			ended: false
		}));

		try {
			await audio.play();
		} catch (error) {
			console.log("play error:", error);
			update((obj) => ({
				...obj,
				playing: false
			}));
		}
	};

	const pause = (audio) => {
		audio.pause();
		update((obj) => ({
			...obj,
			playing: false
		}));
	};

	const pause_until = (audio, exp) => {
		if (pause_interval) {
			clearInterval(pause_interval);
		}

		pause(audio);

		pause_interval = setInterval(async () => {
			const result = exp();
			if (result) {
				await play(audio);
				clearInterval(pause_interval);
			}
		}, 10);
	};

	const remove = (audio) => {
		if (!audio.paused) {
			audio.pause();
		}

		audio.removeEventListener("canplay", on_canplay);
		audio.removeEventListener("timeupdate", on_timeupdate);
		audio.removeEventListener("ended", on_end);

		update((obj) => ({
			...obj,
			playing: false,
			id: null,
			audio: null,
			is_fetching: false
		}));
	};

	const seek = (audio, percent, time) => {
		audio.currentTime = time;
		update((obj) => ({
			...obj,
			progress_bar_width: percent * 100,
			progress: format_time(time)
		}));
	};

	const restart = (audio) => {
		audio.currentTime = 0;
		update((obj) => ({
			...obj,
			progress_bar_width: 0,
			progress: format_time(0)
		}));
	};

	const set_volume = (audio, volume) => {
		audio.volume = volume / 100;
		update((obj) => ({
			...obj,
			volume
		}));
	};

	const get_next = async () => {
		if (!next_callback || get({ subscribe }).is_fetching) {
			return;
		}

		update((obj) => ({ ...obj, is_fetching: true }));

		try {
			const result = await next_callback();

			if (!result || !result.id || !result.audio) {
				console.log("failed to get next audio from callback", result);
				update((obj) => ({ ...obj, is_fetching: false }));
				return;
			}

			const { id, audio } = result;

			await setup(id, audio);
			await play(audio);
		} catch (error) {
			console.log("error getting next song:", error);
			update((obj) => ({ ...obj, is_fetching: false }));
		}
	};

	return {
		subscribe,
		setup,
		play,
		pause_until,
		pause,
		restart,
		seek,
		set_volume,
		set_next: (callback) => (next_callback = callback),
		remove
	};
};

export const radio_search = writable("");
export const radio_mode = writable("");
export const radio_sort = writable("artist");
export const radio_random = writable(false);
export const radio_repeat = writable(false);
export const radio_store = create_audio_store();
export const preview_store = create_audio_store();
