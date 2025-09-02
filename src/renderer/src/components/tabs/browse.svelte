<script>
    import { onDestroy, onMount } from "svelte";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { ALL_BEATMAPS_KEY, ALL_STATUS_KEY, DEFAULT_SORT_OPTIONS, DEFAULT_STATUS_TYPES } from "../../lib/store/other";

    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Beatmaps from "../beatmaps.svelte";
    import Dropdown from "../utils/basic/dropdown.svelte";
    import RangeSlider from "../utils/basic/range-slider.svelte";

    const FILTER_TYPES = [...DEFAULT_SORT_OPTIONS, "length"];
    const STATUS_TYPES = [ALL_STATUS_KEY, ...DEFAULT_STATUS_TYPES];

    const list = get_beatmap_list("browse");
    const { query, status, sort } = list;

    const update_beatmaps = async () => {
        const beatmaps = await list.get_beatmaps(ALL_BEATMAPS_KEY, { unique: false });

        // update list id
        list.update_list_id(ALL_BEATMAPS_KEY);

        if (beatmaps) {
            list.set_beatmaps(beatmaps.count, { name: ALL_BEATMAPS_KEY }, false);
        }
    };

    const update_sr = async (data) => {
        list.update_range(data);
        update_beatmaps();
    };

    $: if ($query != undefined || $status || $sort) {
        update_beatmaps();
    }

    onMount(() => {
        list.hide_remove.set(true);
    });

    onDestroy(() => {
        list.hide_remove.set(false);
    });
</script>

<div class="content tab-content">
    <div class="manager-content">
        <div class="content-header">
            <Search placeholder="search local beatmaps" value={$query} callback={(q) => list.update_query(q)} />
            <ExpandableMenu>
                <Dropdown placeholder={"sort by"} bind:selected_value={$sort} options={FILTER_TYPES} />
                <Dropdown placeholder={"status"} bind:selected_value={$status} options={STATUS_TYPES} />
                <RangeSlider on_update={update_sr} />
            </ExpandableMenu>
        </div>
        <Beatmaps tab_id={"browse"} show_context={true} show_remove={false} set={false} columns={2} direction={"right"} />
    </div>
</div>
