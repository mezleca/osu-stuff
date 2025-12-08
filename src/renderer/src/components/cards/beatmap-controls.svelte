<script lang="ts">
    import { get_audio_manager, toggle_beatmap_preview } from "../../lib/store/audio";
    import { downloader } from "../../lib/store/downloader";
    import type { IBeatmapResult } from "@shared/types";

    // components
    import Play from "../icon/play.svelte";
    import Pause from "../icon/pause.svelte";
    import Cross from "../icon/cross.svelte";
    import X from "../icon/x.svelte";

    const audio_manager = get_audio_manager("preview");

    // check if the current beatmap is playing
    $: is_playing = $audio_manager.playing && $audio_manager.id == String(beatmapset_id);

    export let beatmapset_id: number = null;
    export let beatmap: IBeatmapResult = null;
    export let hash: string = "";
    export let has_map = false;
    export let show_remove = true;
    export let on_remove: (checksum: string) => void = null;

    const handle_preview = (e: MouseEvent) => {
        e.stopPropagation();

        if (!beatmapset_id) {
            console.warn("no beatmapset_id provided for preview");
            return;
        }

        toggle_beatmap_preview(beatmapset_id);
    };

    const handle_download = async (e: MouseEvent) => {
        e.stopPropagation();

        if (!beatmap) {
            console.warn("no beatmap provided for download");
            return;
        }

        // start download
        const result = await downloader.single_download(beatmap);

        if (!result) {
            console.error("download failed for:", beatmap.md5);
            return;
        }

        console.log("download started for:", beatmap.md5);
    };

    const handle_remove = (e: MouseEvent) => {
        e.stopPropagation();

        if (!hash) {
            console.warn("no hash provided for removal");
            return;
        }

        if (on_remove) {
            on_remove(hash);
        }
    };
</script>

<div class="card-control">
    <!-- preview button (left) -->
    <button class="control-btn play-btn" onclick={handle_preview}>
        {#if is_playing}
            <Pause />
        {:else}
            <Play />
        {/if}
    </button>

    <!-- action button (right) -->
    {#if has_map && show_remove}
        <!-- user has the map and we allow remove action -->
        <button class="control-btn close-btn" onclick={handle_remove}>
            <X />
        </button>
    {:else if !has_map}
        <!-- user doesn't have the map, show download -->
        <button class="control-btn close-btn" onclick={handle_download}>
            <Cross />
        </button>
    {/if}
</div>
