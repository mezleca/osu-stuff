<script>
    // props
    export let name,
        count,
        selected,
        edit,
        select_callback = () => {},
        rename_callback = () => {};

    // components
    import Text from "../utils/basic/text.svelte";

    // icons
    import Music from "../icon/music.svelte";
</script>

<button class="collection-item" onclick={select_callback} class:active={selected} class:editing={edit}>
    <div class="collection-info">
        <Music />
        <Text value={name} {edit} update_callback={rename_callback} />
    </div>
    <span class="collection-count">{count} {count == 1 ? "map" : "maps"}</span>
</button>

<style>
    .collection-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px;
        margin-bottom: 4px;
        background: transparent;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid transparent;
        width: 100%;
        overflow: hidden;
    }

    .collection-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
        transform: translateX(2px);
    }

    .collection-item.active {
        background: rgba(255, 64, 129, 0.15);
        border-color: var(--accent-color-half);
        transform: translateX(4px);
    }

    .collection-item.editing {
        border-color: rgb(243, 213, 81);
    }

    .collection-info {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;
    }

    :global(.music-icon) {
        width: 14px;
        height: 14px;
        color: var(--accent-color2);
        transition: color 0.2s ease;
    }

    .collection-count {
        color: #666;
        font-size: 12px;
        white-space: nowrap;
        margin-left: 5px;
    }
</style>
