<script>
    // props
    export let value = 0;
    export let full = true;
    export let callback = () => {};

    const update = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (callback) callback((event.clientX - rect.left) / rect.width);
    };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="control-bar" class:full-width={full} onmousedown={update}>
    <div class="control-fill" style="width: {value}%;"></div>
</div>

<style>
    .control-bar {
        width: 0px;
        height: 6px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
        cursor: pointer;
        position: relative;
        transition: 0.10s width;
    }

    .control-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-color-half), var(--accent-color));
        border-radius: 3px;
        width: 0%;
        position: relative;
        transition: width 0.1s ease;
        pointer-events: none;
    }

    .full-width {
        width: 100%;
    }
</style>
