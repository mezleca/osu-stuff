<script>
    import { onMount, tick } from "svelte";
    import { debounce } from "../../../lib/utils/utils";

    export let min = 0;
    export let max = 10;
    export let min_bound = 0;
    export let max_bound = 10;
    export let on_update = () => {};

    let container;

    const update = () => {
        if (!container) {
            return;
        }

        const range_span = max_bound - min_bound || 1;
        const min_percent = ((min - min_bound) / range_span) * 100;
        const max_percent = ((max - min_bound) / range_span) * 100;

        const fill = container.querySelector(".fill");
        const min_thumb = container.querySelector(".min-thumb");
        const max_thumb = container.querySelector(".max-thumb");

        fill.style.left = `${min_percent}%`;
        fill.style.width = `${max_percent - min_percent}%`;

        min_thumb.style.left = `${min_percent}%`;
        max_thumb.style.left = `${max_percent}%`;

        const usable_width = container.offsetWidth - 32;
        const min_position = 16 + (min_percent / 100) * usable_width;
        const max_position = 16 + (max_percent / 100) * usable_width;
        
        min_thumb.style.left = `${min_position}px`;
        max_thumb.style.left = `${max_position}px`;
    };

    const clamp = (number, min_val, max_val) => Math.min(Math.max(number, min_val), max_val);

    const handle_min = (e) => {
        const new_min = parseFloat(e.target.value);
        const step = Math.abs(parseFloat(e.target.step) || 0.1);
        min = clamp(new_min, min_bound, max - step);
        update_fill();
    };

    const handle_max = (e) => {
        const new_max = parseFloat(e.target.value);
        const step = Math.abs(parseFloat(e.target.step) || 0.1);
        max = clamp(new_max, min + step, max_bound);
        update_fill();
    };

    const on_update_debounce = debounce(() => on_update({ min, max }), 50);

    const update_fill = (event) => {
        tick().then(() => {
            update();
            if (!event) on_update_debounce();
        });
    };

    onMount(() => {
        update_fill();
        window.addEventListener("resize", update_fill);
        return () => window.removeEventListener("resize", update_fill);
    });
</script>

<div bind:this={container} class="slider-container">
    <div class="track"></div>
    <div class="fill"></div>
    <input type="range" min={min_bound} max={max_bound} step="0.1" bind:value={min} oninput={handle_min} class="range-input" />
    <input type="range" min={min_bound} max={max_bound} step="0.1" bind:value={max} oninput={handle_max} class="range-input" />
    <div class="min-thumb">{min.toFixed(1)}</div>
    <div class="max-thumb">{max.toFixed(1)}</div>
</div>

<style>
    .slider-container {
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
    }
</style>
