<script>
    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";
    import X from "../../icon/x.svelte";
    import Cross from "../../icon/cross.svelte";

    import { get_audio_manager, get_audio_preview } from "../../../lib/store/audio";

    export let beatmap = null;
    export let on_remove = null;

    const audio_manager = get_audio_manager("preview");

    $: audio_state = $audio_manager;
    $: current_id = beatmap?.md5;
    $: is_playing = audio_state.playing && audio_state.id == current_id;
    $: is_loading = audio_state.is_loading && audio_state.id == current_id;

    const handle_play_pause = async () => {
        if (!current_id || !beatmap?.beatmapset_id) {
            console.log("preview: invalid beatmap data");
            return;
        }

        const state = audio_state;

        // toggle if same audio
        if (state.id == current_id && state.audio) {
            if (state.playing) {
                audio_manager.pause();
            } else {
                await audio_manager.play();
            }
            return;
        }

        // setup new audio
        console.log("preview: setting up new track:", current_id);

        const audio = await get_audio_preview(beatmap.beatmapset_id);

        if (!audio) {
            console.log("preview: failed to create audio");
            return;
        }

        await audio_manager.setup_audio(current_id, audio);
        await audio_manager.play();
    };

    const handle_remove = (event) => {
        event.stopPropagation();
        on_remove();
    };

    const handle_play_click = (event) => {
        event.stopPropagation();
        handle_play_pause();
    };
</script>

<div class="preview-control">
    <button class="preview-btn play-btn" onclick={handle_play_click} disabled={is_loading}>
        {#if is_loading}
            <div class="loading-spinner"></div>
        {:else if is_playing}
            <Pause />
        {:else}
            <Play />
        {/if}
    </button>

    {#if on_remove}
        <button class="preview-btn close-btn" onclick={handle_remove}>
            {#if beatmap?.local}
                <X />
            {:else}
                <Cross />
            {/if}
        </button>
    {/if}
</div>

<style>
    .preview-control {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 6px;
        opacity: 1;
        transition: all 0.3s ease;
    }

    .preview-btn {
        background: transparent;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 3;
        opacity: 0;
        padding: 6px;
    }

    .preview-btn:hover {
        transform: scale(1.05);
        background-color: var(--header-bg-color);
    }
</style>
