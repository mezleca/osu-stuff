<script>
    import { onMount } from "svelte";
    import { config } from "../../lib/store/config";
    import { get_osu_data } from "../../lib/utils/collections";
    import { show_notification } from "../../lib/store/notifications";
    import { get_popup_manager, show_popup, PopupAddon, quick_confirm } from "../../lib/store/popup";

    // components
    import Add from "../utils/add.svelte";
    import InputDialog from "../utils/input-dialog.svelte";
    import Popup from "../utils/popup/popup.svelte";
    import Checkbox from "../utils/basic/checkbox.svelte";

    let initialized = false;
    let last_config = {};

    const popup_manager = get_popup_manager("config");

    const handle_config_change = async (new_config) => {
        if (!initialized || !last_config) {
            return;
        }

        const changes = [];

        // check what changed
        for (const [key, value] of Object.entries(new_config)) {
            if (last_config[key] != value) {
                changes.push({ key, value, old_value: last_config[key] });
            }
        }

        if (changes.length == 0) {
            return;
        }

        // save changes to backend
        for (const change of changes) {
            await window.config.update({ [change.key]: change.value });
            console.log(`updated ${change.key}: ${change.old_value} -> ${change.value}`);
        }

        // update access token if credentials changed
        const credential_changes = changes.filter((c) => c.key == "osu_id" || c.key == "osu_secret");

        if (credential_changes.length > 0) {
            await config.update_access_token();
        }

        last_config = { ...new_config };
    };

    // watch for config changes
    $: handle_config_change($config);

    const add_mirror = async (data) => {
        const { name, url } = data;

        if (name == "" || url == "") {
            show_notification({ text: "missing name/url dumbass", type: "error" });
            return;
        }

        // add new mirror to database
        await window.downloader.add_mirror({ name, url });

        // force update
        await config.reload();
    };

    const remove_mirror = async (name) => {
        const confirm_result = await quick_confirm(`delete ${name}?`, { key: "config" });

        if (confirm_result != "yes") {
            return;
        }

        // remove mirror from database
        await window.downloader.remove_mirror(name);

        // sync config data
        await config.reload();
    };

    const reload_files = async () => {
        const confirm_result = await quick_confirm("are you sure?", { key: "config" });

        if (confirm_result != "yes") {
            return;
        }

        get_osu_data(true);
    };

    const create_mirror_popup = () => {
        const new_mirror_popup = new PopupAddon();

        new_mirror_popup.add({ id: "name", type: "input", label: "name", text: "ex: beatconnect" });
        new_mirror_popup.add({ id: "url", type: "input", label: "url", text: "ex: https://beatconnect.io/d/" });
        new_mirror_popup.set_callback(add_mirror);

        popup_manager.register("new-mirror", new_mirror_popup);
    };

    onMount(() => {
        last_config = { ...$config };
        initialized = true;
        create_mirror_popup();
    });
</script>

<div class="content tab-content">
    <Add callback={() => show_popup("new-mirror", "config")} />
    <Popup key={"config"} />
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
                <input id="osu_id_input" type="password" class="text-input" placeholder="ex: 123" bind:value={$config.osu_id} />
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
                <input id="osu_secret_input" type="password" class="text-input" placeholder="ex: 123" bind:value={$config.osu_secret} />
            </div>

            <div class="field-group" id="stable_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">osu stable path</label>
                <div class="field-description">click to select your osu! stable path</div>
                <InputDialog bind:location={$config.stable_path} type="folder" />
            </div>

            <div class="field-group" id="lazer_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">osu lazer path</label>
                <div class="field-description">click to select your osu! lazer path</div>
                <InputDialog bind:location={$config.lazer_path} type="folder" />
            </div>

            <div class="field-group" id="stable_songs_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">songs folder</label>
                <div class="field-description">click to select your osu! songs folder</div>
                <InputDialog bind:location={$config.stable_songs_path} type="folder" />
            </div>

            <div class="field-group">
                <Checkbox bind:value={$config.lazer_mode} label={"lazer mode"} desc="enable to use your lazer collections / beatmaps" />
            </div>

            <!-- @TODO: confirmation -->
            <button type="button" onclick={() => reload_files()}>reload files</button>
            <!-- keybinds dont seem to work on linux (pretty sure is a wayland problem) -->
            <button type="button" onclick={() => window.extra.dev_tools()}>open dev tools</button>
        </div>
        <div class="info-box">
            <div class="info-box-header">
                <div class="info-box-title">beatmap mirrors</div>
                <div class="info-box-subtitle"></div>
            </div>
            <div class="info-box-stats">
                {#each $config.mirrors as mirror}
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
    .field-group {
        margin-bottom: 24px;
    }

    .field-group:last-child {
        margin-bottom: 0;
    }

    .field-label {
        display: block;
        color: #ffffff;
        margin-bottom: 5px;
        font-size: 15px;
        color: var(--text-primary);
    }

    .field-description {
        color: #999999;
        font-size: 13px;
        margin-bottom: 10px;
    }

    .field-description > a {
        color: var(--accent-color);
        text-decoration: underline;
        cursor: pointer;
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
