import { writable, get } from "svelte/store";
import { show_notification } from "./notifications";
import { downloader } from "./downloader";
import { string_is_valid } from "../utils/utils";

const default_config_fields = {
    osu_id: "",
    osu_secret: "",
    stable_path: "",
    stable_songs_path: "",
    lazer_path: "",
    export_path: "",
    local_images: false,
    lazer_mode: false,
    radio_volume: null,
    mirrors: []
};

const create_persistent_config = () => {
    const { subscribe, set: writable_set, update } = writable({});

    // load saved config
    const load = async () => {
        const config = await window.config.get();
        const config_obj = { ...default_config_fields };

        for (const [k, v] of Object.entries(config)) {
            config_obj[k] = v;
        }

        writable_set(config_obj);

        // update access token on start
        await update_access_token();
    };

    load();

    return {
        subscribe,
        set: async (key, value) => {
            window.config.update({ [key]: value });
            update((config) => ({ ...config, [key]: value }));
        },
        get: (key) => {
            let current_config;
            subscribe((config) => (current_config = config))();
            // @ts-ignore
            return current_config[key] ?? null;
        },
        reload: load
    };
};

export const get_access_token = async (id, secret) => {
    try {
        // early return without notifications
        if (!string_is_valid(id) || !string_is_valid(secret)) {
            return;
        }

        const response = await window.fetch({
            url: "https://osu.ppy.sh/oauth/token",
            method: "POST",
            form_data: {
                grant_type: "client_credentials",
                client_id: id,
                client_secret: secret,
                scope: "public"
            }
        });

        if (response.status != 200) {
            show_notification({ type: "error", text: "failed to get access token..." });
            console.log("failed access token request:", response.status, response.statusText);
            return;
        }

        return response.json();
    } catch (err) {
        console.log("[login] error:", err);
        return;
    }
};

export const update_access_token = async (force) => {
    if (get(access_token) != "" && !force) {
        return;
    }

    const id = config.get("osu_id");
    const secret = config.get("osu_secret");

    if (id == "" || secret == "") {
        return;
    }

    // get new access token
    const new_token = await get_access_token(id, secret);

    if (!new_token) {
        return;
    }

    // update downloader token
    await downloader.update_token(new_token.access_token);

    access_token.set(new_token.access_token);
};

// token used for osu! api
export const access_token = writable("");

// global config
export const config = create_persistent_config();
