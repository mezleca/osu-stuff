<script>
    import { onMount } from "svelte";
    import { config, update_access_token } from "../../lib/store/config";
    import { get_osu_data } from "../../lib/utils/collections";
    import { show_notification } from "../../lib/store/notifications";
    import { get_popup_manager, show_popup, PopupAddon } from "../../lib/store/popup";

    // components
    import Add from "../utils/add.svelte";
    import InputDialog from "../utils/input-dialog.svelte";
    import Popup from "../utils/popup/popup.svelte";
    import Checkbox from "../utils/basic/checkbox.svelte";

    let osu_id;
    let osu_secret = "";
    let stable_path = "";
    let lazer_path = "";
    let stable_songs_path = "";
    let mirrors = [];
    let lazer_mode = false;
    let local_images = false;
    let initialized = false;
    let fetching_token = false;

    const popup_manager = get_popup_manager("config");

    const save_and_update = async (key, value) => {
        save_config(key, value);

        if (fetching_token) {
            return;
        }

        fetching_token = true;
        await update_access_token();
        fetching_token = false;
    };

    const save_config = (key, value) => {
        if (initialized && value != $config[key]) {
            config.set(key, value);
        }
    };

    $: if (osu_id) save_and_update("osu_id", osu_id);
    $: if (osu_secret) save_and_update("osu_secret", osu_secret);
    $: if (stable_path) save_config("stable_path", stable_path);
    $: if (lazer_path) save_config("lazer_path", lazer_path);
    $: if (stable_songs_path) save_config("stable_songs_path", stable_songs_path);
    $: if (lazer_mode != undefined) save_config("lazer_mode", lazer_mode);
    $: if (local_images != undefined) save_config("local_images", local_images);

    const add_mirror = async (data) => {
        const { name, url } = data;

        if (name == "" || url == "") {
            show_notification({ text: "missing name/url dumbass", type: "error" });
            return;
        }

        await window.downloader.add_mirror({ name, url });

        // force update
        await config.reload();
        mirrors = $config.mirrors;
    };

    // @TODO: confirmation
    const remove_mirror = async (name) => {
        await window.downloader.remove_mirror(name);
        await config.reload();
        mirrors = $config.mirrors;
    };

    const create_mirror_popup = () => {
        const new_mirror_popup = new PopupAddon();

        new_mirror_popup.add({ id: "name", type: "input", label: "name", text: "ex: beatconnect" });
        new_mirror_popup.add({ id: "url", type: "input", label: "url", text: "ex: https://beatconnect.io/d/" });
        new_mirror_popup.set_callback(add_mirror);

        popup_manager.register("new-mirror", new_mirror_popup);
    };

    onMount(() => {
        // update values on start
        osu_id = $config.osu_id || "";
        osu_secret = $config.osu_secret || "";
        stable_path = $config.stable_path || "";
        lazer_path = $config.lazer_path || "";
        stable_songs_path = $config.stable_songs_path || "";
        lazer_mode = $config.lazer_mode == true || $config.lazer_mode == "true";
        local_images = $config.local_images == true || $config.local_images == "true";
        mirrors = $config.mirrors;
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
                <input id="osu_id_input" type="password" class="text-input" placeholder="ex: 123" bind:value={osu_id} />
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
                <input id="osu_secret_input" type="password" class="text-input" placeholder="ex: 123" bind:value={osu_secret} />
            </div>

            <div class="field-group" id="stable_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">osu stable path</label>
                <div class="field-description">click to select your osu! stable path</div>
                <InputDialog bind:location={stable_path} type="folder" />
            </div>

            <div class="field-group" id="lazer_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">osu lazer path</label>
                <div class="field-description">click to select your osu! lazer path</div>
                <InputDialog bind:location={lazer_path} type="folder" />
            </div>

            <div class="field-group" id="stable_songs_path">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="field-label">songs folder</label>
                <div class="field-description">click to select your osu! songs folder</div>
                <InputDialog bind:location={stable_songs_path} type="folder" />
            </div>

            <div class="field-group">
                <Checkbox bind:value={lazer_mode} label={"lazer mode"} desc="enable to use your lazer collections / beatmaps" />
            </div>

            <div class="field-group">
                <Checkbox bind:value={local_images} label={"use local beatmap images"} desc="useful if you have no internet connection" />
            </div>

            <!-- @TODO: confirmation -->
            <button type="button" onclick={() => get_osu_data(true)}>reload files</button>
            <!-- keybinds dont seem to work on linux (pretty sure is a wayland problem) -->
            <button type="button" onclick={() => window.extra.dev_tools()}>open dev tools</button>
        </div>
        <div class="info-box">
            <div class="info-box-header">
                <div class="info-box-title">beatmap mirrors</div>
                <div class="info-box-subtitle"></div>
            </div>
            <div class="info-box-stats">
                {#each mirrors as mirror}
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
