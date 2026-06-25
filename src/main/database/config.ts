import { BaseTable, dbSchema } from "./database";
import { get_app_path, get_osu_path } from "../utils";
import { type ManagerConfig } from "@shared/types";

import path from "path";
import fs from "fs";

export class ConfigDB extends BaseTable<ManagerConfig> {
    readonly name = "config";
    readonly schema: dbSchema<ManagerConfig> = {
        _id: { type: "INTEGER", primary: true, default: 1, nullable: false },
        osu_id: { type: "INTEGER", nullable: true },
        osu_secret: { type: "TEXT", nullable: true },
        stable_path: { type: "TEXT", nullable: true },
        stable_songs_path: { type: "TEXT", nullable: true },
        lazer_path: { type: "TEXT", nullable: true },
        lazer_mode: { type: "BOOLEAN", nullable: true },
        radio_background: { type: "BOOLEAN", nullable: true },
        radio_volume: { type: "INTEGER", default: 50, nullable: true },
        local_images: { type: "BOOLEAN", default: false, nullable: true },
        export_path: { type: "TEXT", default: path.resolve(get_app_path(), "exports"), nullable: true }
    };

    initialize(): void {
        this.create_table();
        this.prepare("get", "SELECT * FROM config WHERE _id = 1");

        // ensure default row exists
        this.update({ _id: 1 });
        this.setup_default_paths();
    }

    get(): ManagerConfig {
        const raw = this.stmt("get")!.get() as ManagerConfig | undefined;

        if (!raw) {
            this.update({ _id: 1 });
        }

        const data = (raw ?? (this.stmt("get")!.get() as ManagerConfig)) || ({} as ManagerConfig);

        return {
            _id: data._id ?? 1,
            osu_id: data.osu_id ?? "",
            osu_secret: data.osu_secret ?? "",
            stable_path: data.stable_path ?? "",
            stable_songs_path: data.stable_songs_path ?? "",
            lazer_path: data.lazer_path ?? "",
            export_path: data.export_path ?? path.resolve(get_app_path(), "exports"),
            local_images: Boolean(data.local_images),
            lazer_mode: Boolean(data.lazer_mode),
            radio_background: data.radio_background != undefined ? Boolean(data.radio_background) : true,
            radio_volume: data.radio_volume ?? 50
        };
    }

    update(data: Partial<ManagerConfig>): boolean {
        try {
            super.update({ _id: 1, ...data });
            return true;
        } catch (error) {
            console.error("[config] failed to update:", error);
            return false;
        }
    }

    load = async (): Promise<boolean> => {
        try {
            await this.initialize();
            return true;
        } catch (error) {
            console.error("[config] failed to load:", error);
            return false;
        }
    };

    setup_default_paths = async (): Promise<void> => {
        if (process.env["NODE_ENV"] == "test") {
            return;
        }

        const current_config = this.get();
        const has_stable = !!current_config.stable_path;
        const has_lazer = !!current_config.lazer_path;

        if (has_stable || has_lazer) {
            return;
        }

        console.warn("config(manager): attempting to auto detect osu! installation");

        const osu_path_result = await get_osu_path();

        if (!osu_path_result.success) {
            console.error("failed to get osu path");
            return;
        }

        const { stable_path, lazer_path } = osu_path_result.data;

        if (stable_path != "") {
            console.log("config(manager): found osu! stable at", stable_path);
            this.update({ stable_path, lazer_mode: current_config?.lazer_mode ?? false });

            const songs_path = path.resolve(stable_path, "Songs");

            if (fs.existsSync(songs_path)) {
                this.update({ stable_songs_path: songs_path });
            }
        }

        if (lazer_path) {
            console.log("config(manager): found osu! lazer at", lazer_path);
            this.update({ lazer_path, lazer_mode: current_config?.lazer_mode ?? false });
        }
    };
}

export const config = new ConfigDB();
