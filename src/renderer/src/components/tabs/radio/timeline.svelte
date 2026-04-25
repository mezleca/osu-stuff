<script lang="ts">
    import { config } from "../../../lib/store/config";
    import { get_audio_manager } from "../../../lib/store/audio";
    import { debounce } from "../../../lib/utils/timings";
    import { clamp } from "../../../lib/utils/utils";

    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";
    import RandomIcon from "../../icon/random-icon.svelte";
    import RepeatIcon from "../../icon/repeat-icon.svelte";
    import NextIcon from "../../icon/next-icon.svelte";
    import PreviousIcon from "../../icon/previous-icon.svelte";
    import Speaker from "../../icon/speaker.svelte";
    import SpeakerMuted from "../../icon/speaker-muted.svelte";
    import SpeakerLow from "../../icon/speaker-low.svelte";
    import Spinner from "../../icon/spinner.svelte";

    import ControlBar from "../../utils/basic/control-bar.svelte";

    const audio_manager = get_audio_manager("radio");
    const random_store = audio_manager.random;
    const repeat_store = audio_manager.repeat;
    let audio_state = $audio_manager;
    let volume_open = false;

    $: audio_state = $audio_manager;

    const close_volume = debounce(() => {
        volume_open = false;
    }, 120);

    const handle_play_pause = async () => {
        if (!audio_state.id || !audio_state.audio) {
            console.log("radio: no current beatmap selected");
            return;
        }

        if (audio_state.playing) {
            audio_manager.pause();
            return;
        }

        await audio_manager.play();
    };

    const set_volume = (next_percent: number) => {
        const clamped_volume = clamp(next_percent * 100, 0, 100);
        audio_manager.set_volume(clamped_volume);
        config.set("radio_volume", clamped_volume);
    };

    const open_volume = () => {
        close_volume.cancel();
        volume_open = true;
    };

    const schedule_close_volume = () => {
        close_volume();
    };
</script>

<div class="radio-timeline">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="volume-anchor" onmouseenter={open_volume} onmouseleave={schedule_close_volume}>
        <div class="volume-popover" class:open={volume_open} onmouseenter={open_volume} onmouseleave={schedule_close_volume}>
            <div class="volume-track">
                <ControlBar orientation="vertical" value_percent={audio_state.volume} on_change={set_volume} />
            </div>
        </div>

        <button class="icon-btn volume-btn" onclick={() => audio_manager.toggle_mute()}>
            {#if audio_state.volume == 0}
                <SpeakerMuted />
            {:else if audio_state.volume < 50}
                <SpeakerLow />
            {:else}
                <Speaker />
            {/if}
        </button>
    </div>

    <div class="progress-section">
        <div class="progress-bar">
            <ControlBar value_percent={audio_state.progress_bar_width} on_change={(percent) => audio_manager.seek(percent)} />
        </div>

        <div class="time-display">
            <span>{audio_state.progress}</span>
            <span>{audio_state.duration}</span>
        </div>
    </div>

    <div class="controls-row">
        <div class="transport-controls">
            <button class="icon-btn" class:active={$random_store} onclick={audio_manager.toggle_random}>
                <RandomIcon />
            </button>

            <button class="icon-btn" onclick={() => audio_manager.navigate(-1)}>
                <PreviousIcon />
            </button>

            <button class="icon-btn play-btn" onclick={handle_play_pause} disabled={audio_state.is_loading}>
                {#if audio_state.is_loading}
                    <Spinner width={24} height={24} />
                {:else if audio_state.playing}
                    <Pause />
                {:else}
                    <Play />
                {/if}
            </button>

            <button class="icon-btn" onclick={() => audio_manager.navigate(1)}>
                <NextIcon />
            </button>

            <button class="icon-btn" class:active={$repeat_store} onclick={audio_manager.toggle_repeat}>
                <RepeatIcon />
            </button>
        </div>
    </div>
</div>

<style>
    .radio-timeline {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 24px 28px 22px;
        border-radius: 0;
        background: rgba(14, 14, 14, 0.92);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    .volume-anchor {
        position: absolute;
        top: 0;
        right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        transform: translateY(calc(-100% - 8px));
    }

    .progress-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .progress-bar {
        width: 100%;
        height: 6px;
    }

    .time-display {
        display: flex;
        justify-content: space-between;
        color: rgba(255, 255, 255, 0.6);
        font-size: 12px;
    }

    .controls-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
    }

    .transport-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .volume-popover {
        position: absolute;
        left: 50%;
        bottom: calc(100% + 4px);
        width: 36px;
        height: 96px;
        padding: 10px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        background: rgba(12, 12, 12, 0.96);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, 4px);
        transition:
            opacity 0.15s ease,
            transform 0.15s ease;
    }

    .volume-popover.open {
        opacity: 1;
        pointer-events: auto;
        transform: translate(-50%, 0);
    }

    .volume-track {
        width: 6px;
        height: 100%;
    }

    .icon-btn {
        padding: 8px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: rgba(255, 255, 255, 0.72);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition:
            color 0.15s ease,
            background-color 0.15s ease,
            transform 0.15s ease;
    }

    .icon-btn:hover {
        color: white;
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-1px);
    }

    .icon-btn.active {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-color);
    }

    .play-btn {
        width: 42px;
        height: 42px;
        padding: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
    }

    .play-btn:hover {
        background: rgba(255, 255, 255, 0.16);
    }

    .volume-btn {
        width: 40px;
        height: 40px;
        padding: 8px;
        color: var(--text-muted);
        background: rgba(12, 12, 12, 0.92);
        border-radius: 999px;
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
    }
</style>
