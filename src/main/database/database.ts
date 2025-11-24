import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export abstract class BaseDatabase {
    initialized: boolean = false;
    database_name: string = "";
    app_path: string = "";
    database_path: string = "";
    instance: any;
    statements: any;

    constructor(database_name: string, app_path: string) {
        if (this.initialized) {
            return;
        }

        this.database_name = database_name;
        this.app_path = app_path;
        this.database_path = path.resolve(app_path, database_name);
        this.statements = {};

        console.log({ database_name, app_path });

        if (!this.app_path || this.app_path == "") {
            throw new Error("BaseDatabase -> initialize(): 'app_path' is required but was not provided.");
        }

        // ensure app_path dir exists so write dont fail :)
        fs.mkdirSync(this.app_path, { recursive: true, mode: 0o777 });

        // explicitly ensure write permissions (mode in mkdirSync doesn't always work with recursive)
        try {
            fs.chmodSync(this.app_path, 0o777);
        } catch (err) {
            console.warn(`failed to chmod ${this.app_path}:`, err);
        }

        try {
            this.connect_and_initialize();
        } catch (error) {
            console.error(`[${this.database_name}] failed to initialize database, resetting...`, error);
            this.close();

            if (fs.existsSync(this.database_path)) {
                fs.unlinkSync(this.database_path);
            }

            this.connect_and_initialize();
        }

        this.initialized = true;
    }

    connect_and_initialize() {
        // create empty shit to prevent more errors
        if (!fs.existsSync(this.database_path)) {
            fs.writeFileSync(this.database_path, "");
            // ensure write permissions for sqlite
            fs.chmodSync(this.database_path, 0o666);
        }

        // create new sqlite instance
        this.instance = new Database(this.database_path);

        this.create_tables();
        this.prepare_statements();
        this.initialize();
        this.post_initialize();
    }

    abstract initialize(): void;
    abstract create_tables(): void;
    abstract prepare_statements(): void;
    abstract post_initialize(): void;

    prepare_statement(name: string, sql: string) {
        this.statements[name] = this.instance.prepare(sql);
        return this.statements[name];
    }

    get_statement(name: string) {
        return this.statements[name];
    }

    exec(sql: string) {
        return this.instance.exec(sql);
    }

    close() {
        if (this.instance) {
            this.instance.close();
        }
    }

    reinitialize() {
        this.close();
        this.initialized = false;
        this.statements = {};

        try {
            this.connect_and_initialize();
        } catch (error) {
            console.error(`[${this.database_name}] failed to reinitialize database, resetting...`, error);
            this.close();

            if (fs.existsSync(this.database_path)) {
                fs.unlinkSync(this.database_path);
            }

            this.connect_and_initialize();
        }

        this.initialized = true;
    }
}
