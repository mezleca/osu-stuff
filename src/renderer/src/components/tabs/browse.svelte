<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { get_beatmapset_list, cached_beatmapsets } from "../../lib/store/beatmaps";
    import type { StarRatingFilter } from "@shared/types";
    import { FILTER_TYPES, STATUS_TYPES } from "../../lib/store/other";
    import { debounce } from "../../lib/utils/utils";

    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import RangeSlider from "../utils/basic/range-slider.svelte";
    import BeatmapsetList from "../beatmapset-list.svelte";

    const list = get_beatmapset_list("browse");
    const { query, status, sort } = list;

    const update_beatmaps = debounce(async () => {
        const result = await list.search();
        if (!result) return;

        const ids = result.beatmapsets.map((b) => b.id);

        const missing_ids = ids.filter((id) => !cached_beatmapsets.has(id));

        if (missing_ids.length > 0) {
            const beatmapsets = await window.api.invoke("driver:fetch_beatmapsets", missing_ids);
            for (const bs of beatmapsets) {
                cached_beatmapsets.set(bs.online_id, bs);
            }
        }

        list.set_items(ids, undefined, false);
    }, 20);

    const update_sr = async (data: StarRatingFilter) => {
        list.difficulty_range.set(data);
        update_beatmaps();
    };

    $: if ($query != undefined || $status || $sort) {
        update_beatmaps();
    }

    onMount(() => {
        list.show_remove.set(false);
    });

    onDestroy(() => {
        list.show_remove.set(true);
    });
</script>

<div class="content tab-content">
    <div class="manager-content">
        <div class="content-header">
            <Search placeholder="search local beatmaps" value={$query} callback={(q) => list.set_query(q)} />
            <ExpandableMenu>
                <Dropdown placeholder={"sort by"} bind:selected_value={$sort} options={FILTER_TYPES} />
                <Dropdown placeholder={"status"} bind:selected_value={$status} options={STATUS_TYPES} />
                <RangeSlider on_update={(data) => update_sr(data)} />
            </ExpandableMenu>
        </div>
        <BeatmapsetList list_manager={list} show_context={true} carousel={true} width={"100%"} />
    </div>
</div>
