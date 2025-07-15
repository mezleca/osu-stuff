import { writable, get } from "svelte/store";
import { format_time } from "../utils/utils.js";

class AudioManager {
	constructor(id) {
		this.id = id;
		this.store = writable({
			audio: null,
			id: null,
			playing: false,
			ended: false,
			volume: 50,
			progress: "0:00",
			duration: "0:00",
			progress_bar_width: 0,
			is_fetching: false
		});
		this.next_callback = null;
		this.pause_interval = null;
		this.current_audio = null;
	}

	subscribe = (run, invalidate) => this.store.subscribe(run, invalidate);
	get_state = () => this.store;

	on_canplay = (event) => {
		const state = get(this.get_state());

		if (state.audio != event.target) {
			console.log("ignoring old can play");
			return;
		}

		// remove this listener to prevent problems later
		state.audio.removeEventListener("canplaythrough", this.on_canplay);

		this.store.update((obj) => ({
			...obj,
			ended: false,
			duration: format_time(event.target.duration ?? 0),
			playing: obj.playing
		}));
	};

	on_timeupdate = (event) => {
		const state = get(this.get_state());

		if (state.audio != event.target) {
			return;
		}

		this.store.update((obj) => ({
			...obj,
			ended: false,
			progress: format_time(event.target.currentTime ?? 0),
			progress_bar_width: (event.target.currentTime / event.target.duration) * 100
		}));
	};

	on_end = async (event) => {
		const state = get(this.get_state());

		if (state.audio != event.target) {
			return;
		}

		this.store.update((obj) => ({
			...obj,
			progress: format_time(event.target.currentTime ?? 0),
			progress_bar_width: 100,
			ended: true,
			playing: false
		}));

		if (this.next_callback) {
			await this.get_next();
		}
	};

	async setup(id, audio) {
		const current_state = get(this.get_state());

		// @TODO: figure out why we're receiving double calls on setup
		// check if the old state has the same id
		if (current_state.id == id) {
			console.log("ignored same id", id);
			return;
		}

		// remove old state
		this.remove(current_state.audio);

		this.store.update((obj) => ({
			...obj,
			id,
			audio,
			playing: false,
			is_fetching: false
		}));

		// setup listeners
		audio.addEventListener("canplaythrough", this.on_canplay);
		audio.addEventListener("timeupdate", this.on_timeupdate);
		audio.addEventListener("ended", this.on_end);

		console.log("audio setup completed for:", id);
	}

	play = async (audio) => {
		console.log("playing audio", audio.src);

		if (this.pause_interval) {
			clearInterval(this.pause_interval);
		}

		this.store.update((obj) => ({
			...obj,
			playing: true,
			ended: false
		}));

		try {
			await audio.play();
		} catch (error) {
			console.log("play error:", error);
			this.store.update((obj) => ({
				...obj,
				playing: false
			}));
		}
	};

	pause(audio) {
		console.log("pausing audio", audio.src);
		audio.pause();
		this.store.update((obj) => ({ ...obj, playing: false }));
	}

	pause_until = (audio, exp) => {
		console.log("pausing until", audio.src);

		if (this.pause_interval) {
			clearInterval(this.pause_interval);
		}

		this.pause(audio);
		this.pause_interval = setInterval(async () => {
			const result = exp();
			if (result) {
				console.log("until exp is finally true", audio.src);
				await this.play(audio);
				clearInterval(this.pause_interval);
			}
		}, 10);
	};

	remove(audio) {
		// ignore invalid audio objects
		if (!audio?.src) {
			return;
		}

		// remove audio from memory
		const url = audio.src;
		audio.src = "";
		window.URL.revokeObjectURL(url);

		// force it so stop
		audio.pause();
		audio.currentTime = 0;

		// remove old listeners
		audio.removeEventListener("canplaythrough", this.on_canplay);
		audio.removeEventListener("timeupdate", this.on_timeupdate);
		audio.removeEventListener("ended", this.on_end);

		// clean store object
		this.store.update((obj) => ({
			...obj,
			playing: false,
			id: null,
			audio: null,
			is_fetching: false
		}));

		console.log("audio successfully removed");
	}

	seek(audio, percent, current) {
		console.log("seeking audio to:", current, "seconds (", percent * 100, "%)");
		if (audio) {
			audio.currentTime = current;
			console.log("finished seeking:", audio.currentTime);
		} else {
			console.log("no audio available to seek");
		}
	}

	restart = (audio) => {
		audio.currentTime = 0;
		this.store.update((obj) => ({
			...obj,
			progress_bar_width: 0,
			progress: format_time(0)
		}));
	};

	set_volume = (audio, volume) => {
		audio.volume = volume / 100;
		this.store.update((obj) => ({
			...obj,
			volume
		}));
	};

	get_next = async () => {
		if (!this.next_callback || this.get_state().is_fetching) {
			return;
		}

		this.store.update((obj) => ({ ...obj, is_fetching: true }));

		try {
			const result = await this.next_callback();

			if (!result || !result.id || !result.audio) {
				console.log("failed to get next audio from callback", result);
				this.store.update((obj) => ({ ...obj, is_fetching: false }));
				return;
			}

			const { id, audio } = result;
			await this.setup(id, audio);
			await this.play(audio);
		} catch (error) {
			console.log("error getting next song:", error);
			this.store.update((obj) => ({ ...obj, is_fetching: false }));
		}
	};

	set_next = (callback) => {
		this.next_callback = callback;
	};
}

const audio_managers = new Map();

/** @returns {AudioManager} */
export const get_audio_manager = (id) => {
	if (!audio_managers.has(id)) {
		audio_managers.set(id, new AudioManager(id));
	}
	return audio_managers.get(id);
};

export const radio_mode = writable("");
export const radio_random = writable(false);
export const radio_repeat = writable(false);
