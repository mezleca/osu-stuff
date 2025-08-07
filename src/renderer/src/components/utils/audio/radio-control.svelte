<script>
    import { onMount, onDestroy } from "svelte";
    import { get_audio_manager, get_local_audio } from "../../../lib/store/audio";
    import { get_beatmap_list } from "../../../lib/store/beatmaps";
    import { get_beatmap_data } from "../../../lib/utils/beatmaps";
    import { config } from "../../../lib/store/config";
    import { input } from "../../../lib/store/input";

    // icons
    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";
    import RandomIcon from "../../icon/random-icon.svelte";
    import RepeatIcon from "../../icon/repeat-icon.svelte";
    import NextIcon from "../../icon/next-icon.svelte";
    import PreviousIcon from "../../icon/previous-icon.svelte";
    import Volume from "../../icon/volume.svelte";
    import VolumeMuted from "../../icon/volume-muted.svelte";

    const audio_manager = get_audio_manager("radio");
    const radio_list = get_beatmap_list("radio");
    
    const { beatmaps, index, selected, invalid_selected } = radio_list;

    $: audio_state = $audio_manager;
    $: current_beatmap = $selected;
    $: current_id = current_beatmap?.md5;
    $: is_playing = audio_state.playing && audio_state.id == current_id;
    $: is_loading = audio_state.is_loading;
    $: is_changing_selection = audio_state.is_changing_selection;
    $: random_active = audio_manager.random;
    $: repeat_active = audio_manager.repeat;
    $: should_force_random = audio_manager.force_random;

    // sync volume with config
    $: {
        if (audio_state.volume != undefined) {
            config.set("radio_volume", audio_state.volume);
        }
    }

    // auto-play when selection changes
    $: {
        if (current_id && audio_state.id != current_id && !is_loading && !is_changing_selection) {
            handle_selection_change();
        }

        if ($should_force_random && audio_state.playing) {
            audio_state.pause();
            audio_manager.play_next();
        }
    }

    const get_next_id_callback = async (direction) => {
        if ($beatmaps.length == 0) {
            console.log("radio: no beatmaps available");
            return null;
        }

        const current_index = $index;
        let next_idx = current_index;

        if ($invalid_selected) {
            invalid_selected.set(false);
            next_idx = 0;
        } else if (direction == 0) {
            next_idx = audio_manager.calculate_next_index(current_index, $beatmaps.length, direction);
        } else {
            next_idx = audio_manager.calculate_next_index(current_index, $beatmaps.length, direction);
        }

        // get next beatmap id
        const beatmap_id = $beatmaps[next_idx];
        
        // update selection (if changed)
        if (next_idx != current_index) {
            const new_beatmap = await get_beatmap_data(beatmap_id);
            if (new_beatmap) {
                radio_list.select_beatmap(new_beatmap, next_idx);
            }
        }

        return beatmap_id;
    };

    const get_beatmap_data_callback = async (beatmap_id) => {
        return await get_beatmap_data(beatmap_id);
    };

    const handle_selection_change = async () => {
        if (!current_beatmap?.audio_path) {
            console.log("radio: no audio path for selected beatmap");
            return;
        }

        const audio = await get_local_audio(current_beatmap.audio_path);
        
        // handle invalid audio
        if (!audio) {
            console.log("radio: failed to create local audio");
            await audio_manager.play_next();
            return;
        }

        await audio_manager.setup_audio(current_id, audio);
        await audio_manager.play();
    };

    const handle_play_pause = async () => {
        if (!current_id) {
            console.log("radio: no current beatmap selected");
            return;
        }

        const state = audio_state;

        // toggle if same track
        if (state.id == current_id && state.audio) {
            if (state.playing) {
                audio_manager.pause();
            } else {
                await audio_manager.play();
            }
            return;
        }

        // play current selection
        if (state.id == current_id) {
            await audio_manager.play();
        }
    };

    const handle_seek = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        audio_manager.seek(percent);
    };

    const handle_volume = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        const volume = Math.round(percent * 100);
        audio_manager.set_volume(volume);
    };

    const toggle_random = () => {
        audio_manager.toggle_random();
    };

    const toggle_repeat = () => {
        audio_manager.toggle_repeat();
    };

    onMount(() => {
        // set up callbacks for the audio manager
        audio_manager.set_callbacks({
            get_next_id: get_next_id_callback,
            get_beatmap_data: get_beatmap_data_callback
        });

        // restore volume from config
        const saved_volume = config.get("radio_volume");

        if (saved_volume) {
            audio_manager.set_volume(saved_volume);
        }

        // set up keyboard shortcuts
        input.on("f2", () => { console.log("pressed f2"); });
        input.on("shift+f2", () => { console.log("pressed shift + f2"); });
    });

    onDestroy(() => {
        input.unregister("f2");
        input.unregister("shift+f2");
    });
</script>

<div>
    <!-- volume section -->
    <div class="volume-container">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="volume-icon" onclick={() => audio_manager.toggle_mute()}>
            {#if audio_state.volume != 0}
                <Volume />
            {:else}
                <VolumeMuted />
            {/if}
        </div>

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div role="button" tabindex={0} class="volume-bar" onclick={handle_volume}>
            <div class="volume-fill" style="width: {audio_state.volume}%;"></div>
        </div>
    </div>
    <div class="radio-control">
        <!-- progress section -->
        <div class="progress-section">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div role="button" tabindex="0" class="progress-bar" onclick={handle_seek}>
                <div class="progress-fill" style="width: {audio_state.progress_bar_width}%;"></div>
            </div>

            <div class="time-display">
                <span>{audio_state.progress}</span>
                <span>{audio_state.duration}</span>
            </div>
        </div>

        <div class="controls-section">
            <button class="control-btn random" class:active={$random_active} onclick={toggle_random}>
                <RandomIcon />
            </button>

            <div class="main-controls">
                <button class="control-btn previous" onclick={() => audio_manager.play_previous()}>
                    <PreviousIcon />
                </button>

                <button class="control-btn play-pause" onclick={handle_play_pause} disabled={is_loading}>
                    {#if is_loading}
                        <div class="spinner" style="width: 25px; height: 25px;"></div>
                    {:else if is_playing}
                        <Pause />
                    {:else}
                        <Play />
                    {/if}
                </button>

                <button class="control-btn next" onclick={() => audio_manager.play_next_song()}>
                    <NextIcon />
                </button>
            </div>

            <button class="control-btn repeat" class:active={$repeat_active} onclick={toggle_repeat}>
                <RepeatIcon />
            </button>
        </div>
    </div>
</div>

<style>
    .radio-control {
        display: flex;
        flex-direction: column;
        padding: 24px;
        background: rgba(19, 19, 19, 0.8);
        border-radius: 6px;
    }

    .volume-container {
        position: relative;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background-color: rgba(19, 19, 19, 0.8);
        border-radius: 6px;
        width: fit-content;
        margin-bottom: 10px;
    }

    .volume-bar {
        width: 0;
        overflow: hidden;
        transition: width 0.3s ease;
        background-color: #444;
        height: 6px;
        border-radius: 3px;
    }

    .volume-container:hover .volume-bar {
        width: 120px;
    }

    .volume-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
    }

    .progress-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .progress-bar {
        height: 6px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
        cursor: pointer;
        position: relative;
    }

    .progress-fill,
    .volume-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-color-half), var(--accent-color));
        border-radius: 3px;
        width: 0%;
        position: relative;
        transition: width 0.1s ease;
        pointer-events: none;
    }

    .time-display {
        display: flex;
        justify-content: space-between;
        color: rgba(255, 255, 255, 0.6);
        font-size: 12px;
        margin-bottom: 16px;
    }

    .controls-section {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
    }

    .main-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .control-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .control-btn:hover {
        transform: scale(1.05);
        color: white;
        background: rgba(255, 255, 255, 0.1);
    }

    .control-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .control-btn.active {
        background-color: var(--bg-tertiary);
    }

    .play-pause {
        padding: 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
    }

    .play-pause:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
    }
</style>