<script lang="ts">
    import { onMount, tick } from "svelte";
    import { ModalType, modals } from "../../../lib/utils/modal";
    import { BeatmapPlayer, GridLevel, load_default_fonts } from "@rel-packages/osu-beatmap-preview";
    import { beatmap_preview, get_beatmap } from "../../../lib/utils/beatmaps";
    import { default_hitsounds, get_basename, string_is_valid, url_to_media, url_to_resources } from "../../../lib/utils/utils";
    import { debounce } from "../../../lib/utils/timings";
    import { show_notification } from "../../../lib/store/notifications";
    import { config } from "../../../lib/store/config";
    import { input } from "../../../lib/store/input";

    // components
    import Spinner from "../../icon/spinner.svelte";
    import ControlBar from "../../utils/basic/control-bar.svelte";
    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";

    let beatmap_loaded = false;
    let beatmap_is_invalid = false;
    let observer: ResizeObserver | null = null;
    let player: BeatmapPlayer | null = null;
    let canvas_container: HTMLDivElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let assets_loaded = false;

    // data
    $: active_modals = $modals;
    $: has_modal = active_modals.has(ModalType.beatmap_preview);
    $: beatmap_data = $beatmap_preview;
    $: beatmap_hash = beatmap_data?.md5 ?? "";

    // progress
    let fetching_files = false;
    let current_time = 0;
    let duration = 0;
    let is_playing = false;
    let show_grid = false;

    const load_default_hitsounds = async (target: BeatmapPlayer) => {
        const files = new Map<string, ArrayBuffer>();

        for (const name of default_hitsounds) {
            try {
                const response = await fetch(url_to_resources(`hitsounds/${name}`));

                if (!response.ok) {
                    continue;
                }

                files.set(name, await response.arrayBuffer());
            } catch (err) {
                console.error(err);
            }
        }

        if (files.size > 0) {
            await target.load_hitsounds(files);
        }
    };

    const stop_player = () => {
        if (player) {
            player.stop();
            player.dispose();
            player = null;
        }
    };

    $: progress_percentage = duration > 0 ? (current_time / duration) * 100 : 0;

    const get_beatmap_files = async () => {
        if (!beatmap_hash) return;

        fetching_files = true;

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

            // check if we're missing the important shit (audio / .osu)
            // get_beatmapset_files already deals with the .osu file check so lets check for the audio
            // TOFIX: i dont want to deal with this garbage on lazer so fuck it
            let has_audio = !!config.get("lazer_mode");

            for (const file of files_result) {
                try {
                    const response = await fetch(url_to_media(file.location));

                    if (response.status != 200) {
                        console.warn("failed to get file:", file.location);
                        continue;
                    }

                    if (file.name == get_basename(beatmap.audio)) has_audio = true;

                    files.set(file.name, await response.arrayBuffer());
                } catch (err) {
                    console.error(err);
                }
            }

            if (!has_audio) {
                throw Error("failed to get beatmap audio");
            }

            if (!player) {
                throw Error("player not initialized");
            }

            if (!assets_loaded) {
                // TOFIX: preview unload all loaded hitsounds on dispose...
                // assets_loaded = true;

                // TOFIX: this api sucks holy shit
                await load_default_fonts(url_to_resources("fonts"));

                // TOFIX: also, this should be a preview helper not something here
                await load_default_hitsounds(player);
            }

            const result = await player.load_files(files);

            if (!result.success) {
                // @ts-ignore
                throw Error("failed to load beatmap: " + result.reason);
            }

            // sync initial state
            duration = player.duration;
            is_playing = player.is_playing;
            player.play();
            beatmap_is_invalid = false;
        } catch (err: any) {
            console.log(err);
            show_notification({ type: "error", text: err?.message ?? "unknown error" });
            beatmap_is_invalid = true;
        } finally {
            beatmap_loaded = true;
            fetching_files = false;
        }
    };

    const resize_canvas = () => {
        if (!canvas_container || !canvas) return;

        const rect = canvas_container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        player?.resize(rect.width, rect.height);
    };

    const seek = (pos: number) => {
        if (!player) return;
        player.seek(pos * player.duration);
    };

    const debounced_pause_toggle = debounce(() => {
        if (!player) return;
        player.toggle_pause();
    }, 50);

    const toggle_grid = () => {
        if (!player) return;

        show_grid = !show_grid;

        player.update_config({
            grid_level: show_grid ? GridLevel.Large : GridLevel.None
        });
    };

    const setup_player = () => {
        console.log("[setup_player] initializing");

        const target_volume = ($config.radio_volume ?? 50) / 100;
        const hitsound_volume = Math.max(0.05, Math.min(0.3, target_volume * 0.35));

        if (!player) {
            player = new BeatmapPlayer({
                canvas,
                playfield_scale: 0.9,
                auto_resize: true,
                volume: target_volume,
                hitsound_volume
            });
        }

        player.on("timeupdate", (t) => {
            current_time = t;
            duration = player.duration;
        });

        player.on("statechange", (playing) => (is_playing = playing));

        // ensure resize after modal is visible
        tick().then(() => {
            setTimeout(() => {
                resize_canvas();
            }, 100);
        });
    };

    const cleanup = () => {
        if (player) stop_player();
        if (observer) observer.disconnect();
        beatmap_loaded = false;
        beatmap_is_invalid = false;
        current_time = 0;
        duration = 0;
        is_playing = false;
        beatmap_preview.set(null);
        modals.hide(ModalType.beatmap_preview);
        debounced_pause_toggle.cancel();
    };

    const open_on_browser = () => {
        if (!beatmap_data?.beatmapset_id) return;
        window.api.invoke("shell:open", `https://osu.ppy.sh/beatmapsets/${beatmap_data.beatmapset_id}`);
    };

    onMount(() => {
        // setup listeners
        const handle_pause_id = input.on("space", debounced_pause_toggle);
        const handle_grid_id = input.on("g", toggle_grid);

        // leave preview using escape
        const handle_escape_id = input.on("escape", () => {
            cleanup();
        });

        return () => {
            cleanup();

            input.unregister(handle_pause_id);
            input.unregister(handle_grid_id);
            input.unregister(handle_escape_id);
        };
    });

    $: {
        // setup canvas if needed
        if (canvas && !player && has_modal) {
            setup_player();
        }

        if (canvas_container && !observer) {
            observer = new ResizeObserver(() => resize_canvas());
            observer.observe(canvas_container);
        }

        if (canvas && beatmap_hash && !beatmap_loaded && has_modal && !fetching_files) {
            console.log("[preview] loading new beatmap:", beatmap_hash, beatmap_data?.title);
            get_beatmap_files();
        }
    }
</script>

{#if has_modal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup} style="background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);">
        {#if !string_is_valid(beatmap_hash) || beatmap_is_invalid}
            <h2 style="color: white; font-weight: 500;">beatmap not found :c</h2>
        {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="player-container" onclick={(e) => e.stopPropagation()}>
                {#if !beatmap_loaded}
                    <div class="loading-overlay">
                        <Spinner width={48} height={48} />
                        <span class="loading-text" style="margin-top: 12px; font-size: 1.1em; color: #ccc;">loading beatmap...</span>
                    </div>
                {/if}

                <div class="canvas-container" bind:this={canvas_container}>
                    <canvas bind:this={canvas} class:visible={beatmap_loaded}></canvas>
                </div>

                <div class="controls-container">
                    <div class="beatmap-info">
                        <span class="beatmap-title">
                            {beatmap_data?.artist} - {beatmap_data?.title} [{beatmap_data?.difficulty}]
                        </span>
                        <button class="icon-button" onclick={open_on_browser}>open on browser</button>
                    </div>

                    <div class="controls-row">
                        <button
                            class="icon-button"
                            onclick={(e) => {
                                debounced_pause_toggle();
                                e.currentTarget.blur();
                            }}
                        >
                            {#if is_playing}
                                <Pause width={18} height={18} />
                            {:else}
                                <Play width={18} height={18} />
                            {/if}
                        </button>
                        <ControlBar value={progress_percentage} callback={seek} />
                    </div>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .modal-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100vw;
        height: 100vh;
        padding: 32px;
        box-sizing: border-box;
    }

    .player-container {
        position: relative;
        width: min(1400px, 95%);
        height: min(900px, 95%);
        background-color: #0c0c0c;
        border-radius: 12px;
        margin-top: 4em;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .canvas-container {
        position: relative;
        flex: 1;
        min-height: 0;
        background-color: #0c0c0c;
    }

    canvas {
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    canvas.visible {
        opacity: 1;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: #0c0c0c;
        z-index: 10;
    }

    .controls-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px 10px 10px;
        background: rgba(10, 10, 10, 0.85);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .beatmap-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-left: 4px;
        gap: 10px;
    }

    .beatmap-title,
    .loading-text {
        font-family: "Torus Semibold";
    }

    .beatmap-title {
        font-size: 13px;
    }

    .controls-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        height: 100%;
    }

    .icon-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 8px;
        transition: all 0.2s;
        opacity: 0.8;
        font-family: "Torus SemiBold";
        font-size: 12px;
    }

    .icon-button:hover {
        background: rgba(255, 255, 255, 0.1);
        opacity: 1;
    }
</style>
