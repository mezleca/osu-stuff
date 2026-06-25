<script lang="ts">
    import { fromStore } from "svelte/store";
    import { core_state, set_active_tab } from "../lib/store/other.svelte";
    import { modals } from "../lib/utils/modal";

    // icons
    import Line from "./icon/line.svelte";
    import Square from "./icon/square.svelte";
    import X from "./icon/x.svelte";

    interface Props {
        active?: boolean;
    }

    const active_modals = fromStore(modals);
    let { active = false }: Props = $props();

    const handle_active_tab = (tab: string) => {
        // if we're inside a modal ignore all pointer events
        if (!active || active_modals.current.size != 0) {
            return;
        }

        set_active_tab(tab);
    };

    const tabs = ["collections", "discover", "radio", "config", "status"];
</script>

<div class="header">
    <div class="header-left">
        <button class="app-title" onclick={() => handle_active_tab("index")}>osu-stuff</button>
        <div class="tabs">
            {#each tabs as tab}
                <button
                    class="tab"
                    onclick={() => handle_active_tab(tab)}
                    class:active={core_state.window.active_tab == tab}
                    class:disabled={active_modals.current.size != 0}
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
            onclick={() => (core_state.window.maximized ? window.api.invoke("window:unmaximize") : window.api.invoke("window:maximize"))}
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
        margin-right: 20px;
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
        padding: 6px 12px;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        color: var(--text-color);
        background: none;
    }

    .window-btn:hover {
        background-color: var(--bg-secondary);
    }
</style>
