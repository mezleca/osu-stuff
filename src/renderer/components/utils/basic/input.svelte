<script lang="ts">
    export let label = "";
    export let placeholder = "";
    export let value = "";
    export let on_submit: () => void = null;

    const onkeydown = (event: KeyboardEvent) => {
        if (event.key == "Enter" && on_submit) {
            on_submit();
        }
    };
</script>

<div class="field-group">
    {#if label}
        <label for="name" class="field-label">{label}</label>
    {/if}
    <input type="text" id="name" class="text-input" bind:value {placeholder} {onkeydown} />
</div>
