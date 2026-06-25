<script lang="ts">
    import { fade } from "svelte/transition";

    interface Props {
        src: string;
        class_name: string;
        fallback: string;
        base_color?: string;
    }

    let { src, fallback, class_name, base_color = "#1f1f1f" }: Props = $props();

    let display_src = $state("");
    let loaded = $state(false);

    $effect(() => {
        if (src == display_src) return;

        loaded = false;
        display_src = "";

        const image = new Image();

        image.onload = () => {
            display_src = src;
            loaded = true;
        };

        image.onerror = () => {
            display_src = fallback;
            loaded = true;
        };

        image.src = src;
    });
</script>

{#if !loaded}
    <div style="width: 100%; height: 100%; background-color: {base_color};"></div>
{:else}
    <img class={class_name} src={display_src} alt="" in:fade={{ duration: 100 }} />
{/if}
