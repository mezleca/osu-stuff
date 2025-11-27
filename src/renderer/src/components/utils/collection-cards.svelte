<script lang="ts">
    import type { ICollectionWithEdit } from "../../lib/store/collections";

    // components
    import CollectionCard from "../cards/collection-card.svelte";

    export let collections: ICollectionWithEdit[] = [];
    export let selected: ICollectionWithEdit[] = [];

    const is_selected = (name: string): boolean => {
        return selected.some((c) => c.name == name);
    };

    const handle_click = (collection: ICollectionWithEdit) => {
        selected = is_selected(collection.name) ? selected.filter((c) => c.name != collection.name) : [...selected, collection];
    };
</script>

{#each collections as collection}
    <CollectionCard
        name={collection.name}
        selected={is_selected(collection.name)}
        count={collection.beatmaps.length}
        on_select={() => handle_click(collection)}
    />
{/each}
