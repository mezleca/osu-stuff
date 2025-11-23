<script lang="ts">
    import { discover } from "../../lib/store/discover";

    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Tags from "../utils/basic/tags.svelte";
    import BeatmapSetList from "../beatmapset-list.svelte";

    const languages = discover.get_values("languages").map((name) => ({ label: name, value: name }));
    const categories = discover.get_values("categories").map((name) => ({ label: name, value: name }));
    const genres = discover.get_values("genres").map((name) => ({ label: name, value: name }));
    const modes = discover.get_values("modes").map((name) => ({ label: name, value: name }));

    $: query = discover.query;
    $: data = discover.data;

    $: language = $data.language;
    $: category = $data.category;
    $: genre = $data.genre;
    $: mode = $data.mode;
</script>

<div class="content tab-content">
    <div class="manager-content">
        <div class="content-header">
            <Search placeholder="search beatmaps" value={$query} callback={(q) => discover.update_query(q)} />
            <ExpandableMenu>
                <Tags
                    options={languages}
                    multiple={false}
                    selected_values={language ? [language] : []}
                    on_update={(value) => discover.update("language", value[0])}
                    placeholder={"languages"}
                />

                <Tags
                    options={categories}
                    multiple={false}
                    selected_values={category ? [category] : []}
                    on_update={(value) => discover.update("category", value[0])}
                    placeholder={"categories"}
                />

                <Tags
                    options={genres}
                    multiple={false}
                    selected_values={genre ? [genre] : []}
                    on_update={(value) => discover.update("genre", value[0])}
                    placeholder={"genres"}
                />

                <Tags
                    options={modes}
                    multiple={false}
                    selected_values={mode ? [mode] : []}
                    on_update={(value) => discover.update("mode", value[0])}
                    placeholder={"modes"}
                />
            </ExpandableMenu>
        </div>

        <!-- render beatmapset list -->
        <BeatmapSetList
            list_manager={discover}
            columns={2}
            on_update={(i) => {
                // update list on last index
                if (discover.can_load_more() && discover.get_list_length() - i <= 2) {
                    discover.search();
                }
            }}
        />
    </div>
</div>
