<script>
    $: active = false;
</script>

<div class="expand-container">
    <div class="search-expand">
        <button class="expand-btn" class:active onclick={() => (active = !active)}>⋯</button>
    </div>
    <div class="expanded-menu" class:active>
        <slot />
    </div>
</div>

<style>
    .expand-btn:hover {
        background: #353535;
        color: #fff;
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }

    .expand-btn.active {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
    }

    .search-expand {
        position: absolute;
        bottom: -18px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
    }

    .expand-btn {
        background: var(--header-bg-color);
        border: 2px solid var(--header-border-color);
        border-radius: 50%;
        color: var(--text-secondary);
        cursor: pointer;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .expanded-menu {
        display: flex;
        height: fit-content;
        max-height: 0px;
        transition: all 0.1s;
        overflow: hidden;
        align-items: center;
        gap: 10px;
        width: 100%;
        flex-wrap: wrap;
    }

    .expanded-menu.active {
        max-height: 300px;
        padding: 10px;
        padding-left: 0;
        overflow: visible;
    }
</style>
