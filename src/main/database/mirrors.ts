import { ManagerMirror } from "@shared/types.js";
import { BaseTable, dbSchema } from "./database.js";
import { beatmap_downloader } from "../osu/downloader.js";

const DEFAULT_MIRROR_NAME = "";
const DEFAULT_MIRROR_URL = "";

export class MirrorDB extends BaseTable<ManagerMirror> {
    readonly name = "mirrors";
    readonly schema: dbSchema<ManagerMirror> = {
        name: { type: "TEXT", primary: true, nullable: false, default: DEFAULT_MIRROR_NAME },
        url: { type: "TEXT", nullable: false, default: DEFAULT_MIRROR_URL }
    };

    initialize(): void {
        this.create_table();

        this.prepare("get_all", `SELECT * FROM ${this.name}`);
        this.prepare("insert", `INSERT OR REPLACE INTO ${this.name} (name, url) VALUES(?, ?)`);
        this.prepare("delete", `DELETE FROM ${this.name} WHERE name = ?`);
    }

    _update(): void {
        if (beatmap_downloader.is_initialized()) {
            beatmap_downloader.update_mirrors();
        }
    }

    get(): ManagerMirror[] {
        const result = this.stmt("get_all")!.all() ?? [];
        return result as ManagerMirror[];
    }

    insert(name: string, url: string): void {
        this.stmt("insert")!.run(name, url);
        this._update();
    }

    update(data: Partial<ManagerMirror>): boolean {
        try {
            if (!data.name || !data.url) {
                return false;
            }

            this.insert(data.name, data.url);
            return true;
        } catch (error) {
            console.error("[mirrors] failed to update:", error);
            return false;
        }
    }

    delete(name: string): boolean {
        try {
            this.stmt("delete")!.run(name);
            this._update();
            return true;
        } catch (error) {
            console.error("[mirrors] failed to delete:", error);
            return false;
        }
    }

    load = async (): Promise<boolean> => {
        try {
            this.initialize();
            return true;
        } catch (error) {
            console.error("[mirrors] failed to load:", error);
            return false;
        }
    };
}

export const mirrors = new MirrorDB();
