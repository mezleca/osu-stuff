<script>
    import { onMount, tick } from "svelte";
    import { fromStore } from "svelte/store";
    import { fade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { core_state, set_window_maximized } from "./lib/store/other.svelte";
    import { show_notification } from "./lib/store/notifications";
    import { processing, processing_data } from "./lib/store/processor";
    import { is_dev_mode } from "./lib/utils/utils";
    import { debounce } from "@shared/timing";
    import { downloader } from "./lib/store/downloader";
    import { get_osu_data } from "./lib/utils/collections";

    // tabs
    import Collections from "./components/tabs/collections.svelte";
    import Discover from "./components/tabs/discover.svelte";
    import Radio from "./components/tabs/radio.svelte";
    import Config from "./components/tabs/config.svelte";
    import Index from "./components/tabs/index.svelte";
    import Status from "./components/tabs/status.svelte";

    // global modals
    import BeatmapPreviewModal from "./components/tabs/modal/beatmap-preview-modal.svelte";
    import MissingBeatmapsModal from "./components/tabs/modal/missing-beatmaps-modal.svelte";

    // extra
    import Header from "./components/header.svelte";
    import Notifications from "./components/utils/notifications.svelte";
    import ProgressBox from "./components/utils/progress-box.svelte";
    import Spinner from "./components/icon/spinner.svelte";
    import ContextMenu from "./components/utils/context-menu.svelte";

    const processing_state = fromStore(processing);
    const processing_state_data = fromStore(processing_data);

    let initialized = $state(false);

    const is_maximized = $derived(core_state.window.maximized);
    const active_tab = $derived(core_state.window.active_tab);
    const is_processing = $derived(processing_state.current);
    const processing_status = $derived(processing_state_data.current?.status ?? "doing something");
    const processing_width = $derived(
        processing_state_data.current?.length ? (processing_state_data.current.index / processing_state_data.current.length) * 100 : 0
    );
    const processing_progress = $derived(processing_state_data.current?.large_text ?? "");
    const processing_small = $derived(processing_state_data.current?.small_text ?? "");

    const toggle_maximized = debounce(async () => {
        const state = await window.api.invoke("window:state");
        set_window_maximized(state == "maximized");
    }, 100);

    onMount(() => {
        (async () => {
            try {
                toggle_maximized();

                is_dev_mode.set(await window.api.invoke("env:dev_mode"));

                await downloader.initialize();
                const processing_state = await window.api.invoke("processor:state");

                processing.set(processing_state.processing);
                processing_data.set(processing_state.data ?? {});
            } catch (err) {
                console.log(err);
                show_notification({ type: "error", duration: 5000, text: `failed to initialize\n${err}` });
            } finally {
                initialized = true;

                await tick();

                // tell main process we're ready
                await window.api.invoke("core:initialized", true);
                await get_osu_data();
            }
        })();

        window.addEventListener("resize", toggle_maximized);

        return () => {
            window.removeEventListener("resize", toggle_maximized);
            toggle_maximized.cancel();
        };
    });
</script>

<main>
    <div class="window-border" class:show={!is_maximized}></div>

    <!-- global components -->
    <Notifications />
    <ProgressBox />
    <ContextMenu />
    <MissingBeatmapsModal />
    <BeatmapPreviewModal />

    <!-- show loading screen on initialization -->
    {#if !initialized}
        <div class="loading-screen" role="presentation" onmousedown={(e) => e.stopPropagation()} transition:fade={{ easing: cubicOut }}>
            <Spinner width={48} height={48} />
            <h1 class="loading-status" style="color: white;">loading...</h1>
        </div>
    {/if}

    <!-- processing screen -->
    {#if is_processing}
        <div class="processing-overlay" transition:fade={{ easing: cubicOut }}>
            <div class="processing-center">
                <div class="processing-title">{processing_status}</div>
                <div class="processing-bar-container">
                    <div class="processing-bar" style="width: {processing_width}%;"></div>
                </div>
                <div class="processing-text">{processing_progress}</div>
            </div>
            {#if processing_state_data.current}
                <div class="processing-bottom-text">{processing_small}</div>
            {/if}
        </div>
    {/if}

    <!-- app header -->
    <Header active={initialized && !is_processing} />

    <div class="main-container">
        {#if active_tab == "index"}
            <Index />
        {:else if active_tab == "collections"}
            <Collections />
        {:else if active_tab == "discover"}
            <Discover />
        {:else if active_tab == "radio"}
            <Radio />
        {:else if active_tab == "config"}
            <Config />
        {:else if active_tab == "status"}
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
        z-index: 99998;
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
        font-family: "Torus";
    }

    .processing-title {
        color: #fff;
        font-size: 1.5em;
        margin-bottom: 1em;
        text-align: center;
        font-family: "Torus SemiBold";
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
        font-family: "Torus SemiBold";
    }

    .processing-bottom-text {
        color: #aaa;
        font-size: 1.1em;
        position: absolute;
        bottom: 32px;
        left: 0;
        width: 100vw;
        text-align: center;
        font-family: "Torus SemiBold";
    }

    .main-container {
        width: 100%;
        height: 100%;
    }
</style>
