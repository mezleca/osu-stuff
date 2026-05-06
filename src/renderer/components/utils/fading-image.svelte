<script lang="ts">
    import { fade } from "svelte/transition";

    export let src = "";
    export let fallback = "";
    export let class_name = "";
    export let alt = "";

    let display_src = "";
    let load_id = 0;

    $: if (!src) {
        load_id++;
        display_src = fallback;
    } else {
        const current_id = ++load_id;
        const image = new Image();

        display_src = "";

        image.onload = () => {
            if (current_id != load_id) {
                return;
            }

            display_src = src;
        };

        image.onerror = () => {
            if (current_id != load_id) {
                return;
            }

            display_src = fallback;
        };

        image.src = src;
    }
</script>

{#if display_src}
    {#key display_src}
        <img class={class_name} src={display_src} {alt} loading="lazy" decoding="async" transition:fade={{ duration: 100 }} />
    {/key}
{/if}
