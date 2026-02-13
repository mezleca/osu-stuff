import { writable, get } from "svelte/store";
import { BeatmapPlayer, GridLevel, load_font } from "@rel-packages/osu-beatmap-preview";
import { beatmap_preview, get_beatmap } from "../utils/beatmaps";
import { show_notification } from "./notifications";
import { config } from "./config";
import { get_audio_manager } from "./audio";
import { get_basename, url_to_media, url_to_resources } from "../utils/utils";

interface IBeatmapPreviewPlayerState {
    beatmap_loaded: boolean;
    beatmap_is_invalid: boolean;
    fetching_files: boolean;
    current_time: number;
    duration: number;
    is_playing: boolean;
    show_grid: boolean;
}

const DEFAULT_STATE: IBeatmapPreviewPlayerState = {
    beatmap_loaded: false,
    beatmap_is_invalid: false,
    fetching_files: false,
    current_time: 0,
    duration: 0,
    is_playing: false,
    show_grid: false
};

class BeatmapPreviewPlayerStore {
    store = writable<IBeatmapPreviewPlayerState>({ ...DEFAULT_STATE });

    private player: BeatmapPlayer | null = null;
    private assets_loaded = false;
    private cached_hitsounds: string[] | null = null;
    private radio_manager = get_audio_manager("radio");
    private load_request_id = 0;
    private load_controller: AbortController | null = null;

    subscribe = this.store.subscribe;

    private pause_radio_until_preview_stops = () => {
        if (!this.radio_manager.get_state().playing) {
            return;
        }

        this.radio_manager.pause_until(() => !this.get_state().is_playing);
    };

    private set_state = (data: Partial<IBeatmapPreviewPlayerState>) => {
        this.store.update((state) => ({ ...state, ...data }));
    };

    private start_load_request = (): { request_id: number; signal: AbortSignal } => {
        this.abort_active_load();
        this.load_controller = new AbortController();
        this.load_request_id += 1;
        return {
            request_id: this.load_request_id,
            signal: this.load_controller.signal
        };
    };

    private is_request_active = (request_id: number): boolean => {
        return request_id == this.load_request_id;
    };

    private abort_active_load = () => {
        if (this.load_controller) {
            this.load_controller.abort();
            this.load_controller = null;
        }
    };

    get_state = (): IBeatmapPreviewPlayerState => {
        return get(this.store);
    };

    setup_player = (canvas: HTMLCanvasElement | null) => {
        if (!canvas || this.player) {
            return;
        }

        const target_volume = (get(config).radio_volume ?? 50) / 100;
        const hitsound_volume = Math.max(0.08, Math.min(0.45, target_volume * 0.45));

        this.player = new BeatmapPlayer({
            canvas,
            playfield_scale: 0.9,
            auto_resize: true,
            volume: target_volume,
            hitsound_volume,
            audio_offset: 30,
            skin: {
                default_font: "osu default"
            }
        });

        this.player.on("timeupdate", (time) => {
            if (!this.player) {
                return;
            }

            this.set_state({
                current_time: time,
                duration: this.player.duration
            });
        });

        this.player.on("statechange", (playing) => {
            this.set_state({ is_playing: playing });

            if (playing) {
                this.pause_radio_until_preview_stops();
            }
        });
    };

    resize = (canvas_container: HTMLDivElement | null, canvas: HTMLCanvasElement | null) => {
        if (!canvas_container || !canvas) {
            return;
        }

        const rect = canvas_container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        this.player?.resize(rect.width, rect.height);
    };

    private get_hitsound_names = async (): Promise<string[]> => {
        if (this.cached_hitsounds) {
            return this.cached_hitsounds;
        }

        const names = await window.api.invoke("resources:get_hitsounds");
        this.cached_hitsounds = names;

        return names;
    };

    private ensure_assets = async () => {
        if (!this.player || this.assets_loaded) {
            return;
        }

        const default_font = {
            url: `url("${url_to_resources("fonts/KozGoProBold.otf")}")`,
            family: "osu default",
            weight: "600"
        };

        const hitsound_names = await this.get_hitsound_names();
        const hitsound_urls = hitsound_names.map((name) => url_to_resources(`hitsounds/${name}`));

        await load_font(default_font);
        await this.player.load_default_hitsounds(hitsound_urls);
        this.assets_loaded = true;
    };

    load_beatmap = async (beatmap_hash: string) => {
        if (!this.player || !beatmap_hash || this.get_state().fetching_files) {
            return;
        }

        const { request_id, signal } = this.start_load_request();

        this.set_state({
            fetching_files: true,
            beatmap_loaded: false,
            beatmap_is_invalid: false
        });

        try {
            const beatmap = await get_beatmap(beatmap_hash);

            if (!beatmap) {
                throw Error("beatmap not found...");
            }

            const files_result = await window.api.invoke("driver:get_beatmap_files", beatmap_hash);

            if (files_result.length < 2) {
                throw Error("failed to get beatmap files...");
            }

            let osu_content: string | null = null;
            let audio_data: ArrayBuffer | null = null;
            let background_blob: Blob | undefined;

            for (const file of files_result) {
                try {
                    if (!this.is_request_active(request_id) || !this.player) {
                        return;
                    }

                    const response = await fetch(url_to_media(file.location), { signal });

                    if (response.status != 200) {
                        console.warn("failed to get file:", file.location);
                        continue;
                    }

                    const lower_name = file.name.toLowerCase();

                    if (lower_name.endsWith(".osu")) {
                        osu_content = await response.text();
                        continue;
                    }

                    if (file.name == get_basename(beatmap.audio)) {
                        audio_data = await response.arrayBuffer();
                        continue;
                    }

                    if (beatmap.background && file.name == get_basename(beatmap.background)) {
                        background_blob = await response.blob();
                    }
                } catch (error) {
                    if ((error as Error)?.name == "AbortError") {
                        return;
                    }
                    console.error(error);
                }
            }

            if (!this.is_request_active(request_id) || !this.player) {
                return;
            }

            if (!osu_content) {
                throw Error("failed to get beatmap .osu");
            }

            if (!audio_data) {
                throw Error("failed to get beatmap audio");
            }

            await this.ensure_assets();

            const result = await this.player.load_beatmap_files(osu_content, audio_data, background_blob);

            if (!result.success) {
                // @ts-ignore
                throw Error("failed to load beatmap: " + result.reason);
            }

            this.pause_radio_until_preview_stops();
            this.player.play();

            this.set_state({
                beatmap_loaded: true,
                beatmap_is_invalid: false,
                duration: this.player.duration,
                is_playing: this.player.is_playing
            });
        } catch (error: any) {
            if (error?.name == "AbortError") {
                return;
            }
            console.error(error);
            show_notification({ type: "error", text: error?.message ?? "unknown error" });

            this.set_state({
                beatmap_loaded: true,
                beatmap_is_invalid: true
            });
        } finally {
            if (this.is_request_active(request_id)) {
                this.set_state({ fetching_files: false });
                this.load_controller = null;
            }
        }
    };

    seek = (progress: number) => {
        if (!this.player) {
            return;
        }

        this.player.seek(progress * this.player.duration);
    };

    toggle_pause = () => {
        if (!this.player) {
            return;
        }

        this.player.toggle_pause();
    };

    toggle_grid = () => {
        if (!this.player) {
            return;
        }

        const show_grid = !this.get_state().show_grid;

        this.player.update_config({
            grid_level: show_grid ? GridLevel.Large : GridLevel.None
        });

        this.set_state({ show_grid });
    };

    destroy_player = () => {
        this.abort_active_load();
        this.load_request_id += 1;

        if (!this.player) {
            return;
        }

        this.player.stop();
        this.player.dispose();
        this.player = null;
    };

    cleanup = () => {
        this.destroy_player();
        this.set_state({ ...DEFAULT_STATE });
        beatmap_preview.set(null);
    };
}

export const beatmap_preview_player = new BeatmapPreviewPlayerStore();
