<script lang="ts">
    import { onMount } from "svelte";
    import { ModalType, modals } from "../../../lib/utils/modal";
    import { beatmap_preview } from "../../../lib/utils/beatmaps";
    import { input } from "../../../lib/store/input";
    import { get_audio_manager } from "../../../lib/store/audio";

    const radio_audio_manager = get_audio_manager("radio");
    let was_modal_open = false;

    $: active_modals = $modals;
    $: has_modal = active_modals.has(ModalType.beatmap_preview);
    $: beatmap_data = $beatmap_preview;
    $: difficulty_id = beatmap_data?.online_id ?? 0;
    $: preview_url = difficulty_id > 0 ? `https://preview.tryz.id.vn/?b=${difficulty_id}` : "";

    $: if (has_modal && !was_modal_open) {
        was_modal_open = true;

        if (radio_audio_manager.get_state().playing) {
            radio_audio_manager.pause_until(() => !modals.has(ModalType.beatmap_preview));
        }
    }

    $: if (!has_modal && was_modal_open) {
        was_modal_open = false;
    }

    const cleanup = () => {
        modals.hide(ModalType.beatmap_preview);
    };

    const open_on_browser = () => {
        if (!beatmap_data?.beatmapset_id) {
            return;
        }

        window.api.invoke("shell:open", `https://osu.ppy.sh/beatmapsets/${beatmap_data.beatmapset_id}`);
    };

    const open_preview_on_browser = () => {
        if (!preview_url) {
            return;
        }

        window.api.invoke("shell:open", preview_url);
    };

    onMount(() => {
        const handle_escape_id = input.on("escape", () => {
            cleanup();
        });

        return () => {
            input.unregister(handle_escape_id);
        };
    });
</script>

{#if has_modal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup} style="background: rgba(0, 0, 0, 0.6);">
        {#if !preview_url}
            <h2 style="color: white; font-weight: 500;">invalid beatmap difficulty id</h2>
        {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="player-container" onclick={(e) => e.stopPropagation()}>
                <div class="iframe-container">
                    <iframe src={preview_url} title="beatmap preview" loading="eager" referrerpolicy="no-referrer" allowfullscreen></iframe>
                </div>

                <div class="controls-container">
                    <div class="beatmap-info">
                        <span class="beatmap-title">
                            {beatmap_data?.artist} - {beatmap_data?.title} [{beatmap_data?.difficulty}]
                        </span>
                        <div class="actions">
                            <button class="icon-button" onclick={open_preview_on_browser}>open preview</button>
                            <button class="icon-button" onclick={open_on_browser}>open on osu!</button>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .modal-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100vw;
        height: 100vh;
        padding: 32px;
        box-sizing: border-box;
    }

    .player-container {
        position: relative;
        width: min(1400px, 95%);
        height: min(900px, 95%);
        background-color: #0c0c0c;
        border-radius: 12px;
        margin-top: 4em;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .iframe-container {
        position: relative;
        flex: 1;
        min-height: 0;
        background-color: #0c0c0c;
    }

    iframe {
        width: 100%;
        height: 100%;
        border: 0;
    }

    .controls-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px 10px 10px;
        background: rgba(10, 10, 10, 0.85);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .beatmap-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-left: 4px;
        gap: 10px;
    }

    .beatmap-title,
    .icon-button {
        font-family: "Torus Semibold";
    }

    .beatmap-title {
        font-size: 13px;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .icon-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 8px;
        transition: all 0.2s;
        opacity: 0.8;
        font-size: 12px;
    }

    .icon-button:hover {
        background: rgba(255, 255, 255, 0.1);
        opacity: 1;
    }
</style>
