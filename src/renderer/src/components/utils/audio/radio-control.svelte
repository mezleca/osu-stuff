<script>
    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";
    import RandomIcon from "../../icon/random-icon.svelte";
    import RepeatIcon from "../../icon/repeat-icon.svelte";
    import NextIcon from "../../icon/next-icon.svelte";
    import PreviousIcon from "../../icon/previous-icon.svelte";
    import Volume from "../../icon/volume.svelte";
    import VolumeMuted from "../../icon/volume-muted.svelte";

    import { get_audio_manager, get_local_audio } from "../../../lib/store/audio";
    import { get_beatmap_list } from "../../../lib/store/beatmaps";
    import { get_beatmap_data } from "../../../lib/utils/beatmaps";
    import { config } from "../../../lib/store/config";

    const audio_manager = get_audio_manager("radio");
    const radio_list = get_beatmap_list("radio");

    const { beatmaps, index, selected, invalid_selected } = radio_list;

    $: audio_state = $audio_manager;
    $: current_beatmap = $selected;
    $: current_id = current_beatmap?.md5;
    $: is_playing = audio_state.playing && audio_state.id == current_id;
    $: is_loading = audio_state.is_loading;
    $: random_active = audio_manager.random;
    $: repeat_active = audio_manager.repeat;
    $: is_changing_selection = false;

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
    }

    const handle_selection_change = async () => {
        if (!current_beatmap?.audio_path) {
            console.log("radio: no audio path for selected beatmap");
            return;
        }

        is_loading = true;

        const audio = await get_local_audio(current_beatmap.audio_path);

        // @TOFIX: this prevents the same invalid song from playing over and over but this only works if the user is on the radio tab
        if (!audio) {
            console.log("radio: failed to create local audio");
            is_loading = false;
            await get_next_song(1);
            return;
        }

        await audio_manager.setup_audio(current_id, audio);
        await audio_manager.play();

        is_loading = false;
    };

    const get_next_song = async (direction = 0) => {
        if ($beatmaps.length == 0) {
            console.log("radio: no beatmaps available");
            return null;
        }

        is_changing_selection = true;

        const current_index = $index;
        let next_idx = current_index;

        // handle invalid selection context
        if ($invalid_selected) {
            invalid_selected.set(false);
            next_idx = 0;
        } else {
            // calculate next index based on direction and settings
            if (direction == 1) {
                next_idx = current_index + 1;
            } else if (direction == -1) {
                next_idx = current_index - 1;
            } else {
                if ($repeat_active) {
                    next_idx = current_index;
                    audio_manager.set_repeat(false); // disable after one repeat
                } else if ($random_active) {
                    next_idx = Math.floor(Math.random() * $beatmaps.length);
                } else {
                    next_idx = current_index + 1;
                }
            }

            // wrap around
            if (next_idx >= $beatmaps.length) {
                next_idx = 0;
            } else if (next_idx < 0) {
                next_idx = $beatmaps.length - 1;
            }
        }

        // get beatmap data
        const new_beatmap = await get_beatmap_data($beatmaps[next_idx]);

        if (!new_beatmap?.audio_path) {
            console.log("radio: invalid next beatmap");
            is_changing_selection = false;
            return null;
        }

        // update selection if changed
        if (next_idx != current_index) {
            radio_list.select_beatmap(new_beatmap, next_idx);
        }

        // create audio
        const audio = await get_local_audio(new_beatmap.audio_path);

        if (!audio) {
            console.log("radio: failed to create audio for next song");
            is_changing_selection = false;
            return null;
        }

        is_changing_selection = false;

        return { audio, id: new_beatmap.md5 };
    };

    // initialize next callback
    audio_manager.set_next_callback(get_next_song);

    // restore volume from config
    const saved_volume = config.get("radio_volume");

    if (saved_volume != undefined) {
        audio_manager.set_volume(saved_volume);
    }

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
        const new_state = audio_manager.toggle_random();
        console.log();
        console.log("radio: random toggled:", new_state);
    };

    const toggle_repeat = () => {
        const new_state = audio_manager.toggle_repeat();
        console.log($random_active, $repeat_active);
        console.log("radio: repeat toggled:", new_state);
    };
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
            <div role="button" tabindex={0} class="progress-bar" onclick={handle_seek}>
                <div class="progress-fill" style="width: {audio_state.progress_bar_width}%;"></div>
            </div>

            <div class="time-display">
                <span>{audio_state.progress}</span>
                <span>{audio_state.duration}</span>
            </div>
        </div>

        <!-- controls section -->
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
