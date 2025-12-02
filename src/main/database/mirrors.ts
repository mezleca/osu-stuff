import { StuffMirror } from "@shared/types.js";
import { BaseDatabase } from "./database.js";
import { get_app_path } from "./utils.js";

export class MirrorsDatabase extends BaseDatabase {
    data: StuffMirror[] = [];

    constructor() {
        super("mirrors.db", get_app_path());
        this.load();
    }

    initialize() {}

    create_tables() {
        this.exec(`
            CREATE TABLE IF NOT EXISTS mirrors(
                name TEXT PRIMARY KEY,
                url TEXT
            );
        `);
    }

    prepare_statements() {
        if (!this.prepare_statement("get_all", "SELECT * FROM mirrors")) return false;
        if (!this.prepare_statement("insert", `INSERT OR REPLACE INTO mirrors (name, url) VALUES(?, ?)`)) return false;
        if (!this.prepare_statement("delete", `DELETE FROM mirrors WHERE name = ?`)) return false;

        return true;
    }

    post_initialize() {}

    load(): boolean {
        const mirrors = this.get_statement("get_all").all();

        if (mirrors) {
            this.data = mirrors;
        }

        return true;
    }

    delete(name: string) {
        const result = this.get_statement("delete").run(name);
        this.load(); // refresh mirrors
        return result;
    }

    update(name: string, url: string) {
        const result = this.get_statement("insert").run(name, url);
        this.load();
        return result;
    }

    get() {
        return this.data || [];
    }
}

export const mirrors = new MirrorsDatabase();
