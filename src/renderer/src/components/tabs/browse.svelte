<script lang="ts">
    import { onMount } from "svelte";
    import { get_beatmapset_list } from "../../lib/store/beatmaps";
    import { FILTER_DATA, MODES_DATA, SEARCH_DEBOUNCE_INTERVAL, STATUS_DATA } from "../../lib/store/other";
    import { debounce } from "@shared/timing";

    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import RangeSlider from "../utils/basic/range-slider.svelte";
    import BeatmapsetList from "../beatmapset-list.svelte";

    const list = get_beatmapset_list("browse");
    const { query, status, mode, sort, difficulty_range, should_update } = list;

    const debounced_update = debounce(async (force: boolean = true) => {
        const result = await list.search(force);
        if (!result) return;

        const ids = result.beatmapsets.map((b) => b.online_id);

        list.set_items(ids);
    }, SEARCH_DEBOUNCE_INTERVAL);

    $: if ($query != undefined || $status || $sort || $difficulty_range || $mode || $should_update) {
        debounced_update($should_update);
    }

    onMount(() => {
        return () => {
            debounced_update.cancel();
        };
    });
</script>

<div class="content tab-content">
    <div class="manager-content">
        <div class="content-header">
            <Search placeholder="search local beatmaps" value={$query} callback={(q) => list.set_query(q)} />
            <ExpandableMenu>
                <Dropdown label={"sort by"} bind:selected_value={$sort} options={FILTER_DATA} />
                <Dropdown label={"status"} bind:selected_value={$status} options={STATUS_DATA} />
                <Dropdown label={"mode"} bind:selected_value={$mode} options={MODES_DATA} />
                <RangeSlider min={0} max={10} bind:value={$difficulty_range} />
            </ExpandableMenu>
        </div>
        <BeatmapsetList list_manager={list} show_context={true} carousel={true} width={"100%"} />
    </div>
</div>
