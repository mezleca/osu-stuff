<script lang="ts">
    // props
    export let id: string = crypto.randomUUID();
    export let onchange: (id: string, value: boolean) => void = null;
    export let value: boolean = false;
    export let label: string = "";
    export let desc: string = "";
</script>

<div class="checkbox-wrapper">
    <div class="checkbox">
        <input
            type="checkbox"
            id="lazer_checkbox"
            bind:checked={value}
            onchange={() => {
                if (onchange) onchange(id, value);
            }}
        />
        <div class="checkbox-custom"></div>
    </div>
    <label class="checkbox-text" for="lazer_checkbox">{label}</label>
    {#if desc}
        <div class="checkbox-description">{desc}</div>
    {/if}
</div>

<style>
    .checkbox-wrapper {
        display: flex;
        cursor: pointer;
        flex-wrap: wrap;
    }

    .checkbox {
        position: relative;
        width: 20px;
        height: 20px;
        margin-right: 10px;
    }

    .checkbox input[type="checkbox"] {
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
    }

    .checkbox-custom {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        background-color: var(--bg-color);
        border: 2px solid var(--header-border-color);
        border-radius: 4px;
        transition: all var(--context-fade-delay) ease;
    }

    .checkbox input[type="checkbox"]:checked + .checkbox-custom {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
    }

    .checkbox-text {
        display: block;
        color: #ffffff;
        font-size: 15px;
        margin-bottom: 4px;
        cursor: pointer;
        flex-grow: 1;
    }

    .checkbox-description {
        font-size: 13px;
        color: #999999;
        line-height: 1.3;
        width: 100%;
    }
</style>
