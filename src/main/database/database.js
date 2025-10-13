import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export class BaseDatabase {
    constructor(database_name, app_path) {
        this.database_name = database_name;
        this.app_path = app_path;
        this.database_path = path.resolve(app_path, database_name);
        this.database = null;
        this.statements = {};
    }

    initialize() {
        if (!this.app_path || this.app_path == "") {
            throw new Error("BaseDatabase -> initialize(): 'app_path' is required but was not provided.");
        }

        // ensure app_path dir exists so write dont fail :)
        fs.mkdirSync(this.app_path, { recursive: true });

        // create empty shit to prevent more errors
        if (!fs.existsSync(this.database_path)) {
            fs.writeFileSync(this.database_path, "");
        }

        // actually initialize
        this.database = new Database(this.database_path);
        this.create_tables();
        this.prepare_statements();
        this.post_initialize();
    }

    create_tables() {
        throw new Error("create_tables(): not implemented yet");
    }

    prepare_statements() {
        throw new Error("prepare_statements(): not implemented yet");
    }

    // optional
    post_initialize() {}

    prepare_statement(name, sql) {
        this.statements[name] = this.database.prepare(sql);
        return this.statements[name];
    }

    get_statement(name) {
        return this.statements[name];
    }

    exec(sql) {
        return this.database.exec(sql);
    }

    close() {
        if (this.database) {
            this.database.close();
        }
    }
}
