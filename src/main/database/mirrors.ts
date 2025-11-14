import { StuffMirror } from "@shared/types.js";
import { BaseDatabase } from "./database.js";
import { get_app_path } from "./utils.js";

export class MirrorsDatabase extends BaseDatabase {
    data: StuffMirror[] = [];

    constructor() {
        super("mirrors.db", get_app_path());
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
        this.prepare_statement("get_all", "SELECT * FROM mirrors");

        this.prepare_statement(
            "insert",
            `
            INSERT OR REPLACE INTO mirrors
            (name, url)
            VALUES(?, ?)
        `
        );

        this.prepare_statement(
            "delete",
            `
            DELETE FROM mirrors WHERE name = ?    
        `
        );
    }

    post_initialize() {
        this.load();
    }

    load() {
        const mirrors = this.get_statement("get_all").all();

        if (mirrors) {
            this.data = mirrors;
        }
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
        return this.data;
    }
}

export const mirrors = new MirrorsDatabase();
