<script>
    export let item;
    export let depth;
    export let active_path;
    export let onclick;
    export let on_submenu_enter;
    export let on_submenu_leave;

    $: has_submenu = item?.data && Array.isArray(item.data);
    $: is_item_active = active_path[depth] && active_path[depth].id == item.id;

    const handle_click = (e) => {
        e.stopPropagation();
        if (!item.data) {
            onclick(item, e);
        }
    };

    const handle_mouse_enter = () => {
        if (has_submenu) {
            on_submenu_enter(item, depth);
        } else {
            on_submenu_leave(depth);
        }
    };

    const handle_mouse_leave = () => {
        if (has_submenu) {
            on_submenu_leave(depth);
        }
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu-item-container">
    <div class="menu-item" class:has-submenu={has_submenu} onmouseenter={handle_mouse_enter} onmouseleave={handle_mouse_leave} onclick={handle_click}>
        <span>{item?.text}</span>
        {#if has_submenu}
            <span class="arrow">▶</span>
        {/if}
    </div>

    {#if has_submenu && is_item_active}
        <div class="submenu">
            {#each item.data as sub_item}
                <svelte:self item={sub_item} depth={depth + 1} {active_path} {onclick} {on_submenu_enter} {on_submenu_leave} />
            {/each}
        </div>
    {/if}
</div>

<style>
    .menu-item-container {
        position: relative;
    }

    .menu-item {
        padding: 8px 12px;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .menu-item:hover {
        background-color: var(--bg-secondary);
    }

    .menu-item.has-submenu {
        padding-right: 24px;
    }

    .arrow {
        position: absolute;
        right: 8px;
        font-size: 8px;
        color: #666;
    }

    .submenu {
        position: absolute;
        left: calc(100% + 2px);
        top: -4px;
        background: var(--bg-primary);
        border: 1px solid #2e2e2e;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-radius: 6px;
        padding: 4px 0;
        min-width: 150px;
        z-index: 99999;
    }
</style>
