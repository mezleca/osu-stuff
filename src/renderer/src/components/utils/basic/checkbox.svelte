<script lang="ts">
    export let id: string = crypto.randomUUID();
    export let onchange: (id: string, value: boolean) => void = null;
    export let value: boolean = false;
    export let label: string = "";
    export let desc: string = "";
    export let compact = false;
</script>

<div class="checkbox-field" class:compact>
    <label class="checkbox-wrapper" for={id}>
        <div class="checkbox">
            <input
                {id}
                type="checkbox"
                bind:checked={value}
                onchange={() => {
                    if (onchange) onchange(id, value);
                }}
            />
            <div class="checkbox-custom"></div>
        </div>
        <span class="checkbox-text">{label}</span>
        {#if desc}
            <div class="checkbox-description">{desc}</div>
        {/if}
    </label>
</div>

<style>
    .checkbox-field {
        display: flex;
        flex-direction: column;
    }

    .checkbox-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        flex-wrap: wrap;
        min-height: 34px;
    }

    .checkbox {
        position: relative;
        width: 18px;
        height: 18px;
        margin-right: 0;
        flex-shrink: 0;
    }

    .compact .checkbox {
        width: 16px;
        height: 16px;
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
        width: 18px;
        height: 18px;
        background-color: var(--bg-color);
        border: 1px solid var(--header-border-color);
        border-radius: 4px;
        transition: all var(--context-fade-delay) ease;
    }

    .compact .checkbox-custom {
        width: 16px;
        height: 16px;
    }

    .checkbox input[type="checkbox"]:checked + .checkbox-custom {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
    }

    .checkbox-text {
        display: block;
        color: var(--text-secondary);
        font-size: 14px;
        margin-bottom: 0;
        line-height: 1.2;
        cursor: pointer;
        flex-grow: 1;
        font-family: "Torus SemiBold";
    }

    .compact .checkbox-text {
        font-size: 14px;
    }

    .checkbox-description {
        font-size: 13px;
        color: var(--text-muted);
        width: 100%;
        padding-left: 12px;
    }
</style>
