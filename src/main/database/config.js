import path from "path";
import fs from "fs";

import { BaseDatabase } from "./database.js";
import { get_app_path, get_osu_path } from "./utils.js";

// singleton instance
let config_db = null;

export let config = {};

const CONFIG_KEYS = [
    "osu_id",
    "osu_secret",
    "stable_path",
    "stable_songs_path",
    "lazer_path",
    "export_path",
    "local_images",
    "lazer_mode",
    "radio_volume"
];

export class ConfigDatabase extends BaseDatabase {
    constructor() {
        super("config.db", get_app_path());
        this.config = {
            osu_id: null,
            osu_secret: null,
            stable_path: null,
            stable_songs_path: null,
            lazer_path: null,
            export_path: null,
            local_images: false,
            lazer_mode: false,
            radio_volume: null
        };
    }

    create_tables() {
        this.exec(`
            CREATE TABLE IF NOT EXISTS config (
                id INTEGER PRIMARY KEY DEFAULT 1,
                osu_id INTEGER,
                osu_secret TEXT,
                stable_path TEXT,
                stable_songs_path TEXT,
                lazer_path TEXT,
                export_path TEXT,
                local_images INTEGER,
                lazer_mode INTEGER,
                radio_volume INTEGER
            );
        `);
    }

    prepare_statements() {
        this.prepare_statement("get_config", "SELECT * FROM config WHERE id = 1");
        this.prepare_statement("count_rows", "SELECT COUNT(*) as count FROM config");
        this.prepare_statement("insert_default", "INSERT INTO config (id) VALUES (1)");
    }

    post_initialize() {
        this.ensure_config_row();
        this.load_config();
    }

    ensure_config_row() {
        const row_count = this.get_statement("count_rows").get().count;

        if (row_count == 0) {
            this.get_statement("insert_default").run();
        }
    }

    load_config() {
        const config_obj = this.get_statement("get_config").get();

        if (!config_obj) {
            return;
        }

        // load values from db into config object
        for (const [key, value] of Object.entries(config_obj)) {
            if (key == "local_images" || key == "lazer_mode") {
                this.config[key] = Boolean(value);
                continue;
            }
            this.config[key] = value;
        }

        // setup export path if empty
        if (!this.config.export_path || this.config.export_path == "") {
            this.update({ export_path: path.resolve(get_app_path(), "exports") });
        }
    }

    async setup_default_paths() {
        const config_obj = this.get_statement("get_config").get();

        // we already have the default stable path
        if (config_obj.stable_path && config_obj.stable_path != "") {
            return;
        }

        const osu_path_result = await get_osu_path();
        const osu_path = osu_path_result?.stable_path;
        const lazer_path = osu_path_result?.lazer_path;

        if (osu_path && osu_path != "") {
            this.update({ stable_path: osu_path, lazer_mode: this.config.lazer_mode ?? false });

            const stable_songs_path = path.resolve(osu_path, "Songs");

            if (fs.existsSync(stable_songs_path)) {
                this.update({ stable_songs_path });
            }
        }

        if (lazer_path) {
            this.update({ lazer_path, lazer_mode: this.config.lazer_mode ?? false });
        }
    }

    update(values) {
        console.log("updating", values);
        const keys = Object.keys(values).filter((k) => CONFIG_KEYS.includes(k));

        if (keys.length == 0) {
            console.log("[config] no valid keys to update");
            return;
        }

        const clause = keys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");
        const statement = this.database.prepare(`
            INSERT INTO config (id, ${keys.join(", ")}) 
            VALUES (1, ${keys.map(() => "?").join(", ")})
            ON CONFLICT(id) DO UPDATE SET ${clause}
        `);

        const params = keys.map((k) => {
            const value = typeof values[k] == "boolean" ? Number(values[k]) : values[k];
            this.config[k] = values[k];
            return value;
        });

        statement.run(...params);
    }

    get() {
        return this.config;
    }
}

export const initialize_config = async () => {
    config_db = new ConfigDatabase();
    config_db.initialize();
    await config_db.setup_default_paths();

    // update the exported config
    config = config_db.config;

    return config_db;
};

export const update_config_database = (obj) => {
    return config_db?.update(obj);
};

export const get_config_database = () => {
    return config_db?.get();
};
