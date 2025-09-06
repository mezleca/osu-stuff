import { BaseDatabase } from "./database.js";
import { get_app_path } from "./utils.js";

let mirrors_db = null;

export class MirrorsDatabase extends BaseDatabase {
    constructor() {
        super("mirrors.db", get_app_path());
        this.mirrors = [];
    }

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
        this.load_mirrors();
    }

    load_mirrors() {
        const mirrors = this.get_statement("get_all").all();
        if (mirrors) {
            this.mirrors = mirrors;
        }
    }

    insert_mirror(name, url) {
        const result = this.get_statement("insert").run(name, url);
        this.load_mirrors(); // refresh mirrors
        return result;
    }

    delete_mirror(name) {
        const result = this.get_statement("delete").run(name);
        this.load_mirrors(); // refresh mirrors
        return result;
    }

    get_mirrors() {
        return this.mirrors;
    }
}

export const initialize_mirrors = () => {
    mirrors_db = new MirrorsDatabase();
    mirrors_db.initialize();
    return mirrors_db;
};

export const insert_mirror = (name, url) => {
    return mirrors_db?.insert_mirror(name, url);
};

export const delete_mirror = (name) => {
    return mirrors_db?.delete_mirror(name);
};

export const get_mirrors = () => {
    return mirrors_db?.get_mirrors();
};

export const update_mirrors = () => {
    return mirrors_db?.load_mirrors();
};
