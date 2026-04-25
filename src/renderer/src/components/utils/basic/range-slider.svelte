<script lang="ts">
    import { onDestroy } from "svelte";
    import { debounce } from "@shared/timing";
    import { clamp } from "../../../lib/utils/utils";

    const THUMB_SIZE = 32;
    const HALF_THUMB_SIZE = THUMB_SIZE / 2;
    const DEFAULT_STEP = 0.1;

    type RangeOnUpdate = [number, number];
    type RangeHandleType = "min" | "max";

    export let label = "";
    export let min = 0;
    export let max = 10;
    export let min_bound = 0;
    export let max_bound = 10;
    export let step = DEFAULT_STEP;
    export let value: RangeOnUpdate = [0, 0];
    export let on_update: ((data: RangeOnUpdate) => void) | null = null;

    const get_percent = (current_value: number, range_start: number, range_end: number): number => {
        const range_span = Math.max(range_end - range_start, 1);
        return ((current_value - range_start) / range_span) * 100;
    };

    const get_position_style = (percent: number): string => {
        return `calc(${HALF_THUMB_SIZE}px + (${percent} * (100% - ${THUMB_SIZE}px) / 100))`;
    };

    const get_fill_width_style = (start_percent: number, end_percent: number): string => {
        const width_percent = Math.max(end_percent - start_percent, 0);
        return `calc(${width_percent} * (100% - ${THUMB_SIZE}px) / 100)`;
    };

    const emit_update = () => {
        if (Number.isNaN(min) || Number.isNaN(max)) {
            return;
        }

        on_update?.([min, max]);
        value = [min, max];
    };

    const debounced_update = debounce(() => {
        emit_update();
    }, 50);

    const clamp_values = () => {
        const normalized_step = Math.abs(step) || DEFAULT_STEP;
        const clamped_min = clamp(min, min_bound, max_bound - normalized_step);
        const clamped_max = clamp(max, min_bound + normalized_step, max_bound);
        const next_min = clamp(clamped_min, min_bound, clamped_max - normalized_step);
        const next_max = clamp(clamped_max, next_min + normalized_step, max_bound);

        if (next_min != min) {
            min = next_min;
        }

        if (next_max != max) {
            max = next_max;
        }
    };

    const handle_input = (handle_type: RangeHandleType, event: Event) => {
        const target = event.currentTarget as HTMLInputElement;
        const next_value = parseFloat(target.value);
        const normalized_step = Math.abs(parseFloat(target.step) || step || DEFAULT_STEP);

        if (handle_type == "min") {
            min = clamp(next_value, min_bound, max - normalized_step);
        } else {
            max = clamp(next_value, min + normalized_step, max_bound);
        }

        debounced_update();
    };

    $: clamp_values();
    $: min_percent = get_percent(min, min_bound, max_bound);
    $: max_percent = get_percent(max, min_bound, max_bound);
    $: min_position_style = get_position_style(min_percent);
    $: max_position_style = get_position_style(max_percent);
    $: fill_width_style = get_fill_width_style(min_percent, max_percent);

    onDestroy(() => {
        debounced_update.cancel();
    });
</script>

<div class="field-group" style="width: 100%;">
    {#if label != ""}
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="field-label">{label}</label>
    {/if}
    <div class="slider-body">
        <div class="track"></div>
        <div class="fill" style:left={min_position_style} style:width={fill_width_style}></div>
        <input
            type="range"
            min={min_bound}
            max={max_bound}
            {step}
            bind:value={min}
            oninput={(event) => handle_input("min", event)}
            class="range-input"
        />
        <input
            type="range"
            min={min_bound}
            max={max_bound}
            {step}
            bind:value={max}
            oninput={(event) => handle_input("max", event)}
            class="range-input"
        />
        <div class="min-thumb" style:left={min_position_style}>{min.toFixed(1)}</div>
        <div class="max-thumb" style:left={max_position_style}>{max.toFixed(1)}</div>
    </div>
</div>

<style>
    .slider-body {
        position: relative;
        width: 100%;
        height: 32px;
        padding: 0 16px;
        box-sizing: border-box;
    }

    .track {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        background: transparent;
        border-radius: 4px;
        border: 2px solid var(--accent-color-half);
        z-index: 3;
        pointer-events: none;
    }

    .fill {
        position: absolute;
        top: 0;
        height: 32px;
        background: linear-gradient(to right, var(--accent-color) 0%, var(--accent-color-half) 100%);
        border-radius: 4px;
        z-index: 1;
    }

    .range-input {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 32px;
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
        z-index: 2;
    }

    .range-input::-webkit-slider-track {
        background: transparent;
    }

    .range-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 32px;
        height: 32px;
        background: #fff;
        border: 2px solid #333;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .min-thumb,
    .max-thumb {
        position: absolute;
        top: 0;
        width: 32px;
        height: 32px;
        background: #fff;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: #333;
        pointer-events: none;
        transform: translateX(-50%);
        z-index: 3;
        font-family: "Torus Bold";
    }
</style>
