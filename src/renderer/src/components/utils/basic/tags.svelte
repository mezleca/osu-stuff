<script lang="ts">
    export let options: { label: any; value: any }[] = [];
    export let selected_values: any[] = [];
    export let placeholder = "";
    export let lowercase: boolean = true;
    export let multiple = true;
    export let on_update: (label: any) => void = null;

    $: actual_options = options.map((option) => {
        if (typeof option == "string") {
            return { key: option, label: option, value: option };
        }
        return { key: option.value, label: option.label, value: option.value };
    });

    const toggle_tag = (key) => {
        let new_values;

        if (multiple) {
            new_values = selected_values.includes(key) ? selected_values.filter((val) => val != key) : [...selected_values, key];

            selected_values = new_values;

            if (on_update) {
                on_update(new_values);
            }
        } else {
            const is_currently_selected = selected_values.includes(key);
            new_values = is_currently_selected ? [] : [key];

            selected_values = new_values;

            if (on_update) {
                on_update(new_values.length > 0 ? key : null);
            }
        }
    };
</script>

<div class="tag-container">
    {#if placeholder}
        <span class="placeholder">{placeholder}</span>
    {/if}

    <div class="tags">
        {#each actual_options as option}
            <button class="tag" class:selected={selected_values.includes(option.value)} onclick={() => toggle_tag(option.key)}>
                {lowercase ? String(option.value).toLowerCase() : option.value}
            </button>
        {/each}
    </div>
</div>

<style>
    .tag-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 8px;
    }

    .placeholder {
        color: var(--text-secondary);
        font-size: 12px;
        margin-right: 4px;
        white-space: nowrap;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .tag {
        background: var(--bg-secondary);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 4px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .tag:hover {
        background: var(--bg-tertiary);
        border-color: var(--accent-color2);
    }

    .tag.selected {
        background: var(--accent-color);
        border-color: var(--accent-color);
        color: white;
    }

    .tag.selected:hover {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
    }
</style>
