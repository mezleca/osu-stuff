import { writable, get } from "svelte/store";
import { format_time } from "../utils/utils.js";
import { get_from_media } from "../utils/utils.js";

const DEFAULT_VOLUME = 50;

class AudioManager {
    constructor(id) {
        this.id = id;
        this.is_preview = id == "preview";
        this.attempts = 0;

        this.random = writable(false);
        this.repeat = writable(false);
        this.force_random = writable(false);
        this.previous_random_songs = writable([]);
        this.failed = writable(false);
        this.store = writable({
            audio: null,
            id: null,
            playing: false,
            ended: false,
            volume: DEFAULT_VOLUME,
            progress: "0:00",
            duration: "0:00",
            progress_bar_width: 0,
            is_loading: false,
            is_changing_selection: false
        });

        this.next_callback = null;
        this.get_next_id_callback = null;
        this.get_beatmap_data_callback = null;
        this.pause_interval = null;
    }

    subscribe = (run, invalidate) => this.store.subscribe(run, invalidate);
    get_state = () => get(this.store);

    on_canplay = (event) => {
        const state = this.get_state();

        if (state.audio != event.target) {
            console.log(`[${this.id}] ignoring old canplay event`);
            return;
        }

        event.target.removeEventListener("canplaythrough", this.on_canplay);

        this.store.update((obj) => ({
            ...obj,
            duration: format_time(event.target.duration ?? 0),
            is_loading: false
        }));

        console.log(`[${this.id}] audio ready, duration: ${format_time(event.target.duration)}`);
    };

    on_timeupdate = (event) => {
        const state = this.get_state();
        if (state.audio != event.target) return;

        const current_time = event.target.currentTime ?? 0;
        const duration = event.target.duration ?? 1;

        this.store.update((obj) => ({
            ...obj,
            progress: format_time(current_time),
            progress_bar_width: (current_time / duration) * 100
        }));
    };

    on_ended = async (event) => {
        const state = this.get_state();
        if (state.audio != event.target) return;

        console.log(`[${this.id}] audio ended`);

        this.store.update((obj) => ({
            ...obj,
            playing: false,
            ended: true,
            progress_bar_width: 100
        }));

        // auto-play next for radio mode
        if (!this.is_preview) {
            await this.play_next();
        }
    };

    calculate_next_index = (current_index, beatmaps_length, direction = 0) => {
        const random_active = get(this.random);
        const repeat_active = get(this.repeat);

        // previous
        if (direction == -1) {
            return current_index - 1 < 0 ? beatmaps_length - 1 : current_index - 1;
        }

        // next
        if (direction == 1) {
            return current_index + 1 >= beatmaps_length ? 0 : current_index + 1;
        }

        // auto (direction = 0)
        if (repeat_active) {
            this.set_repeat(false); // disable after one repeat
            return current_index;
        }

        if (random_active) {
            return Math.floor(Math.random() * beatmaps_length);
        }

        // default to next
        return current_index + 1 >= beatmaps_length ? 0 : current_index + 1;
    };

    // == AUDIO MANAGEMENT ==
    async setup_audio(id, audio_data) {
        console.log(`[${this.id}] setting up audio for: ${id}`);

        const old_state = this.get_state();
        if (old_state.id == id && old_state.audio) {
            console.log(`[${this.id}] audio already setup for: ${id}`);
            return old_state.audio;
        }

        this.clean_audio();

        this.store.update((obj) => ({
            ...obj,
            id,
            audio: audio_data,
            playing: false,
            is_loading: true,
            ended: false
        }));

        // setup event listeners
        audio_data.addEventListener("canplaythrough", this.on_canplay);
        audio_data.addEventListener("timeupdate", this.on_timeupdate);
        audio_data.addEventListener("ended", this.on_ended);
        audio_data.volume = this.get_state().volume / 100;

        return audio_data;
    }

    async load_and_setup_audio(beatmap_id) {
        if (this.attempts >= 3) {
            console.log(`[${this.id}] stop cuz too much attempts`);
            this.attempts = 0;
            return null;
        }

        if (!this.get_beatmap_data_callback) {
            console.error(`[${this.id}] no get_beatmap_data_callback set`);
            return null;
        }

        try {
            const beatmap = await this.get_beatmap_data_callback(beatmap_id);

            if (!beatmap?.audio_path) {
                console.log(`[${this.id}] invalid beatmap or no audio path`);

                // try next beatmap
                if (!this.is_preview) {
                    this.attempts++;
                    const next_id = await this.get_next_id_callback(0); // 0 == auto
                    return await this.load_and_setup_audio(next_id);
                }

                return null;
            }

            const audio = await get_local_audio(beatmap.audio_path);

            if (!audio) {
                console.log(`[${this.id}] failed to create audio`);

                // try next beatmap
                if (!this.is_preview) {
                    this.attempts++;
                    const next_id = await this.get_next_id_callback(0); // 0 == auto
                    return await this.load_and_setup_audio(next_id);
                }

                return null;
            }

            // reset
            this.attempts = 0;

            await this.setup_audio(beatmap.md5, audio);
            return { beatmap, audio };
        } catch (error) {
            console.error(`[${this.id}] error loading audio:`, error);
            return null;
        }
    }

    async play() {
        const state = this.get_state();
        const target_audio = state.audio;

        if (!target_audio) {
            console.log(`[${this.id}] no audio to play`);
            return false;
        }

        console.log(`[${this.id}] playing audio`);

        // pause other manager if this is preview
        if (this.is_preview) {
            const radio_manager = get_audio_manager("radio");
            if (radio_manager.get_state().playing) {
                radio_manager.pause_until(() => !this.get_state().playing);
            }
        }

        if (this.pause_interval) {
            clearInterval(this.pause_interval);
            this.pause_interval = null;
        }

        this.store.update((obj) => ({ ...obj, playing: true, ended: false }));

        try {
            await target_audio.play();
            return true;
        } catch (error) {
            if (error.name != "NotAllowedError") {
                console.log(`[${this.id}] play error:`, error);
            }
            this.store.update((obj) => ({ ...obj, playing: false }));
            return false;
        }
    }

    pause(audio = null) {
        const state = this.get_state();
        const target_audio = audio || state.audio;

        if (!target_audio) {
            return;
        }

        console.log(`[${this.id}] pausing audio`);
        target_audio.pause();
        this.store.update((obj) => ({ ...obj, playing: false }));
    }

    pause_until(condition) {
        const state = this.get_state();

        if (!state.audio) {
            return;
        }

        console.log(`[${this.id}] pause until condition`);
        this.pause();

        if (this.pause_interval) {
            clearInterval(this.pause_interval);
        }

        this.pause_interval = setInterval(async () => {
            if (condition()) {
                console.log(`[${this.id}] resuming cuz condition == true`);
                await this.play();
                clearInterval(this.pause_interval);
                this.pause_interval = null;
            }
        }, 100);
    }

    seek(percent) {
        const state = this.get_state();

        if (!state.audio) {
            return;
        }

        const target_time = percent * state.audio.duration;
        state.audio.currentTime = target_time;

        console.log(`[${this.id}] seeking to: ${format_time(target_time)} (${(percent * 100).toFixed(1)}%)`);
    }

    set_volume(volume) {
        const state = this.get_state();
        const clamped_volume = Math.max(0, Math.min(100, volume));

        if (state.audio) {
            state.audio.volume = clamped_volume / 100;
        }

        this.store.update((obj) => ({ ...obj, volume: clamped_volume }));
        console.log(`[${this.id}] volume set to: ${clamped_volume}%`);
    }

    toggle_mute() {
        const current_volume = this.get_state().volume;
        this.set_volume(current_volume > 0 ? 0 : DEFAULT_VOLUME);
    }

    set_random(enabled) {
        if (this.is_preview) return;
        this.random.set(enabled);
    }

    set_repeat(enabled) {
        if (this.is_preview) return;
        this.repeat.set(enabled);
    }

    toggle_random() {
        const current_value = get(this.random);
        const new_value = !current_value;
        this.set_random(new_value);
        return new_value;
    }

    toggle_repeat() {
        const current_value = get(this.repeat);
        const new_value = !current_value;
        this.set_repeat(new_value);
        return new_value;
    }

    set_callbacks(callbacks) {
        if (this.is_preview) return;
        this.get_next_id_callback = callbacks.get_next_id;
        this.get_beatmap_data_callback = callbacks.get_beatmap_data;
    }

    async play_next() {
        if (this.is_preview || !this.get_next_id_callback) {
            return;
        }

        console.log(`[${this.id}] getting next song`);

        this.store.update((obj) => ({ ...obj, is_loading: true, is_changing_selection: true }));

        try {
            const next_id = await this.get_next_id_callback(0); // 0 = auto

            if (!next_id) {
                console.log(`[${this.id}] no next id returned`);
                return;
            }

            const result = await this.load_and_setup_audio(next_id);

            if (result) {
                await this.play();
            }
        } catch (error) {
            console.error(`[${this.id}] error getting next song:`, error);
        } finally {
            this.store.update((obj) => ({ ...obj, is_loading: false, is_changing_selection: false }));
        }
    }

    async play_previous() {
        if (this.is_preview || !this.get_next_id_callback) {
            return;
        }

        console.log(`[${this.id}] getting previous song`);
        this.store.update((obj) => ({ ...obj, is_changing_selection: true }));

        try {
            const prev_id = await this.get_next_id_callback(-1); // -1 = previous
            if (!prev_id) return;

            const result = await this.load_and_setup_audio(prev_id);
            if (result) {
                await this.play();
            }
        } catch (error) {
            console.error(`[${this.id}] error getting previous song:`, error);
        } finally {
            this.store.update((obj) => ({ ...obj, is_changing_selection: false }));
        }
    }

    async play_next_song() {
        if (this.is_preview || !this.get_next_id_callback) return;

        console.log(`[${this.id}] getting next song (manual)`);

        this.store.update((obj) => ({ ...obj, is_changing_selection: true }));

        try {
            const next_id = await this.get_next_id_callback(1); // 1 = next

            if (!next_id) {
                return;
            }

            const result = await this.load_and_setup_audio(next_id);

            if (result) {
                await this.play();
            }
        } catch (error) {
            console.error(`[${this.id}] error getting next song:`, error);
        } finally {
            this.store.update((obj) => ({ ...obj, is_changing_selection: false }));
        }
    }

    // == CLEANUP ==
    clean_audio() {
        const state = this.get_state();
        if (!state.audio) return;

        console.log(`[${this.id}] cleaning up current audio`);

        const audio = state.audio;

        // remove listeners
        audio.removeEventListener("canplaythrough", this.on_canplay);
        audio.removeEventListener("timeupdate", this.on_timeupdate);
        audio.removeEventListener("ended", this.on_ended);

        // cleanup audio
        audio.pause();
        audio.currentTime = 0;

        if (audio.src && audio.src.startsWith("blob:")) {
            window.URL.revokeObjectURL(audio.src);
        }

        audio.src = "";
    }
}

export const get_audio_preview = async (url) => {
    if (!url) {
        console.log("invalid preview url");
        return null;
    }

    try {
        const data = await window.fetch({
            url,
            headers: {
                Accept: "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5",
                "Sec-GPC": "1",
                "Sec-Fetch-Dest": "audio"
            }
        });

        if (data.status != 200) {
            console.log("failed to fetch preview audio:", data.error);
            return null;
        }

        const buffer = await data.arrayBuffer();
        const blob = new Blob([buffer], { type: "audio/ogg" });
        const audio = new Audio(window.URL.createObjectURL(blob));

        audio.preload = "auto";
        return audio;
    } catch (error) {
        console.log("error creating preview audio:", error);
        return null;
    }
};

export const get_local_audio = async (audio_path) => {
    if (!audio_path) {
        console.log("no audio_path provided");
        return null;
    }

    try {
        const data = await get_from_media(audio_path);

        if (data.status != 200) {
            console.log("failed to get local audio:", audio_path);
            return null;
        }

        const buffer = await data.arrayBuffer();
        const blob = new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
        const audio = new Audio(window.URL.createObjectURL(blob));

        audio.preload = "auto";
        return audio;
    } catch (error) {
        console.log("error creating local audio:", error);
        return null;
    }
};

const audio_managers = new Map();

/** @returns {AudioManager} */
export const get_audio_manager = (id) => {
    if (!audio_managers.has(id)) {
        audio_managers.set(id, new AudioManager(id));
    }
    return audio_managers.get(id);
};

export const radio_mode = writable("");
