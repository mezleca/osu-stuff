<script lang="ts">
    import { config } from "../../lib/store/config";
    import { show_notification } from "../../lib/store/notifications";
    import { quick_confirm, show_modal, ModalType } from "../../lib/utils/modal";
    import type { StuffConfig } from "@shared/types";
    import { get_osu_data } from "../../lib/utils/collections";

    // components
    import Add from "../utils/add.svelte";
    import InputDialog from "../utils/basic/input-dialog.svelte";
    import Checkbox from "../utils/basic/checkbox.svelte";
    import QuickConfirmModal from "./modal/quick-confirm-modal.svelte";
    import NewMirrorModal from "./modal/new-mirror-modal.svelte";

    const { mirrors } = config;

    const handle_text_change = async (key: keyof StuffConfig, value: string) => {
        await config.set(key, value);
    };

    const handle_local_image_toggle = async () => {
        const confirmation = await quick_confirm(`local images means more memory usage. are you sure?`, {
            submit: "yeah bro idc",
            cancel: "nah"
        });

        if (!confirmation) {
            return;
        }

        const success = await config.set("local_images", !$config.local_images);

        if (!success) {
            $config.local_images = $config.local_images;
        }
    };

    const handle_lazer_mode_toggle = async () => {
        const success = await config.set("lazer_mode", !$config.lazer_mode);

        if (!success) {
            $config.lazer_mode = $config.lazer_mode;
        }
    };

    const remove_mirror = async (name: string) => {
        const confirm_result = await quick_confirm(`delete ${name}?`, {
            submit: "delete",
            cancel: "cancel"
        });

        if (!confirm_result) {
            return;
        }

        // remove mirror from database
        await window.api.invoke("mirrors:delete", { name });

        // sync config data
        await config.load();
    };

    const reload_files = async () => {
        const validation = config.validate_paths();

        if (!validation.valid) {
            const missing = validation.missing.join(", ");
            show_notification({
                type: "error",
                text: `missing required paths: ${missing}`
            });
            return;
        }

        const confirm_result = await quick_confirm("are you sure?", {
            submit: "mhm",
            cancel: "cancel"
        });

        if (!confirm_result) {
            return;
        }

        await config.load();
        await get_osu_data(true);

        show_notification({ type: "success", text: "reloaded successfully" });
    };
</script>

<div class="content tab-content">
    <Add callback={() => show_modal(ModalType.new_mirror)} />
    <QuickConfirmModal />
    <NewMirrorModal />
    <div class="config-content">
        <div class="config-fields">
            <div class="field-group" id="osu_id">
                <label class="field-label" for="osu_id_input">osu! id</label>
                <div class="field-description">
                    create a new OAuth application <a
                        href="https://osu.ppy.sh/home/account/edit#new-oauth-application"
                        target="_blank"
                        rel="noopener noreferrer">here</a
                    > and paste the ID below
                </div>
                <input
                    id="osu_id_input"
                    type="password"
                    class="text-input"
                    placeholder="ex: 123"
                    value={$config.osu_id}
                    onchange={(e) => handle_text_change("osu_id", e.target.value)}
                />
            </div>

            <div class="field-group" id="osu_secret">
                <label class="field-label" for="osu_secret_input">osu! secret</label>
                <div class="field-description">
                    create a new OAuth application <a
                        href="https://osu.ppy.sh/home/account/edit#new-oauth-application"
                        target="_blank"
                        rel="noopener noreferrer">here</a
                    > and paste the SECRET below
                </div>
                <input
                    id="osu_secret_input"
                    type="password"
                    class="text-input"
                    placeholder="ex: 123"
                    value={$config.osu_secret}
                    onchange={(e) => handle_text_change("osu_secret", e.target.value)}
                />
            </div>

            <div class="field-group" id="stable_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">osu stable path</label>
                <div class="field-description">click to select your osu! stable path</div>
                <InputDialog
                    location={$config.stable_path}
                    callback={(path) => handle_text_change("stable_path", path)}
                    title={"stable directory"}
                    type="openDirectory"
                />
            </div>

            <div class="field-group" id="lazer_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">osu lazer path</label>
                <div class="field-description">click to select your osu! lazer path</div>
                <InputDialog
                    location={$config.lazer_path}
                    callback={(path) => handle_text_change("lazer_path", path)}
                    title={"lazer directory"}
                    type="openDirectory"
                />
            </div>

            <div class="field-group" id="stable_songs_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">songs folder</label>
                <div class="field-description">click to select your osu! songs folder</div>
                <InputDialog
                    location={$config.stable_songs_path}
                    callback={(path) => handle_text_change("stable_songs_path", path)}
                    title={"stable songs directory"}
                    type="openDirectory"
                />
            </div>

            <div class="field-group">
                <Checkbox
                    onchange={handle_local_image_toggle}
                    value={$config.local_images}
                    label={"local images"}
                    desc="enable local images on beatmap-cards instead of web assets"
                />
            </div>

            <div class="field-group">
                <Checkbox
                    onchange={handle_lazer_mode_toggle}
                    value={$config.lazer_mode}
                    label={"lazer mode"}
                    desc="enable to use your lazer collections / beatmaps"
                />
            </div>

            <div class="config-buttons">
                <button type="button" onclick={reload_files}>reload files</button>
                <button type="button" onclick={() => window.api.invoke("window:dev_tools")}> open dev tools </button>
            </div>
        </div>
        <div class="info-box">
            <div class="info-box-header">
                <div class="info-box-title">beatmap mirrors</div>
                <div class="info-box-subtitle"></div>
            </div>
            <div class="info-box-stats">
                {#each $mirrors as mirror}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="stat-item" onclick={() => remove_mirror(mirror.name)}>
                        <div class="stat-value">{mirror.name}</div>
                        <div class="stat-label">{mirror.url}</div>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .field-label {
        color: var(--text-secondary);
    }

    .field-description {
        color: var(--text-muted);
    }

    .config-buttons > button {
        font-family: "Torus Bold";
    }

    .info-box {
        padding: 24px;
        height: 100%;
        display: flex;
        flex-direction: column;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .info-box-title {
        color: var(--accent-color);
        font-size: 20px;
        margin-bottom: 6px;
    }

    .info-box-subtitle {
        color: #cccccc;
        font-size: 14px;
        line-height: 1.4;
    }

    .info-box-stats {
        display: grid;
        margin-top: 10px;
        gap: 10px;
    }

    @media (max-width: 768px) {
        .config-content {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 1200px) {
        .config-content {
            grid-template-columns: 50% 50%;
        }
    }
</style>
