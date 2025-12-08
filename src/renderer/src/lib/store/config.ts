import { writable, get, type Writable } from "svelte/store";
import type { StuffConfig, StuffMirror } from "@shared/types";
import { debounce, string_is_valid } from "../utils/utils";
import { show_notification } from "./notifications";

const DEFAULT_CONFIG_FIELDS = {
    osu_id: "",
    osu_secret: "",
    stable_path: "",
    stable_songs_path: "",
    lazer_path: "",
    export_path: "",
    local_images: false,
    lazer_mode: false,
    radio_volume: 50
};

const show_failed_auth_warn = debounce(() => {
    show_notification({ type: "error", text: "failed to authenticate (invalid id / secret)" });
}, 1000);

class ConfigStore {
    data: Writable<StuffConfig>;
    mirrors: Writable<StuffMirror[]>;
    fetching_token: Writable<boolean>;
    authenticated: Writable<boolean>;
    is_exporting: Writable<boolean>;
    private is_loading: boolean = false;

    constructor() {
        this.data = writable({ ...DEFAULT_CONFIG_FIELDS });
        this.mirrors = writable([]);
        this.fetching_token = writable(false);
        this.authenticated = writable(false);
        this.is_exporting = writable(false);
        this.load();
    }

    get subscribe() {
        return this.data.subscribe;
    }

    async load() {
        this.is_loading = true;

        const config_data = await window.api.invoke("config:get");
        const mirrors_data = await window.api.invoke("mirrors:get");

        this.data.set(config_data);
        this.mirrors.set(mirrors_data);

        await this.update_access_token();

        this.is_loading = false;
    }

    async set<K extends keyof StuffConfig>(key: K, value: StuffConfig[K]): Promise<boolean> {
        if (this.is_loading) {
            return false;
        }

        if (key == "lazer_mode" && value == true) {
            const lazer_path = this.get("lazer_path");
            if (!string_is_valid(lazer_path)) {
                show_notification({ type: "warning", text: "missing lazer path!!" });
                return false;
            }
        }

        // update store
        this.data.update((config) => ({ ...config, [key]: value }));

        // update main process data
        await window.api.invoke("config:save", { [key]: value });

        // update access token if credentials changed
        if (key == "osu_id" || key == "osu_secret") {
            await this.update_access_token();
        }

        return true;
    }

    get<K extends keyof StuffConfig>(key: K): StuffConfig[K] {
        return get(this.data)[key] ?? null;
    }

    is_authenticated(): boolean {
        return get(this.authenticated);
    }

    get_all() {
        return get(this.data);
    }

    validate_paths(): { valid: boolean; missing: string[] } {
        const missing: string[] = [];
        const current_config = get(this.data);

        if (current_config.lazer_mode) {
            if (!string_is_valid(current_config.lazer_path)) {
                missing.push("lazer path");
            }
        } else {
            if (!string_is_valid(current_config.stable_path)) {
                missing.push("stable path");
            }
        }

        return {
            valid: missing.length == 0,
            missing
        };
    }

    async update_access_token() {
        if (get(this.fetching_token)) {
            return;
        }

        this.fetching_token.set(true);

        try {
            const id = this.get("osu_id");
            const secret = this.get("osu_secret");

            if (!id || !string_is_valid(secret)) {
                console.warn("skipping auth (invalid id / secret):", id, secret);
                this.authenticated.set(false);
                return;
            }

            const result = await window.api.invoke("web:authenticate", {
                type: "v2",
                client_id: id,
                client_secret: secret,
                scopes: ["public"]
            });

            if (typeof result == "string") {
                this.authenticated.set(true);
                return;
            }

            if (result.error) {
                this.authenticated.set(false);
                show_failed_auth_warn();
                return;
            }

            this.authenticated.set(true);
        } catch (err) {
            console.error("failed to login:", err as string);
            show_failed_auth_warn();
            this.authenticated.set(false);
        } finally {
            this.fetching_token.set(false);
        }
    }
}

// global config
export const config = new ConfigStore();
