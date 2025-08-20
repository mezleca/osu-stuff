<script>
    import { export_progress, hide_export_progress } from "../../lib/store/export_progress";
    import { fade } from "svelte/transition";

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
        <div class="left">
            <div class="title">exporting</div>
            <div class="meta">{state.collection ?? "-"} {state.id ? `• ${state.id}` : ""}</div>
        </div>
        <div class="right">
            {#if state.status == "done"}
                <div class="status">saved: {state.path ? state.path.split("/").pop() : "unknown"}</div>
            {:else if state.status == "linked"}
                <div class="status">existing: {state.beatmapset_id}</div>
            {:else if state.status == "missing"}
                <div class="status">missing</div>
            {:else if state.status == "start"}
                <div class="status">starting ({state.total ?? "-"})</div>
            {:else}
                <div class="status">{state.status}</div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .export-progress {
        position: fixed;
        left: 16px;
        bottom: 16px;
        background: rgba(20, 20, 20, 0.95);
        color: #fff;
        padding: 10px 14px;
        border-radius: 6px;
        display: flex;
        gap: 12px;
        align-items: center;
        z-index: 2000;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
    }

    .left .title {
        font-weight: 600;
    }

    .left .meta {
        font-size: 0.9em;
        color: #ccc;
    }

    .right .status {
        font-size: 0.9em;
        color: var(--accent-color);
    }
</style>
