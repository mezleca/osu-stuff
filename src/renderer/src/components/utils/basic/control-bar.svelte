<script lang="ts">
    export let value_percent = 0;
    export let orientation: "horizontal" | "vertical" = "horizontal";
    export let on_change: (percent: number) => void = null;

    let is_vertical = false;
    let clamped_percent = 0;

    $: is_vertical = orientation == "vertical";
    $: clamped_percent = Math.max(0, Math.min(100, value_percent));

    const update = (event: MouseEvent) => {
        if (!on_change) {
            return;
        }

        const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();

        if (is_vertical) {
            on_change(1 - (event.clientY - rect.top) / rect.height);
            return;
        }

        on_change((event.clientX - rect.left) / rect.width);
    };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="control-bar" class:vertical={is_vertical} onmousedown={update}>
    <div class="control-fill" style={is_vertical ? `height: ${clamped_percent}%` : `width: ${clamped_percent}%`}></div>
</div>

<style>
    .control-bar {
        position: relative;
        width: 100%;
        height: 6px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        cursor: pointer;
    }

    .control-bar.vertical {
        width: 6px;
        height: 100%;
    }

    .control-fill {
        position: absolute;
        left: 0;
        bottom: 0;
        pointer-events: none;
        width: 0;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--accent-color-half), var(--accent-color));
    }

    .vertical .control-fill {
        width: 100%;
        height: 0;
        background: linear-gradient(0deg, var(--accent-color-half), var(--accent-color));
    }
</style>
