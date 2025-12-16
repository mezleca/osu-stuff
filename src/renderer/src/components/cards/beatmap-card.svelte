<script lang="ts">
    import { onMount } from "svelte";
    import type { IBeatmapResult } from "@shared/types";
    import { get_beatmap } from "../../lib/utils/beatmaps";
    import { get_card_image_source } from "../../lib/utils/card-utils";
    import { open_on_browser } from "../../lib/utils/utils";
    import { show_context_menu } from "../../lib/store/context-menu";

    import { get_beatmap_context_options, handle_card_context_action } from "../../lib/utils/card-context-menu";

    // components
    import BeatmapControls from "./beatmap-controls.svelte";

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
        on_click: (event: MouseEvent) => void = null,
        on_remove: (checksum: string) => void = null;

    let image_element: HTMLImageElement = null;
    let image_src: string = "";
    let beatmap_loaded = false;
    let image_loaded = false;
    let visible = false;
    let visible_timeout: NodeJS.Timeout | null = null;

    // track loading state to prevent infinite loops
    let loading_hash: string | null = null;
    let failed_hashes = new Set<string>();

    $: has_map = beatmap && beatmap?.temp == false;

    const load_beatmap = async () => {
        beatmap_loaded = false;

        try {
            const result = await get_beatmap(loading_hash);

            if (result === undefined) {
                failed_hashes.add(loading_hash);
                beatmap = null;
            } else {
                beatmap = result;
                if (!minimal) get_card_image_source(beatmap).then((img) => (image_src = img));
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
            if (!minimal) get_card_image_source(beatmap).then((img) => (image_src = img));
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
    <span
        role="button"
        tabindex="0"
        onclick={(e) => {
            e.stopPropagation();
            open_on_browser(beatmap?.beatmapset_id);
        }}
        oncontextmenu={handle_context}
        class="star-rating"
    >
        ★ {get_beatmap_star_rating(beatmap)}</span
    >
    <p>{beatmap?.difficulty ?? "unknown"}</p>
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
        class:temp={beatmap?.temp}
        class:loaded={image_loaded}
        onclick={(event) => handle_click(event)}
        oncontextmenu={handle_context}
    >
        <!-- render background image -->
        <!-- svelte-ignore a11y_img_redundant_alt -->
        <img src={image_src} class="beatmap-card-background" class:loaded={image_loaded} alt="background image" bind:this={image_element} />

        <!-- render controls -->
        {#if show_control}
            <BeatmapControls beatmapset_id={beatmap?.beatmapset_id ?? -1} {hash} {has_map} {show_remove} {on_remove} />
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
    .beatmap-card.temp {
        border: 2px solid red;
    }
</style>
