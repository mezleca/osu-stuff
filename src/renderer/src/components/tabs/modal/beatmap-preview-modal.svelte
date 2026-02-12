<script lang="ts">
    import { onMount, tick } from "svelte";
    import { ModalType, modals } from "../../../lib/utils/modal";
    import { beatmap_preview } from "../../../lib/utils/beatmaps";
    import { string_is_valid } from "../../../lib/utils/utils";
    import { debounce } from "../../../lib/utils/timings";
    import { input } from "../../../lib/store/input";
    import { beatmap_preview_player } from "../../../lib/store/beatmap_preview_player";

    // components
    import Spinner from "../../icon/spinner.svelte";
    import ControlBar from "../../utils/basic/control-bar.svelte";
    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";

    let observer: ResizeObserver | null = null;
    let did_setup = false;
    let canvas_container: HTMLDivElement | null = null;
    let canvas: HTMLCanvasElement | null = null;

    // data
    $: active_modals = $modals;
    $: has_modal = active_modals.has(ModalType.beatmap_preview);
    $: beatmap_data = $beatmap_preview;
    $: preview_state = $beatmap_preview_player;
    $: beatmap_hash = beatmap_data?.md5 ?? "";
    $: progress_percentage = preview_state.duration > 0 ? (preview_state.current_time / preview_state.duration) * 100 : 0;

    const seek = (pos: number) => {
        beatmap_preview_player.seek(pos);
    };

    const debounced_pause_toggle = debounce(() => {
        beatmap_preview_player.toggle_pause();
    }, 50);

    const toggle_grid = () => {
        beatmap_preview_player.toggle_grid();
    };

    const cleanup = () => {
        beatmap_preview_player.cleanup();
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        did_setup = false;
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

    $: if (canvas && has_modal && !did_setup) {
        did_setup = true;
        beatmap_preview_player.setup_player(canvas);

        tick().then(() => {
            requestAnimationFrame(() => {
                beatmap_preview_player.resize(canvas_container, canvas);
            });
        });
    }

    $: if (canvas_container && has_modal && !observer) {
        observer = new ResizeObserver(() => beatmap_preview_player.resize(canvas_container, canvas));
        observer.observe(canvas_container);
    }

    $: if (!has_modal && observer) {
        observer.disconnect();
        observer = null;
    }

    $: if (canvas && beatmap_hash && has_modal && !preview_state.beatmap_loaded && !preview_state.fetching_files) {
        console.log("[preview] loading new beatmap:", beatmap_hash, beatmap_data?.title);
        beatmap_preview_player.load_beatmap(beatmap_hash);
    }
</script>

{#if has_modal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup} style="background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);">
        {#if !string_is_valid(beatmap_hash) || preview_state.beatmap_is_invalid}
            <h2 style="color: white; font-weight: 500;">beatmap not found :c</h2>
        {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="player-container" onclick={(e) => e.stopPropagation()}>
                {#if !preview_state.beatmap_loaded}
                    <div class="loading-overlay">
                        <Spinner width={48} height={48} />
                        <span class="loading-text" style="margin-top: 12px; font-size: 1.1em; color: #ccc;">loading beatmap...</span>
                    </div>
                {/if}

                <div class="canvas-container" bind:this={canvas_container}>
                    <canvas bind:this={canvas} class:visible={preview_state.beatmap_loaded}></canvas>
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
                            {#if preview_state.is_playing}
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
