<script>
    import Play from "../../icon/play.svelte";
    import Pause from "../../icon/pause.svelte";
    import X from "../../icon/x.svelte";
    import Cross from "../../icon/cross.svelte";

    import { get_audio_manager, get_audio_preview } from "../../../lib/store/audio";

    export let beatmap = null;
    export let on_right = null;

    const audio_manager = get_audio_manager("preview");
    const PREVIEW_BASE_URL = "https://b.ppy.sh/preview/";

    $: audio_state = $audio_manager;
    $: current_id = beatmap?.md5 ?? beatmap?.preview_url;
    $: is_playing = audio_state.playing && audio_state.id == current_id;

    const handle_play_pause = async () => {
        if (!current_id || (!beatmap?.beatmapset_id && !beatmap?.preview_url)) {
            console.log("preview: invalid beatmap data", beatmap);
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
        const url = beatmap?.preview_url ? `https:${beatmap.preview_url}` : `${PREVIEW_BASE_URL}${beatmap.beatmapset_id}.mp3`;
        const audio = await get_audio_preview(url);

        if (!audio) {
            console.log("preview: failed to create audio");
            return;
        }

        await audio_manager.setup_audio(current_id, audio);
        await audio_manager.play();
    };

    const handle_right = (event, type) => {
        event.stopPropagation();
        on_right(type);
    };

    const handle_play_click = (event) => {
        event.stopPropagation();
        handle_play_pause();
    };
</script>

<div class="preview-control">
    <button class="preview-btn play-btn" onclick={handle_play_click}>
        {#if is_playing}
            <Pause />
        {:else}
            <Play />
        {/if}
    </button>

    {#if on_right}
        <button class="preview-btn close-btn" onclick={(e) => handle_right(e, beatmap?.local ? "remove" : "add")}>
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
