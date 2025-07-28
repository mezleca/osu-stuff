<script>
    import { discover } from "../../lib/store/discover";

    // components
    import Add from "../utils/add.svelte";
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Tags from "../utils/basic/tags.svelte";

    const languages = discover.get_values("languages"); // l
    const categories = discover.get_values("categories"); // s
    const genres = discover.get_values("genres"); // g
    const modes = discover.get_values("modes"); // m

    $: query = discover.query;
    $: data = discover.data;
    $: should_update = discover.should_update;

    $: if ($query != "" || $should_update) {
        discover.search();
    }
</script>

<div class="content tab-content">
    <div class="manager-content">
        <div class="content-header">
            <Search placeholder="search beatmaps" bind:value={$query} />

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
        <div class="beatmaps-container">
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <Add />
            <div class="manager-beatmaps-container"></div>
        </div>
    </div>
</div>
