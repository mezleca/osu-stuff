import { writable, get, type Writable } from "svelte/store";
import { custom_fetch, format_time, get_local_audio } from "../utils/utils";

const DEFAULT_VOLUME = 50;

interface IAudioState {
    audio: HTMLAudioElement | null;
    id: string | null;
    playing: boolean;
    ended: boolean;
    volume: number;
    progress: string;
    duration: string;
    progress_bar_width: number;
    is_loading: boolean;
}

interface IAudioCallbacks {
    get_next_id: (direction: number) => Promise<string | null>;
    get_beatmap: (id: string) => Promise<any>;
}

type Direction = -1 | 0 | 1;

const DEFAULT_STATE: IAudioState = {
    audio: null,
    id: null,
    playing: false,
    ended: false,
    volume: DEFAULT_VOLUME,
    progress: "0:00",
    duration: "0:00",
    progress_bar_width: 0,
    is_loading: false
};

class AudioManager {
    id: string;
    is_preview: boolean;

    random: Writable<boolean> = writable(false);
    repeat: Writable<boolean> = writable(false);
    force_random: Writable<boolean> = writable(false);
    failed: Writable<boolean> = writable(false);
    store: Writable<IAudioState> = writable({ ...DEFAULT_STATE });

    callbacks: IAudioCallbacks | null = null;
    pause_interval: NodeJS.Timeout | null = null;

    constructor(id: string) {
        this.id = id;
        this.is_preview = id === "preview";
    }

    subscribe = (run: (value: IAudioState) => void, invalidate?: (value?: IAudioState) => void) => {
        return this.store.subscribe(run, invalidate);
    };

    get_state = (): IAudioState => {
        return get(this.store);
    };

    on_canplay = (event: Event) => {
        const target = event.target as HTMLAudioElement;
        const state = this.get_state();

        if (state.audio !== target) {
            return;
        }

        const duration = target.duration;

        if (!isFinite(duration) || duration <= 0) {
            target.addEventListener("durationchange", this.on_durationchange, { once: true });
            this.store.update((obj) => ({ ...obj, is_loading: false }));
            return;
        }

        target.removeEventListener("canplaythrough", this.on_canplay);

        this.store.update((obj) => ({
            ...obj,
            duration: format_time(duration),
            is_loading: false
        }));
    };

    on_durationchange = (event: Event) => {
        const target = event.target as HTMLAudioElement;
        const state = this.get_state();

        if (state.audio !== target) {
            return;
        }

        const duration = target.duration;

        if (isFinite(duration) && duration > 0) {
            this.store.update((obj) => ({
                ...obj,
                duration: format_time(duration)
            }));
        }
    };

    on_timeupdate = (event: Event) => {
        const target = event.target as HTMLAudioElement;
        const state = this.get_state();

        if (state.audio !== target) {
            return;
        }

        const current_time = target.currentTime ?? 0;
        const duration = target.duration ?? 1;

        this.store.update((obj) => ({
            ...obj,
            progress: format_time(current_time),
            progress_bar_width: (current_time / duration) * 100
        }));
    };

    on_ended = async (event: Event) => {
        const target = event.target as HTMLAudioElement;
        const state = this.get_state();

        if (state.audio !== target) {
            return;
        }

        console.log(`[${this.id}] audio ended`);

        this.store.update((obj) => ({
            ...obj,
            playing: false,
            ended: true,
            progress_bar_width: 100
        }));

        if (!this.is_preview) {
            await this.navigate(0);
        }
    };

    calculate_next_index = (current_index: number, beatmaps_length: number, direction: Direction = 0): number => {
        const force_random = get(this.force_random);
        const random_idx = Math.floor(Math.random() * beatmaps_length);

        if (force_random) {
            return random_idx;
        }

        const random_active = get(this.random);
        const repeat_active = get(this.repeat);

        if (direction === -1) {
            return current_index - 1 < 0 ? beatmaps_length - 1 : current_index - 1;
        }

        if (direction === 1) {
            return current_index + 1 >= beatmaps_length ? 0 : current_index + 1;
        }

        if (repeat_active) {
            this.set_repeat(false);
            return current_index;
        }

        if (random_active) {
            return random_idx;
        }

        return current_index + 1 >= beatmaps_length ? 0 : current_index + 1;
    };

    setup_audio = (id: string, audio_data: HTMLAudioElement): HTMLAudioElement => {
        console.log(`[${this.id}] setting up audio for: ${id}`);

        const old_state = this.get_state();

        if (old_state.id === id && old_state.audio) {
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

        audio_data.addEventListener("canplaythrough", this.on_canplay);
        audio_data.addEventListener("timeupdate", this.on_timeupdate);
        audio_data.addEventListener("durationchange", this.on_durationchange);
        audio_data.addEventListener("ended", this.on_ended);

        // check if duration is already available
        if (isFinite(audio_data.duration) && audio_data.duration > 0) {
            this.on_durationchange({ target: audio_data } as any);
        }

        audio_data.volume = this.get_state().volume / 100;

        return audio_data;
    };

    load_and_setup_audio = async (beatmap_id: string): Promise<{ beatmap: any; audio: HTMLAudioElement } | null> => {
        if (!this.callbacks?.get_beatmap) {
            console.error(`[${this.id}] no get_beatmap callback set`);
            return null;
        }

        // clean old audio immediately to avoid state leakage
        this.clean_audio();

        try {
            const beatmap = await this.callbacks.get_beatmap(beatmap_id);

            if (!beatmap?.audio) {
                console.log(`[${this.id}] beatmap ${beatmap_id} has no audio path`);
                return null;
            }

            const audio = await get_local_audio(beatmap.audio);

            if (!audio) {
                console.log(`[${this.id}] failed to create audio for ${beatmap_id}`);
                return null;
            }

            this.setup_audio(beatmap.md5, audio);
            return { beatmap, audio };
        } catch (error) {
            console.error(`[${this.id}] error loading audio for ${beatmap_id}:`, error);
            return null;
        }
    };

    play = async (): Promise<boolean> => {
        const state = this.get_state();
        const target_audio = state.audio;

        if (!target_audio) {
            console.log(`[${this.id}] no audio to play`);
            return false;
        }

        console.log(`[${this.id}] playing audio`);

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
        } catch (error: any) {
            if (error.name !== "NotAllowedError") {
                console.log(`[${this.id}] play error:`, error);
            }
            this.store.update((obj) => ({ ...obj, playing: false }));
            return false;
        }
    };

    pause = (audio: HTMLAudioElement | null = null): void => {
        const state = this.get_state();
        const target_audio = audio || state.audio;

        if (!target_audio) {
            return;
        }

        console.log(`[${this.id}] pausing audio`);
        target_audio.pause();
        this.store.update((obj) => ({ ...obj, playing: false }));
    };

    pause_until = (condition: () => boolean): void => {
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

                if (this.pause_interval) {
                    clearInterval(this.pause_interval);
                    this.pause_interval = null;
                }
            }
        }, 100);
    };

    seek = (percent: number): void => {
        const state = this.get_state();

        if (!state.audio || !isFinite(state.audio.duration)) {
            return;
        }

        const target_time = percent * state.audio.duration;
        state.audio.currentTime = target_time;

        console.log(`[${this.id}] seeking to: ${format_time(target_time)} (${(percent * 100).toFixed(1)}%)`);
    };

    set_volume = (volume: number): void => {
        const state = this.get_state();

        if (state.audio) {
            state.audio.volume = volume / 100;
        }

        this.store.update((obj) => ({ ...obj, volume }));
        console.log(`[${this.id}] volume set to: ${volume}%`);
    };

    toggle_mute = (): void => {
        const current_volume = this.get_state().volume;
        this.set_volume(current_volume > 0 ? 0 : DEFAULT_VOLUME);
    };

    set_random = (enabled: boolean): void => {
        if (this.is_preview) return;
        this.random.set(enabled);
    };

    set_repeat = (enabled: boolean): void => {
        if (this.is_preview) return;
        this.repeat.set(enabled);
    };

    toggle_random = (): boolean => {
        const current_value = get(this.random);
        const new_value = !current_value;
        this.set_random(new_value);
        return new_value;
    };

    toggle_repeat = (): boolean => {
        const current_value = get(this.repeat);
        const new_value = !current_value;
        this.set_repeat(new_value);
        return new_value;
    };

    set_callbacks = (callbacks: IAudioCallbacks): void => {
        if (this.is_preview) return;
        this.callbacks = callbacks;
    };

    navigate = async (direction: Direction): Promise<boolean> => {
        if (this.is_preview || !this.callbacks?.get_next_id) {
            return false;
        }

        const direction_label = direction === -1 ? "previous" : direction === 1 ? "next (manual)" : "next (auto)";
        console.log(`[${this.id}] navigating to ${direction_label} song`);

        this.store.update((obj) => ({ ...obj, is_loading: true }));

        try {
            const next_id = await this.callbacks.get_next_id(direction);

            if (!next_id) {
                console.log(`[${this.id}] no ${direction_label} id returned`);
                this.store.update((obj) => ({ ...obj, is_loading: false }));
                return false;
            }

            const result = await this.load_and_setup_audio(next_id);

            if (!result) {
                this.store.update((obj) => ({ ...obj, is_loading: false }));
                return false;
            }

            await this.play();
            this.store.update((obj) => ({ ...obj, is_loading: false }));
            return true;
        } catch (error) {
            console.error(`[${this.id}] error navigating:`, error);
            this.store.update((obj) => ({ ...obj, is_loading: false }));
            return false;
        }
    };

    clean_audio = (): void => {
        const state = this.get_state();
        const audio = state.audio;

        if (audio) {
            console.log(`[${this.id}] cleaning up current audio`);
            audio.pause();
            audio.removeEventListener("canplaythrough", this.on_canplay);
            audio.removeEventListener("timeupdate", this.on_timeupdate);
            audio.removeEventListener("durationchange", this.on_durationchange);
            audio.removeEventListener("ended", this.on_ended);

            // revoke object url if it's one of ours
            if ((audio as any)._blob_url) {
                URL.revokeObjectURL((audio as any)._blob_url);
            }

            audio.src = "";
            audio.load();
        }

        this.store.update((obj) => ({
            ...obj,
            id: null,
            audio: null,
            playing: false,
            is_loading: false,
            duration: "0:00",
            progress: "0:00",
            progress_bar_width: 0,
            ended: false
        }));
    };
}

export const get_audio_preview = async (url: string): Promise<HTMLAudioElement | null> => {
    if (!url) {
        console.log("invalid preview url");
        return null;
    }

    try {
        const result = await custom_fetch({
            method: "GET",
            url,
            headers: {
                Accept: "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5",
                "Sec-GPC": "1",
                "Sec-Fetch-Dest": "audio"
            }
        });

        if (result.status != 200) {
            console.log("failed to fetch preview audio:", result.error);
            return null;
        }

        const blob = new Blob([result.data], { type: "audio/ogg" });
        const audio = new Audio(window.URL.createObjectURL(blob));

        audio.preload = "auto";
        return audio;
    } catch (error) {
        console.log("error creating preview audio:", error);
        return null;
    }
};

export const toggle_beatmap_preview = async (beatmapset_id: number) => {
    const manager = get_audio_manager("preview");
    const state = manager.get_state();
    const url = `https://b.ppy.sh/preview/${beatmapset_id}.mp3`;

    // toggle if same audio
    if (state.id == String(beatmapset_id) && state.audio) {
        if (state.playing) {
            manager.pause();
        } else {
            await manager.play();
        }
        return;
    }

    // setup new audio
    const audio = await get_audio_preview(url);

    if (!audio) {
        console.log("preview: failed to create audio");
        return;
    }

    manager.setup_audio(String(beatmapset_id), audio);
    await manager.play();
};

const audio_managers = new Map<string, AudioManager>();

export const get_audio_manager = (id: string): AudioManager => {
    if (!audio_managers.has(id)) {
        audio_managers.set(id, new AudioManager(id));
    }
    return audio_managers.get(id)!;
};

export const reset_audio_manager = (): void => {
    const managers = Array.from(audio_managers.values());

    for (const manager of managers) {
        manager.clean_audio();
    }
};
