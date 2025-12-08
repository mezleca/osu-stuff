<script lang="ts">
    import { onMount } from "svelte";
    import { active_tab, is_maximized } from "./lib/store/other";
    import { show_notification } from "./lib/store/notifications";
    import { processing, processing_data } from "./lib/store/processor";
    import { debounce, is_dev_mode } from "./lib/utils/utils";
    import { config } from "./lib/store/config";
    import { get_osu_data } from "./lib/utils/collections";

    // tabs
    import Collections from "./components/tabs/collections.svelte";
    import Discover from "./components/tabs/discover.svelte";
    import Browse from "./components/tabs/browse.svelte";
    import Radio from "./components/tabs/radio.svelte";
    import Config from "./components/tabs/config.svelte";
    import Index from "./components/tabs/index.svelte";
    import Status from "./components/tabs/status.svelte";

    // extra
    import Header from "./components/header.svelte";
    import Notifications from "./components/utils/notifications.svelte";
    import ExportProgress from "./components/utils/export-progress.svelte";
    import Spinner from "./components/icon/spinner.svelte";
    import ContextMenu from "./components/utils/context-menu.svelte";

    $: initialized = false;
    $: processing_status = $processing_data?.status ?? "doing something";
    $: processing_width = $processing_data?.length ? ($processing_data.index / $processing_data.length) * 100 : 0;
    $: processing_progress = $processing_data?.large_text ?? "";
    $: processing_small = $processing_data?.small_text ?? "";

    const toggle_maximized = async () => {
        const state = await window.api.invoke("window:state");
        $is_maximized = state == "maximized";
    };

    onMount(async () => {
        try {
            // update maximzed state
            await toggle_maximized();

            // initialize config system
            await config.load();

            // check if we're on dev mode
            is_dev_mode.set(await window.api.invoke("env:dev_mode"));

            // then initialize
            await get_osu_data();
        } catch (err) {
            console.log(err);
            show_notification({ type: "error", duration: 5000, text: `failed to initialize\n${err}` });
        } finally {
            initialized = true;
        }
    });

    // check for maximized state on resize
    window.addEventListener("resize", debounce(toggle_maximized, 50));
</script>

<main>
    <div class="window-border" class:show={!$is_maximized}></div>

    <!-- notification container -->
    <Notifications />
    <ExportProgress />
    <ContextMenu />

    <!-- show loading screen on initialization -->
    {#if !initialized}
        <div class="loading-screen" onclick={(e) => e.stopPropagation()}>
            <Spinner width={48} height={48} />
            <h1 class="loading-status" style="color: white;">loading...</h1>
        </div>
    {/if}

    <!-- processing screen -->
    {#if $processing}
        <div class="processing-overlay">
            <div class="processing-center">
                <div class="processing-title">{processing_status}</div>
                <div class="processing-bar-container">
                    <div class="processing-bar" style="width: {processing_width}%;"></div>
                </div>
                <div class="processing-text">{processing_progress}</div>
            </div>
            {#if processing_data}
                <div class="processing-bottom-text">{processing_small}</div>
            {/if}
        </div>
    {/if}

    <!-- app header -->
    <Header active={initialized && !$processing} />

    <div class="main-container">
        {#if $active_tab == "index"}
            <Index />
        {:else if $active_tab == "collections"}
            <Collections />
        {:else if $active_tab == "browse"}
            <Browse />
        {:else if $active_tab == "discover"}
            <Discover />
        {:else if $active_tab == "radio"}
            <Radio />
        {:else if $active_tab == "config"}
            <Config />
        {:else if $active_tab == "status"}
            <Status />
        {/if}
    </div>
</main>

<style>
    .processing-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(20, 20, 20, 0.95);
        z-index: 1001;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .processing-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
    }

    .processing-title {
        color: #fff;
        font-size: 1.5em;
        margin-bottom: 1.4em;
        text-align: center;
    }

    .processing-bar-container {
        width: 320px;
        height: 14px;
        background: #333;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 1em;
    }

    .processing-bar {
        height: 100%;
        background: var(--accent-color);
        transition: width 0.1s;
    }

    .processing-text {
        color: #fff;
        font-size: 1em;
        text-align: center;
        text-overflow: ellipsis;
        width: 400px;
        white-space: nowrap;
        overflow: hidden;
    }

    .processing-bottom-text {
        color: #aaa;
        font-size: 1.1em;
        position: absolute;
        bottom: 32px;
        left: 0;
        width: 100vw;
        text-align: center;
    }

    .main-container {
        width: 100%;
        height: 100%;
    }
</style>
