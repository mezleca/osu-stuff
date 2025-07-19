import { writable, get } from "svelte/store";
import { format_time } from "../utils/utils.js";
import { get_from_media } from "../utils/utils.js";

const PREVIEW_BASE_URL = "https://b.ppy.sh/preview/";
const DEFAULT_VOLUME = 50;

class AudioManager {
    constructor(id) {
        this.id = id;
        this.is_preview = id == "preview";
        this.random = writable(false);
        this.repeat = writable(false);

        this.store = writable({
            audio: null,
            id: null,
            playing: false,
            ended: false,
            volume: DEFAULT_VOLUME,
            progress: "0:00",
            duration: "0:00",
            progress_bar_width: 0,
            is_loading: false
        });

        this.next_callback = null;
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

        if (state.audio != event.target) {
            return;
        }

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

        if (state.audio != event.target) {
            return;
        }

        console.log(`[${this.id}] audio ended`);

        this.store.update((obj) => ({
            ...obj,
            playing: false,
            ended: true,
            progress_bar_width: 100
        }));

        // auto-play next for radio mode
        if (!this.is_preview && this.next_callback) {
            await this.play_next();
        }
    };

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

    async play(audio = null) {
        const state = this.get_state();
        const target_audio = audio || state.audio;

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
            console.log(`[${this.id}] play error:`, error);
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
                console.log(`[${this.id}] resuming cuz codition == true`);
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
        console.log(`[${this.id}] random: ${get(this.random)} | ${enabled}`);
    }

    set_repeat(enabled) {
        if (this.is_preview) return;
        this.repeat.set(enabled);
        console.log(`[${this.id}] repeat: ${get(this.repeat)} | ${enabled}`);
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

    set_next_callback(callback) {
        if (this.is_preview) return;
        this.next_callback = callback;
    }

    async play_next() {
        if (this.is_preview || !this.next_callback) {
            return;
        }

        console.log(`[${this.id}] getting next song`);

        this.store.update((obj) => ({ ...obj, is_loading: true }));

        try {
            const result = await this.next_callback(0); // 0 = auto

            if (result && result.audio && result.id) {
                await this.setup_audio(result.id, result.audio);
                await this.play();
            }
        } catch (error) {
            console.log(`[${this.id}] error getting next song:`, error);
        } finally {
            this.store.update((obj) => ({ ...obj, is_loading: false }));
        }
    }

    async play_previous() {
        if (this.is_preview || !this.next_callback) {
            return;
        }

        console.log(`[${this.id}] getting previous song`);

        try {
            const result = await this.next_callback(-1); // -1 = previous
            if (result && result.audio && result.id) {
                await this.setup_audio(result.id, result.audio);
                await this.play();
            }
        } catch (error) {
            console.log(`[${this.id}] error getting previous song:`, error);
        }
    }

    async play_next_song() {
        if (this.is_preview || !this.next_callback) {
            return;
        }

        console.log(`[${this.id}] getting next song (manual)`);

        try {
            const result = await this.next_callback(1); // 1 = next
            if (result && result.audio && result.id) {
                await this.setup_audio(result.id, result.audio);
                await this.play();
            }
        } catch (error) {
            console.log(`[${this.id}] error getting next song:`, error);
        }
    }

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

export const get_audio_preview = async (beatmap_id) => {
    if (!beatmap_id) {
        console.log("no beatmap_id for preview");
        return null;
    }

    const url = `${PREVIEW_BASE_URL}${beatmap_id}.mp3`;

    try {
        const data = await window.extra.fetch({
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

        const blob = new Blob([data.data], { type: "audio/ogg" });
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
