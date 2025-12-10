<script>
    import { fade } from "svelte/transition";
    import { progress_boxes, hide_progress_box } from "../../lib/store/progress_box";

    // auto-hide boxes that have auto_hide enabled after 5s of inactivity
    let timers = new Map();

    $: {
        for (const box of $progress_boxes) {
            if (box.auto_hide && !timers.has(box.id)) {
                const timer = setTimeout(() => {
                    hide_progress_box(box.id);
                    timers.delete(box.id);
                }, 5000);
                timers.set(box.id, timer);
            }
        }
    }
</script>

<div class="progress-container">
    {#each $progress_boxes as box, index}
        <div class="progress-box" style="bottom: {16 + index * 80}px" transition:fade>
            <div class="progress-text">{box.text}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {box.progress}%"></div>
            </div>
        </div>
    {/each}
</div>

<style>
    .progress-container {
        position: fixed;
        left: 16px;
        bottom: 0;
        z-index: 99999;
        pointer-events: none;
    }

    .progress-box {
        position: absolute;
        left: 0;
        background: rgba(22, 22, 22, 0.95);
        border: 1px solid rgb(34, 34, 34);
        color: #fff;
        padding: 12px 16px;
        border-radius: 6px;
        display: flex;
        min-width: 200px;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.6);
        pointer-events: auto;
    }

    .progress-text {
        font-size: 0.85em;
        color: #ccc;
        font-family: "Torus SemiBold";
    }

    .progress-bar {
        width: 100%;
        height: 4px;
        background: var(--tab-bg-color);
        border-radius: 2px;
    }

    .progress-fill {
        height: 100%;
        background-color: var(--accent-color);
        border-radius: 2px;
        transition: width 0.15s;
    }
</style>
