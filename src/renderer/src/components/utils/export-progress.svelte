<script>
    import { fade } from "svelte/transition";
    import { export_progress, hide_export_progress } from "../../lib/store/export_progress";
    // import { fade } from "svelte/transition";

    let timer = null;

    $: state = $export_progress;

    // auto-hide if no updates for 5s
    $: if (state.active) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            hide_export_progress();
        }, 5000);
    }
</script>

{#if state.active}
    <div class="export-progress" transition:fade>
        <div class="export-text">{state.text ?? "..."}</div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: {state.progress}%"></div>
        </div>
    </div>
{/if}

<style>
    .export-progress {
        position: fixed;
        left: 16px;
        bottom: 16px;
        background: rgba(22, 22, 22, 0.95);
        border: 1px solid rgb(34, 34, 34);
        color: #fff;
        padding: 12px 16px;
        border-radius: 6px;
        display: flex;
        min-width: 200px;
        flex-direction: column;
        gap: 16px;
        z-index: 99999;
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.6);
    }

    .export-text {
        font-size: 0.85em;
        color: #ccc;
    }

    .progress-bar {
        display: inline-block;
        width: 100%;
        background: var(--tab-bg-color);
    }

    .progress-fill {
        padding: 2px;
        background-color: var(--accent-color);
        transition: width 0.15s;
    }
</style>
