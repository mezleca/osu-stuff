<script>
    import { onDestroy, onMount } from "svelte";
    import { get_beatmap_list } from "../../lib/store/beatmaps";
    import { ALL_BEATMAPS_KEY } from "../../lib/store/other";

    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Beatmaps from "../beatmaps.svelte";

    const list = get_beatmap_list("browse");
    const { query, status, sort } = list;

    const update_beatmaps = async () => {
        const beatmaps = await list.get_beatmaps(ALL_BEATMAPS_KEY, { unique: false });
        if (beatmaps) list.set_beatmaps(beatmaps, { name: ALL_BEATMAPS_KEY }, false);
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
            <ExpandableMenu></ExpandableMenu>
        </div>
        <Beatmaps tab_id={"browse"} show_context={true} show_remove={false} set={false} columns={2} direction={"right"} />
    </div>
</div>
