<script lang="ts">
    import { onMount } from "svelte";
    import { tick } from "svelte";
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { BeatmapPlayer, GridLevel } from "@rel-packages/osu-beatmap-preview";
    import { beatmap_preview } from "../../../lib/utils/beatmaps";
    import { string_is_valid, url_from_media } from "../../../lib/utils/utils";
    import { show_notification } from "../../../lib/store/notifications";
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
    let player_container: HTMLDivElement | null = null;
    let canvas: HTMLCanvasElement = null;

    // data
    $: beatmap_data = $beatmap_preview;
    $: beatmap_hash = beatmap_data?.md5 ?? "";

    // progress
    let current_time = 0;
    let duration = 0;
    let is_playing = false;
    let show_grid = false;

    // overlay visibility
    let overlay_visible = false;
    let overlay_timeout: any = null;

    const stop_player = () => {
        if (player) {
            player.stop();
            player.dispose();
            player = null;
        }
    };

    const reset_overlay_timeout = () => {
        overlay_visible = true;
        clearTimeout(overlay_timeout);
        overlay_timeout = setTimeout(() => {
            overlay_visible = false;
        }, 1000);
    };

    const handle_mouse_move = () => {
        reset_overlay_timeout();
    };

    const handle_mouse_leave = () => {
        overlay_visible = false;
        clearTimeout(overlay_timeout);
    };

    $: progress_percentage = duration > 0 ? (current_time / duration) * 100 : 0;

    const get_beatmap_files = async () => {
        if (!beatmap_hash) return;

        try {
            const files_result = await window.api.invoke("driver:get_beatmap_files", beatmap_hash);

            if (files_result.length < 2) {
                throw Error("failed to get beatmap files...");
            }

            const files: Map<string, ArrayBuffer> = new Map();

            for (const file of files_result) {
                const response = await fetch(url_from_media(file.location));

                if (response.status != 200) {
                    console.warn("failed to get file:", file.location);
                    continue;
                }

                files.set(file.name, await response.arrayBuffer());
            }

            if (files.size < 2) {
                throw Error("failed to get beatmap files...");
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
        }
    };

    const resize_canvas = () => {
        if (!player_container || !canvas) return;

        const rect = player_container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        player?.resize(rect.width, rect.height);
    };

    const seek = (pos: number) => {
        if (!player) return;
        player.seek(pos * player.duration);
    };

    const toggle_pause = () => {
        player?.toggle_pause();
    };

    const toggle_grid = () => {
        show_grid = !show_grid;

        player.update_config({
            grid_level: show_grid ? GridLevel.Large : GridLevel.None
        });
    };

    const cleanup = () => {
        stop_player();
        beatmap_preview.set(null);
        show_modal(ModalType.none);
    };

    const open_on_browser = () => {
        if (!beatmap_data?.beatmapset_id) return;
        window.api.invoke("shell:open", `https://osu.ppy.sh/beatmapsets/${beatmap_data.beatmapset_id}`);
    };

    $: {
        if ($current_modal != ModalType.beatmap_preview) {
            if (player) stop_player();

            beatmap_loaded = false;
            beatmap_is_invalid = false;
            current_time = 0;
            duration = 0;
            is_playing = false;
        }

        if (canvas && !player && $current_modal === ModalType.beatmap_preview) {
            player = new BeatmapPlayer({
                canvas,
                playfield_scale: 1,
                volume: 0.5,
                renderer_config: { scale: 1 }
            });

            player.on("timeupdate", (t) => {
                current_time = t;
                duration = player.duration;
            });

            player.on("statechange", (playing) => {
                is_playing = playing;
            });

            // ensure resize after modal is visible
            tick().then(() => {
                setTimeout(() => {
                    resize_canvas();
                }, 100);
            });
        }

        if (player_container && !observer) {
            observer = new ResizeObserver(() => resize_canvas());
            observer.observe(player_container);
        }

        if (canvas && beatmap_hash && !beatmap_loaded && $current_modal === ModalType.beatmap_preview) {
            console.log("[preview] loading new beatmap:", beatmap_hash, beatmap_data?.title);
            get_beatmap_files();
        }
    }

    $: if ($beatmap_preview) {
        console.log("[preview] store updated:", $beatmap_preview?.md5, $beatmap_preview?.title);
    }

    onMount(() => {
        input.on("space", () => {
            toggle_pause();
        });

        input.on("g", () => {
            toggle_grid();
        });

        return () => {
            beatmap_preview.set(null);
            stop_player();
            input.unregister("space");
            observer?.disconnect();
            show_modal(ModalType.none);
        };
    });
</script>

{#if $current_modal == ModalType.beatmap_preview}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup} style="background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);">
        {#if !string_is_valid(beatmap_hash) || beatmap_is_invalid}
            <h2 style="color: white; font-weight: 500;">beatmap not found :c</h2>
        {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="player-container"
                bind:this={player_container}
                onclick={(e) => e.stopPropagation()}
                onmousemove={handle_mouse_move}
                onmouseleave={handle_mouse_leave}
            >
                {#if !beatmap_loaded}
                    <div class="loading-overlay">
                        <Spinner width={48} height={48} />
                        <span style="margin-top: 12px; font-size: 1.1em; color: #ccc;">loading beatmap...</span>
                    </div>
                {/if}

                <canvas bind:this={canvas} class:visible={beatmap_loaded}></canvas>

                <div class="overlay-container" class:visible={beatmap_loaded && overlay_visible}>
                    <div class="player-overlay info">
                        <div class="controls-row">
                            <span class="beatmap-info">
                                {beatmap_data?.artist} - {beatmap_data?.title} [{beatmap_data?.difficulty}]
                            </span>
                            <div class="top-actions">
                                <button class="icon-button" class:active={show_grid} onclick={toggle_grid}>toggle grid</button>
                                <button class="icon-button" onclick={open_on_browser}>open on browser</button>
                            </div>
                        </div>
                    </div>

                    <div class="player-overlay progress">
                        <div class="controls-row">
                            <button class="icon-button" onclick={toggle_pause}>
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
    }

    .player-container {
        position: relative;
        width: 90%;
        max-width: 1200px;
        height: 70%;
        background-color: #0c0c0c;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
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

    .overlay-container {
        position: absolute;
        bottom: 12px;
        left: 16px;
        width: calc(100% - 32px);
        display: flex;
        flex-direction: column;
        gap: 8px;
        opacity: 0;
        transform: translateY(6px);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 20;
        pointer-events: none;
    }

    .overlay-container.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }

    .player-overlay {
        padding: 4px 12px;
        background: rgba(10, 10, 10, 0.8);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .beatmap-info {
        color: white;
        font-family: "Torus SemiBold";
        font-size: 0.88em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
    }

    .top-actions {
        display: flex;
        gap: 8px;
    }

    .controls-row {
        display: flex;
        align-items: center;
        gap: 10px;
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
        padding: 8px;
        border-radius: 8px;
        transition: all 0.2s;
        opacity: 0.8;
    }

    .icon-button:hover {
        background: rgba(255, 255, 255, 0.1);
        opacity: 1;
    }

    .icon-button.active {
        color: var(--accent-color);
        background: rgba(var(--accent-color-rgb), 0.1);
    }

    :global(.control-bar) {
        flex: 1;
    }
</style>
