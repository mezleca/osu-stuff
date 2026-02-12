import { writable, get } from "svelte/store";
import { BeatmapPlayer, GridLevel, load_font } from "@rel-packages/osu-beatmap-preview";
import { beatmap_preview, get_beatmap } from "../utils/beatmaps";
import { show_notification } from "./notifications";
import { config } from "./config";
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

    subscribe = this.store.subscribe;

    private set_state = (data: Partial<IBeatmapPreviewPlayerState>) => {
        this.store.update((state) => ({ ...state, ...data }));
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

            const files: Map<string, ArrayBuffer> = new Map();
            let has_audio = !!get(config).lazer_mode;

            for (const file of files_result) {
                try {
                    const response = await fetch(url_to_media(file.location));

                    if (response.status != 200) {
                        console.warn("failed to get file:", file.location);
                        continue;
                    }

                    if (file.name == get_basename(beatmap.audio)) {
                        has_audio = true;
                    }

                    files.set(file.name, await response.arrayBuffer());
                } catch (error) {
                    console.error(error);
                }
            }

            if (!has_audio) {
                throw Error("failed to get beatmap audio");
            }

            await this.ensure_assets();

            const result = await this.player.load_files(files);

            if (!result.success) {
                // @ts-ignore
                throw Error("failed to load beatmap: " + result.reason);
            }

            this.player.play();

            this.set_state({
                beatmap_loaded: true,
                beatmap_is_invalid: false,
                duration: this.player.duration,
                is_playing: this.player.is_playing
            });
        } catch (error: any) {
            console.error(error);
            show_notification({ type: "error", text: error?.message ?? "unknown error" });

            this.set_state({
                beatmap_loaded: true,
                beatmap_is_invalid: true
            });
        } finally {
            this.set_state({ fetching_files: false });
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
