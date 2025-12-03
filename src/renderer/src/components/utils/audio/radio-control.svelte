<script lang="ts">
    import { onMount } from "svelte";
    import { get_audio_manager } from "../../../lib/store/audio";
    import { get_beatmap_list } from "../../../lib/store/beatmaps";
    import { config } from "../../../lib/store/config";

    // icons
    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";
    import RandomIcon from "../../icon/random-icon.svelte";
    import RepeatIcon from "../../icon/repeat-icon.svelte";
    import NextIcon from "../../icon/next-icon.svelte";
    import PreviousIcon from "../../icon/previous-icon.svelte";
    import Volume from "../../icon/volume.svelte";
    import VolumeMuted from "../../icon/volume-muted.svelte";
    import Spinner from "../../icon/spinner.svelte";

    // components
    import ControlBar from "../basic/control-bar.svelte";

    const audio_manager = get_audio_manager("radio");
    const radio_list = get_beatmap_list("radio");

    const { selected } = radio_list;

    const get_current_id = () => $selected?.md5;

    $: audio_state = $audio_manager;
    $: is_playing = audio_state.playing && audio_state.id == get_current_id();
    $: is_loading = audio_state.is_loading;
    $: random_active = audio_manager.random;
    $: repeat_active = audio_manager.repeat;
    $: should_force_random = audio_manager.force_random;

    $: if ($should_force_random) {
        if (audio_state.audio && audio_state.audio.currentTime > 0.1) {
            if (is_playing) audio_manager.pause();
            audio_manager.navigate(0).then(() => audio_manager.force_random.set(false));
        } else {
            audio_manager.force_random.set(false);
        }
    }

    const handle_play_pause = async () => {
        if (!get_current_id()) {
            console.log("radio: no current beatmap selected");
            return;
        }

        const state = audio_state;

        if (state.id == get_current_id() && state.audio) {
            if (state.playing) {
                audio_manager.pause();
            } else {
                await audio_manager.play();
            }
        }
    };

    const set_volume = (v) => {
        const clamped_volume = Math.max(0, Math.min(100, v));
        audio_manager.set_volume(clamped_volume);
        config.set("radio_volume", clamped_volume);
    };

    onMount(() => {
        const saved_volume = config.get("radio_volume");

        if (saved_volume != null) {
            audio_manager.set_volume(saved_volume);
        }
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

        <ControlBar value={audio_state.volume} full={false} callback={(v) => set_volume(v * 100)} />
    </div>
    <div class="radio-control">
        <!-- progress section -->
        <div class="progress-section">
            <ControlBar value={audio_state.progress_bar_width} callback={(v) => audio_manager.seek(v)} />
            <div class="time-display">
                <span>{audio_state.progress}</span>
                <span>{audio_state.duration}</span>
            </div>
        </div>

        <div class="controls-section">
            <button class="radio-btn random" class:active={$random_active} onclick={audio_manager.toggle_random}>
                <RandomIcon />
            </button>

            <div class="main-controls">
                <button class="radio-btn previous" onclick={() => audio_manager.navigate(-1)}>
                    <PreviousIcon />
                </button>

                <button class="radio-btn play-pause" onclick={handle_play_pause} disabled={is_loading}>
                    {#if is_loading}
                        <Spinner width={24} height={24} />
                    {:else if is_playing}
                        <Pause />
                    {:else}
                        <Play />
                    {/if}
                </button>

                <button class="radio-btn next" onclick={() => audio_manager.navigate(1)}>
                    <NextIcon />
                </button>
            </div>

            <button class="radio-btn repeat" class:active={$repeat_active} onclick={audio_manager.toggle_repeat}>
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
        padding: 8px;
        gap: 8px;
        background-color: rgba(19, 19, 19, 0.8);
        border-radius: 6px;
        width: fit-content;
        margin-bottom: 10px;
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

    :global(.volume-container:hover .control-bar) {
        width: 120px;
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

    .radio-btn {
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

    .radio-btn:hover {
        transform: scale(1.05);
        color: white;
        background: rgba(255, 255, 255, 0.1);
    }

    .radio-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .radio-btn.active {
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
