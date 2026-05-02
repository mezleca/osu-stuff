<script>
    export let callback = () => {};
</script>

<!-- svelte-ignore a11y_consider_explicit_label -->
<button class="add-btn" onclick={callback}>
    <svg id="add-btn" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="16" height="16" stroke="currentColor" fill="none">
        <line x1="5" y1="2" x2="5" y2="8" stroke-width="1" />
        <line x1="2" y1="5" x2="8" y2="5" stroke-width="1" />
    </svg>
</button>

<style>
    .add-btn {
        position: absolute;
        bottom: 30px;
        right: 20px;
        background: #ff4444;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        color: white;
        font-size: 24px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 99;
    }

    .add-btn:hover {
        background: #ff2424;
        transform: scale(1.05);
    }
</style>
