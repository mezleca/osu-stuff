<script>
    import { onMount, tick } from "svelte";
    import { debounce } from "../../lib/utils/utils";

    export let min = 0;
    export let max = 10;
    export let on_update = () => {};

    let container;

    const update = () => {
        if (!container) {
            return;
        }

        const min_percent = (min / 10) * 100;
        const max_percent = (max / 10) * 100;

        const fill = container.querySelector(".fill");
        const min_thumb = container.querySelector(".min-thumb");
        const max_thumb = container.querySelector(".max-thumb");

        fill.style.left = `${min_percent}%`;
        fill.style.width = `${max_percent - min_percent}%`;
        min_thumb.style.left = `calc(${min_percent}% - 0px)`;
        max_thumb.style.left = `calc(${max_percent}% - 24px)`;
    };

    const clamp = (number, min_val, max_val) => {
        return Math.min(Math.max(number, min_val), max_val);
    };

    const handle_min = (e) => {
        const new_min = parseFloat(e.target.value);
        min = clamp(new_min, 0, max - 0.5);
        update_fill();
    };

    const handle_max = (e) => {
        const new_max = parseFloat(e.target.value);
        max = clamp(new_max, min + 0.5, 10);
        update_fill();
    };

    const on_update_debounce = debounce(() => {
        on_update({ min, max });
    }, 50);

    const update_fill = (event) => {
        tick().then(() => {
            update();
            // dont use callback on resize events
            if (!event) on_update_debounce();
        });
    };

    onMount(() => {
        update_fill();
        window.addEventListener("resize", update_fill);

        return () => {
            window.removeEventListener("resize", update_fill);
        };
    });
</script>

<div bind:this={container} class="slider-container">
    <div class="track"></div>
    <div class="fill"></div>
    <input type="range" min="0" max="10" step="0.1" bind:value={min} oninput={handle_min} class="range-input" />
    <input type="range" min="0" max="10" step="0.1" bind:value={max} oninput={handle_max} class="range-input" />
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
        z-index: 3;
    }
</style>
