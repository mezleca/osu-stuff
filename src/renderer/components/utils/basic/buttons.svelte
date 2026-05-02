<script lang="ts">
    export let label: string = "";
    export let options: string[] = [];
    export let selected: string[] = [];
    export let row: boolean = false;

    const is_selected = (option: string): boolean => {
        return selected.includes(option);
    };

    const handle_click = (option: string) => {
        if (is_selected(option)) {
            selected = selected.filter((o) => o != option);
        } else {
            selected = [...selected, option];
        }
    };
</script>

<div class="field-group">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="field-label">{label}</label>
    <div class="buttons-container" class:row>
        {#each options as option}
            <button class="select-button" class:selected={is_selected(option)} onclick={() => handle_click(option)}>
                {option}
            </button>
        {/each}
    </div>
</div>

<style>
    .buttons-container {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        margin-top: 8px;
        gap: 8px;
    }

    .buttons-container.row {
        flex-direction: row;
    }

    .select-button {
        padding: 10px 15px;
        border: 1px solid #444;
        border-radius: 4px;
        background: #2a2a2a;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 13px;
        transition: all 0.15s ease;
        text-align: left;
        font-family: "Torus SemiBold";
    }

    .select-button:hover {
        background: #333;
        border-color: #555;
    }

    .select-button.selected {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
    }

    .select-button.selected:hover {
        background: var(--accent-color2);
        border-color: var(--accent-color2);
    }
</style>
