<script lang="ts">
    import { onMount } from "svelte";
    import type { IBeatmapResult } from "@shared/types";
    import { get_beatmap } from "../../lib/utils/beatmaps";
    import { get_card_image_source } from "../../lib/utils/card-utils";
    import { open_on_browser } from "../../lib/utils/utils";
    import { show_context_menu } from "../../lib/store/context-menu";
    import { get_audio_manager, toggle_beatmap_preview } from "../../lib/store/audio";
    import { get_beatmap_context_options, handle_card_context_action } from "../../lib/utils/card-context-menu";

    // components
    import Play from "../icon/play.svelte";
    import Pause from "../icon/pause.svelte";
    import Cross from "../icon/cross.svelte";
    import X from "../icon/x.svelte";

    const audio_manager = get_audio_manager("preview");

    $: is_playing = $audio_manager.playing && $audio_manager.id == String(beatmap?.beatmapset_id);

    export let selected = false,
        highlighted = false,
        beatmap: IBeatmapResult | null = null,
        hash: string = "",
        show_bpm = true,
        show_star_rating = true,
        show_status = true,
        show_remove = true,
        show_context = true,
        show_control = true,
        centered = false,
        minimal = false,
        height = 100,
        on_click: (event: MouseEvent) => {} = null,
        on_add: (checksum: string) => {} = null,
        on_remove: (checksum: string) => {} = null;

    let image_element: HTMLImageElement = null;
    let image_src: string = "";
    let beatmap_loaded = false;
    let image_loaded = false;
    let visible = false;
    let visible_timeout: NodeJS.Timeout | null = null;

    // track loading state to prevent infinite loops
    let loading_hash: string | null = null;
    let failed_hashes = new Set<string>();

    const load_beatmap = async () => {
        beatmap_loaded = false;

        try {
            const result = await get_beatmap(loading_hash);

            if (result === undefined) {
                failed_hashes.add(loading_hash);
                beatmap = null;
            } else {
                beatmap = result;
                image_src = get_card_image_source(beatmap);
            }
        } catch (err) {
            console.error("failed to load beatmap:", loading_hash, err);
            failed_hashes.add(loading_hash);
            beatmap = null;
        } finally {
            beatmap_loaded = true;
        }
    };

    const handle_click = (event: MouseEvent) => {
        event.stopPropagation();
        if (beatmap && on_click) on_click(event);
    };

    const handle_context = async (event: MouseEvent) => {
        event.stopPropagation();

        if (!show_context) return;

        const options = get_beatmap_context_options(beatmap, show_remove);

        show_context_menu(event, options, (item) => {
            const item_split = item.id.split("-");
            handle_card_context_action(item_split[0], item_split[1], beatmap, on_remove);
        });
    };

    $: {
        if (image_element) {
            // add opacity transition after image fully loads
            image_element.onload = () => (image_loaded = true);
        }

        // only load if hash changed and we havent tried this hash before
        if (visible && hash && hash != loading_hash && !failed_hashes.has(hash)) {
            loading_hash = hash;
            load_beatmap();
        } else if (beatmap && !visible) {
            // if beatmap already loaded but not visible, just set image
            beatmap_loaded = true;
            image_src = get_card_image_source(beatmap);
        }
    }

    onMount(() => {
        visible_timeout = setTimeout(() => {
            visible = true;
        }, 25);

        return () => {
            if (visible_timeout) clearTimeout(visible_timeout);
        };
    });

    const get_beatmap_star_rating = (beatmap: IBeatmapResult): string => {
        if (beatmap?.star_rating) {
            return beatmap.star_rating.toFixed(2);
        }

        return "0.0";
    };
</script>

{#if minimal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="minimal-card"
        role="button"
        tabindex="0"
        onclick={(e) => {
            e.stopPropagation();
            open_on_browser(beatmap?.beatmapset_id);
        }}
        oncontextmenu={handle_context}
    >
        <span class="star-rating">★ {get_beatmap_star_rating(beatmap)}</span>
        <p>{beatmap?.difficulty ?? "unknown"}</p>
    </div>
{:else if !visible || !beatmap_loaded}
    <div style="height: {height}px; width: 100%; background: rgba(17, 20, 31, 0.65);"></div>
{:else}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="beatmap-card"
        style="height: {height}px;"
        class:selected
        class:highlighted
        class:loaded={image_loaded}
        onclick={(event) => handle_click(event)}
        oncontextmenu={handle_context}
    >
        <!-- render background image -->
        <!-- svelte-ignore a11y_img_redundant_alt -->
        <img src={image_src} class="beatmap-card-background" class:loaded={image_loaded} alt="background image" bind:this={image_element} />

        <!-- render controls -->
        {#if show_control}
            <div class="card-control">
                <!-- show preview control if beatmap is available -->
                {#if beatmap}
                    <button
                        class="control-btn play-btn"
                        onclick={(e) => {
                            e.stopPropagation();
                            toggle_beatmap_preview(beatmap.beatmapset_id);
                        }}
                    >
                        {#if is_playing}
                            <Pause />
                        {:else}
                            <Play />
                        {/if}
                    </button>
                {/if}

                <!-- show other controls (add / remove)-->
                {#if !beatmap || !beatmap?.local}
                    <button
                        class="control-btn close-btn"
                        onclick={(e) => {
                            e.stopPropagation();
                            on_add(hash);
                        }}
                    >
                        <Cross />
                    </button>
                {:else}
                    <button
                        class="control-btn close-btn"
                        onclick={(e) => {
                            e.stopPropagation();
                            on_remove(hash);
                        }}
                    >
                        <X />
                    </button>
                {/if}
            </div>
        {/if}

        <!-- render set information -->
        <div class="beatmap-card-metadata" class:centered>
            <div class="title">{beatmap?.title ?? "unknown"}</div>
            <div class="artist">by {beatmap?.artist ?? "unknown"}</div>
            <div class="creator">mapped by {beatmap?.creator ?? "unknown"}</div>
            {#if show_status}
                <div class="beatmap-card-extra">
                    <span class="status">{beatmap?.status ?? "unknown"}</span>
                    {#if show_bpm}
                        <span class="bpm">{Math.round(beatmap?.bpm) ?? "0"} bpm</span>
                    {/if}
                    {#if show_star_rating}
                        <span class="star-rating">★ {get_beatmap_star_rating(beatmap)}</span>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .minimal-card:hover {
        background: rgba(255, 255, 255, 0.1);
        cursor: pointer;
    }
</style>
