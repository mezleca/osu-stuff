<script>
    import { discover } from "../../lib/store/discover";

    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Tags from "../utils/basic/tags.svelte";
    import Beatmaps from "../beatmaps.svelte";

    const languages = discover.get_values("languages"); // l
    const categories = discover.get_values("categories"); // s
    const genres = discover.get_values("genres"); // g
    const modes = discover.get_values("modes"); // m

    $: query = discover.query;
    $: data = discover.data;
</script>

<div class="content tab-content">
    <div class="manager-content">
        <div class="content-header">
            <Search placeholder="search beatmaps" value={$query} callback={(q) => discover.update_query(q)} />
            <ExpandableMenu>
                <Tags
                    options={languages}
                    multiple={false}
                    selected_values={$data.languages}
                    on_update={(value) => discover.update("languages", value)}
                    placeholder={"languages"}
                />

                <Tags
                    options={categories}
                    multiple={false}
                    selected_values={$data.categories}
                    on_update={(value) => discover.update("categories", value)}
                    placeholder={"categories"}
                />

                <Tags
                    options={genres}
                    multiple={false}
                    selected_values={$data.genres}
                    on_update={(value) => discover.update("genres", value)}
                    placeholder={"genres"}
                />

                <Tags
                    options={modes}
                    multiple={false}
                    selected_values={$data.modes}
                    on_update={(value) => discover.update("modes", value)}
                    placeholder={"modes"}
                />
            </ExpandableMenu>
        </div>

        <!-- render beatmap list -->
        <Beatmaps
            show_context={false}
            set={true}
            columns={2}
            list_manager={discover}
            on_update={(i) => {
                // update list on 10 items to the end
                if (discover.can_load_more() && discover.get_list_length() - i <= 10) {
                    console.log(`[discover] loading more at item ${i}/${discover.get_list_length()}`);
                    discover.search();
                } else {
                    console.log("discover.can_load_more() -> false:", discover.can_load_more(), discover.get_list_length() - i <= 10);
                }
            }}
        />
    </div>
</div>
