import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export abstract class BaseDatabase {
    initialized: boolean = false;
    recreated: boolean = false;
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

    private create_db_file = () => {
        fs.writeFileSync(this.database_path, "");
        fs.chmodSync(this.database_path, 0o666);
    };

    connect_and_initialize() {
        // create empty shit to prevent more errors
        if (!fs.existsSync(this.database_path)) {
            this.create_db_file();
        }

        // create new sqlite instance
        this.instance = new Database(this.database_path);

        this.create_tables();

        // TODO: rn if we find anything related to statements error, we just delete the old one
        // in the near future, migration or something would be cool (if its a column update issue)
        const statements_result = this.prepare_statements();

        // TOFIx: too hacky
        if (!statements_result && !this.recreated) {
            console.log("attempting to recreate db file");
            fs.rmSync(this.database_path, { force: true });

            this.recreated = true;

            this.create_db_file();
            this.connect_and_initialize();
        }

        this.initialize();
        this.post_initialize();
    }

    abstract initialize(): void;
    abstract create_tables(): void;
    abstract prepare_statements(): boolean;
    abstract post_initialize(): void;

    prepare_statement(name: string, sql: string) {
        try {
            this.statements[name] = this.instance.prepare(sql);
            return this.statements[name];
        } catch (err) {
            console.log("failed to prepare statment:", err);
        }
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
