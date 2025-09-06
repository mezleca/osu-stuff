import { writable, get } from "svelte/store";
import { show_notification } from "./notifications";
import { downloader } from "./downloader";
import { string_is_valid } from "../utils/utils";

const DEFAULT_CONFIG_FIELDS = {
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

class ConfigStore {
    constructor() {
        this.store = writable({ ...DEFAULT_CONFIG_FIELDS }); // store for config
        this.access_token = writable(""); // store for access token
        this.fetching_token = writable(false);
        this.load();
    }

    get subscribe() {
        return this.store.subscribe;
    }

    async load() {
        const config = await window.config.get();
        const mirrors = await window.config.get_mirrors();
        const config_obj = { ...DEFAULT_CONFIG_FIELDS };

        for (const [key, value] of Object.entries(config)) {
            if (key in DEFAULT_CONFIG_FIELDS) {
                config_obj[key] = value;
            }
        }

        if (mirrors) {
            config_obj.mirrors = mirrors;
        }

        this.store.set(config_obj);
        await this.update_access_token();
    }

    async set(key, value) {
        this.store.update((config) => ({ ...config, [key]: value }));
    }

    get(key) {
        return get(this.store)[key] ?? null;
    }

    get_all() {
        return get(this.store);
    }

    async reload() {
        await this.load();
    }

    async get_access_token(id, secret) {
        try {
            // early return without notification
            if (!string_is_valid(id) || !string_is_valid(secret)) {
                return;
            }

            this.fetching_token.set(true);

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
        } finally {
            this.fetching_token.set(false);
        }
    }

    async update_access_token(force = false) {
        if (get(this.fetching_token)) {
            return;
        }

        if (get(this.access_token) != "" && !force) {
            return;
        }

        const id = this.get("osu_id");
        const secret = this.get("osu_secret");

        if (id == "" || secret == "") {
            return;
        }

        // get new access token
        const new_token = await this.get_access_token(id, secret);

        if (!new_token) {
            return;
        }

        // update downloader token
        await downloader.update_token(new_token.access_token);
        this.access_token.set(new_token.access_token);
    }
}

// global config
export const config = new ConfigStore();
export const {access_token} = config;
