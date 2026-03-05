<script lang="ts">
    import { get_audio_manager, toggle_beatmap_preview } from "../../lib/store/audio";
    import { downloader } from "../../lib/store/downloader";
    import { update_beatmap_lists } from "../../lib/store/beatmaps";
    import { beatmap_cache, beatmapset_cache } from "../../lib/utils/beatmaps";
    import { string_is_valid } from "../../lib/utils/utils";
    import { edit_notification, notification_exists, show_notification } from "../../lib/store/notifications";

    // components
    import Play from "../icon/play.svelte";
    import Pause from "../icon/pause.svelte";
    import Cross from "../icon/cross.svelte";
    import X from "../icon/x.svelte";
    import Spinner from "../icon/spinner.svelte";

    const audio_manager = get_audio_manager("preview");

    // check if the current beatmap is playing
    $: is_playing = $audio_manager.playing && $audio_manager.id == String(beatmapset_id);

    export let beatmapset_id: number = -1;
    export let hash: string = "";
    export let has_map = false;
    export let show_remove = true;
    export let on_remove: (checksum: string) => void = null;
    export let on_download: (checksum: string) => void = null;

    const DOWNLOAD_FAILED_ID = "beatmap-controls:download-failed";

    const { active_singles } = downloader;

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

        if (!string_is_valid(hash)) {
            console.warn("cant download beatmap (invalid hash)", hash);
            return;
        }

        // start download
        const result = await downloader.single_download({ beatmapset_id, md5: hash }, false);

        if (!result.success) {
            console.error("download failed for:", hash);
            if (notification_exists(DOWNLOAD_FAILED_ID)) {
                edit_notification(DOWNLOAD_FAILED_ID, { type: "error", text: "failed to download beatmap", duration: 3000 });
            } else {
                show_notification({ id: DOWNLOAD_FAILED_ID, type: "error", text: "failed to download beatmap", duration: 3000 });
            }
            return;
        }

        const downloaded_beatmap = result.data;
        const cached_beatmap = (await window.api.invoke("client:get_beatmap_by_md5", hash)) ?? downloaded_beatmap;
        let notification_title = downloaded_beatmap.title ?? hash;

        if (cached_beatmap) {
            beatmap_cache.set(hash, cached_beatmap);
            notification_title = cached_beatmap.title ?? hash;

            if (cached_beatmap.beatmapset_id) {
                const cached_beatmapset = await window.api.invoke("client:get_beatmapset", cached_beatmap.beatmapset_id);

                if (cached_beatmapset) {
                    beatmapset_cache.set(cached_beatmapset.online_id, cached_beatmapset);
                }
            }
        }

        if (on_download) {
            on_download(hash);
        }

        show_notification({ type: "success", text: `downloaded ${notification_title}` });

        // if we succesfully downloaded a new beatmap, update all lists
        update_beatmap_lists();
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
        {#if $active_singles.has(hash)}
            <button class="control-btn">
                <Spinner width={16} height={16} />
            </button>
        {:else}
            <button class="control-btn close-btn" onclick={handle_download}>
                <Cross />
            </button>
        {/if}
    {/if}
</div>
