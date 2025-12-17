<script lang="ts">
    export let label: string = "";
    export let options: string[] = [];
    export let selected: string[] = [];
    export let columns: number = 2; // Default to 2 columns

    // Optional: allow single selection mode if needed in future, but for now defaults to multiple
    export let single: boolean = false;

    const is_selected = (option: string): boolean => {
        return selected.includes(option);
    };

    const handle_click = (option: string) => {
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
            <button class="chip" class:selected={is_selected(option)} onclick={() => handle_click(option)}>
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
        color: var(--text-secondary); /* Assuming this var exists from Buttons.svelte usage */
        font-size: 14px;
        font-family: "Torus SemiBold";
    }

    .chips-grid {
        display: grid;
        grid-template-columns: repeat(var(--columns), 1fr);
        gap: 8px;
    }

    .chip {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 8px 12px;

        background: #2a2a2a; /* Dark background */
        border: 1px solid #444;
        border-radius: 6px; /* Slightly more rounded than buttons */

        color: var(--text-secondary, #aaa);
        font-size: 13px;
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
</style>
