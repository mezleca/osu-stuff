<script lang="ts">
    type ChipActionType = "toggle" | "remove";

    export let label: string = "";
    export let options: string[] = [];
    export let selected: string[] = [];
    export let columns: number = 2;
    export let single: boolean = false;
    export let action_type: ChipActionType = "toggle";
    export let on_chip_click: ((option: string, action_type: ChipActionType) => void) | undefined = undefined;

    const is_selected = (option: string): boolean => {
        return selected.includes(option);
    };

    const handle_click = (option: string) => {
        on_chip_click?.(option, action_type);

        if (action_type == "remove") {
            return;
        }

        if (single) {
            selected = [option];
            return;
        }

        if (is_selected(option)) {
            selected = selected.filter((o) => o != option);
        } else {
            selected = [...selected, option];
        }
    };
</script>

<div class="field-group">
    {#if label}
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="field-label">{label}</label>
    {/if}

    <div class="chips-grid" style="--columns: {columns}">
        {#each options as option}
            <button
                class="chip"
                class:selected={action_type == "toggle" && is_selected(option)}
                class:remove-action={action_type == "remove"}
                onclick={() => handle_click(option)}
            >
                {option}
            </button>
        {/each}
    </div>
</div>

<style>
    .field-group {
        margin-bottom: 12px;
    }

    .field-label {
        display: block;
        margin-bottom: 8px;
        color: var(--text-secondary);
        font-size: 14px;
        font-family: "Torus SemiBold";
    }

    .chips-grid {
        display: grid;
        grid-template-columns: repeat(var(--columns), 1fr);
        gap: 6px;
    }

    .chip {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 8px;

        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 6px;

        color: var(--text-secondary, #aaa);
        font-size: 12px;
        font-family: "Torus SemiBold";

        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
    }

    .chip:hover {
        background: #333;
        border-color: #555;
        transform: translateY(-1px);
    }

    .chip:active {
        transform: translateY(0);
    }

    .chip.selected {
        background: var(--accent-color, #ff66aa);
        color: white;
        border-color: var(--accent-color, #ff66aa);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .chip.selected:hover {
        background: var(--accent-color2, #ff88bb);
        border-color: var(--accent-color2, #ff88bb);
    }

    .chip.remove-action:hover {
        background: #ff4444;
        border-color: #ff4444;
        color: white;
    }
</style>
