<script lang="ts">
    import { active_tab, is_maximized } from "../lib/store/other";
    import { current_modal, ModalType } from "../lib/utils/modal";

    // icons
    import Line from "./icon/line.svelte";
    import Square from "./icon/square.svelte";
    import X from "./icon/x.svelte";

    // props
    export let active = false;

    const set_active_tab = (tab: string) => {
        if (!active || $current_modal != ModalType.none) return;
        $active_tab = tab;
    };

    const tabs = ["collections", "browse", "discover", "radio", "config", "status"];
</script>

<div class="header">
    <div class="header-left">
        <button class="app-title" onclick={() => set_active_tab("index")}>osu-stuff</button>
        <div class="tabs">
            {#each tabs as tab}
                <button
                    class="tab"
                    onclick={() => set_active_tab(tab)}
                    class:active={$active_tab == tab}
                    class:disabled={$current_modal != ModalType.none}
                >
                    {tab}
                </button>
            {/each}
        </div>
    </div>
    <div class="window-decorations">
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button class="window-btn minimize" onclick={() => window.api.invoke("window:minimize")}>
            <Line />
        </button>
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button
            class="window-btn maximize"
            onclick={() => ($is_maximized ? window.api.invoke("window:unmaximize") : window.api.invoke("window:maximize"))}
        >
            <Square />
        </button>
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button class="window-btn close" onclick={() => window.api.invoke("window:close")}>
            <X />
        </button>
    </div>
</div>

<style>
    .window-decorations {
        display: flex;
        height: 30px;
        margin-right: 25px;
        gap: 5px;
        -webkit-app-region: no-drag;
    }

    :global(.window-border) {
        visibility: hidden;
        pointer-events: none;
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: 99999;
        border: 1px solid rgb(120, 120, 120, 0.6);
        transition: all 0.1s ease;
    }

    :global(.window-border.show) {
        visibility: visible;
    }

    .window-btn {
        display: flex;
        border: none;
        border-radius: 4px;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.2s ease;
        background-color: var(--bg-secondary);
        color: var(--text-muted);
    }

    .window-btn:hover {
        color: var(--accent-color);
        background: none;
    }
</style>
