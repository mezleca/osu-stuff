<script lang="ts">
    export let label = "input";
    export let placeholder = "";
    export let value = "";
</script>

<div class="field-group">
    <label for="name" class="field-label">{label}</label>
    <input type="text" id="name" class="text-input" bind:value {placeholder} />
</div>
