<script lang="ts">
    import { onMount } from "svelte";
    import { discover } from "../../lib/store/discover";
    import { core_state } from "../../lib/store/other.svelte";

    // components
    import ExpandableMenu from "../utils/expandable-menu.svelte";
    import Search from "../utils/basic/search.svelte";
    import Tags from "../utils/basic/tags.svelte";
    import BeatmapSetList from "../beatmapset-list.svelte";

    const languages = discover.get_values("languages").map((name) => ({ label: name, value: name }));
    const categories = discover.get_values("categories").map((name) => ({ label: name, value: name }));
    const genres = discover.get_values("genres").map((name) => ({ label: name, value: name }));
    const modes = discover.get_values("modes").map((name) => ({ label: name, value: name }));

    const authenticated = $derived(core_state.osu_web.authenticated);

    const data = discover.data;
    const language = $derived($data.language);
    const category = $derived($data.category);
    const genre = $derived($data.genre);
    const mode = $derived($data.mode);

    onMount(() => {
        const current_query = $data.query ?? "";
        if (current_query.trim() == "") discover.update_query("");
    });
</script>

<div class="content tab-content">
    {#if !authenticated}
        <div style="display: flex; width: 100%; height: 100%; align-items: center; justify-content: center;">
            <h1>not authenticated bro</h1>
        </div>
    {:else}
        <div class="manager-content">
            <div class="content-header">
                <Search placeholder="search beatmaps" value={$data.query ?? ""} callback={(q) => discover.update_query(q)} />

                <ExpandableMenu>
                    <Tags
                        options={languages}
                        multiple={false}
                        selected_values={language ? [language] : []}
                        on_update={(value) => discover.update("language", value)}
                        label={"languages"}
                    />

                    <Tags
                        options={categories}
                        multiple={false}
                        selected_values={category ? [category] : []}
                        on_update={(value) => discover.update("category", value)}
                        label={"categories"}
                    />

                    <Tags
                        options={genres}
                        multiple={false}
                        selected_values={genre ? [genre] : []}
                        on_update={(value) => discover.update("genre", value)}
                        label={"genres"}
                    />

                    <Tags
                        options={modes}
                        multiple={false}
                        selected_values={mode ? [mode] : []}
                        on_update={(value) => discover.update("mode", value ?? "osu")}
                        label={"modes"}
                    />
                </ExpandableMenu>
            </div>

            <!-- render beatmapset list -->
            <BeatmapSetList
                columns={2}
                carousel={false}
                extra={1}
                list_manager={discover}
                on_update={(i) => {
                    // update list on last index
                    if (discover.can_load_more() && discover.get_items().length - i <= 2) {
                        discover.search();
                    }
                }}
            />
        </div>
    {/if}
</div>
