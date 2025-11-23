import path from "path";
import fs from "fs";

import { BaseDatabase } from "./database";
import { get_app_path, get_osu_path } from "./utils";
import { StuffConfig } from "@shared/types";

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
    data: StuffConfig = {
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

    constructor(location: string = get_app_path()) {
        console.log("config location:", location);
        super("config.db", location);
    }

    initialize() {}

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
    }

    ensure_config_row() {
        const row_count = this.get_statement("count_rows").get().count;

        if (row_count == 0) {
            this.get_statement("insert_default").run();
        }
    }

    load() {
        const config_obj = this.get_statement("get_config").get() as StuffConfig;

        if (!config_obj) {
            return false;
        }

        // load values from db into config object
        Object.assign(this.data, config_obj);

        // setup export path if empty
        if (!this.data.export_path || this.data.export_path == "") {
            this.update({ export_path: path.resolve(this.app_path, "exports") });
        }

        return true;
    }

    async setup_default_paths() {
        this.load();
        const config_obj = this.get_statement("get_config").get();

        // we already have the default stable path
        if (config_obj.stable_path && config_obj.stable_path != "") {
            return;
        }

        const osu_path_result = await get_osu_path();

        if (!osu_path_result.success) {
            console.error("failed to get osu path");
            return;
        }

        const { stable_path, lazer_path } = osu_path_result.data;

        if (stable_path != "") {
            this.update({ stable_path, lazer_mode: this.data.lazer_mode ?? false });

            const songs_path = path.resolve(stable_path, "Songs");

            if (fs.existsSync(songs_path)) {
                this.update({ stable_songs_path: songs_path });
            }
        }

        if (lazer_path) {
            this.update({ lazer_path, lazer_mode: this.data.lazer_mode ?? false });
        }
    }

    update(data: Partial<StuffConfig>) {
        const keys = Object.keys(data).filter((k) => CONFIG_KEYS.includes(k)) as Array<keyof StuffConfig>;

        if (keys.length == 0) {
            return false;
        }

        const placeholders = keys.map(() => "?").join(", ");
        const clause = keys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");

        const statement = this.instance.prepare(`
            INSERT INTO config (id, ${keys.join(", ")}) 
            VALUES (1, ${placeholders})
            ON CONFLICT(id) DO UPDATE SET ${clause}
        `);

        const params = keys.map((k) => {
            const value = data[k];
            // convert boolean to number for sqlite
            const db_value = typeof value == "boolean" ? Number(value) : value;
            this.data = { ...this.data, [k]: value };
            return db_value;
        });

        statement.run(...params);

        return true;
    }

    get() {
        return this.data;
    }
}

export const config = new ConfigDatabase();
