<script lang="ts">
    import { config } from "../../../lib/store/config";
    import { get_audio_manager } from "../../../lib/store/audio";
    import { clamp } from "../../../lib/utils/utils";
    import { get_card_image_source } from "../../../lib/utils/card-utils";

    import type { IBeatmapResult } from "@shared/types";

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

    export let beatmap: IBeatmapResult | null = null;
    export let on_selected_click: () => void = null;

    const audio_manager = get_audio_manager("radio");
    const random_store = audio_manager.random;
    const repeat_store = audio_manager.repeat;

    let audio_state = $audio_manager;
    let volume_open = false;

    $: audio_state = $audio_manager;
    $: cover_image = beatmap ? get_card_image_source(beatmap, true) : "";

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
</script>

<div class="radio-timeline">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="selected-section" onclick={on_selected_click}>
        {#if beatmap}
            <img class="cover" src={cover_image} alt="" />
            <div class="metadata">
                <span class="title">{beatmap.title}</span>
                <span class="artist">{beatmap.artist}</span>
            </div>
        {/if}
    </div>

    <div class="timeline-section">
        <div class="controls">
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

        <div class="progress">
            <span>{audio_state.progress}</span>
            <div class="progress-bar">
                <ControlBar value_percent={audio_state.progress_bar_width} on_change={(percent) => audio_manager.seek(percent)} />
            </div>
            <span>{audio_state.duration}</span>
        </div>
    </div>

    <div class="extra-section">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="volume-control" class:open={volume_open}>
            <button class="icon-btn volume-btn" onclick={() => audio_manager.toggle_mute()}>
                {#if audio_state.volume == 0}
                    <SpeakerMuted />
                {:else if audio_state.volume < 50}
                    <SpeakerLow />
                {:else}
                    <Speaker />
                {/if}
            </button>

            <ControlBar orientation="horizontal" value_percent={audio_state.volume} on_change={set_volume} />
        </div>
    </div>

    <div class="controls-row"></div>
</div>

<style>
    .radio-timeline {
        position: relative;
        display: grid;
        align-items: center;
        grid-template-columns: 25% 50% 25%;
        padding: 20px;
        border-radius: 0;
        background: rgba(14, 14, 14, 0.92);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    .selected-section {
        display: flex;
        gap: 10px;
        cursor: pointer;
    }

    .selected-section > .cover {
        width: 64px;
        height: 64px;
        border-radius: 6px;
    }

    .selected-section > .metadata {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
    }

    .metadata > .title {
        font-size: 13px;
        color: var(--text-color);
    }

    .metadata > .artist {
        font-size: 12px;
        color: var(--text-muted);
    }

    .metadata > .title,
    .metadata > .artist {
        font-family: "Torus SemiBold";
    }

    .timeline-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .timeline-section > .controls {
        align-self: center;
    }

    .timeline-section > .progress {
        display: flex;
        width: 75%;
        align-items: center;
        align-self: center;
        gap: 5px;
    }

    .progress > span {
        font-size: "Torus SemiBold";
        font-size: 11px;
    }

    .progress-bar {
        width: 100%;
        height: 6px;
    }

    .controls-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .extra-section {
        display: flex;
        justify-content: end;
        align-items: center;
    }

    .extra-section > .volume-control {
        display: flex;
        width: 128px;
        align-items: center;
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
        border-radius: 999px;
        box-shadow: none;
    }

    .volume-btn:hover {
        background: none;
        transform: none;
    }
</style>
