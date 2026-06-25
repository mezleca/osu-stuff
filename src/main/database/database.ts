import Database, { type Statement } from "better-sqlite3";
import fs from "fs";
import path from "path";

export type columnType = "TEXT" | "INTEGER" | "REAL" | "BLOB" | "BOOLEAN";

export type columnDef = {
    type: columnType;
    nullable: boolean;
    primary?: boolean;
    default?: unknown;
};

export type dbSchema<T> = {
    [K in keyof T]: columnDef;
};

export class DatabaseManager {
    private static instance: Database.Database;

    static connect = (location: string): Database.Database => {
        const base_dir = path.dirname(location);
        // ensure the path actually exists so write dont fail :)
        fs.mkdirSync(base_dir, { recursive: true, mode: 0o777 });
        fs.chmodSync(base_dir, 0o777);

        // create new instance
        if (!this.instance) {
            this.instance = new Database(location);
            this.instance.pragma("journal_mode = WAL");
            this.instance.pragma("foreign_keys = ON");
        }

        return this.instance;
    };

    static get = (): Database.Database => {
        if (!this.instance) {
            throw Error("database: database not connected");
        }

        return this.instance;
    };

    static close = (): void => {
        this.instance?.close();
    };
}

export abstract class BaseTable<T extends object> {
    protected db: Database.Database | undefined;
    protected statements: Record<string, Database.Statement> = {};

    abstract readonly name: string;
    abstract readonly schema: dbSchema<T>;

    abstract initialize(): void | Promise<void>;

    create_table = () => {
        const parts: string[] = [];

        for (const [name, def] of Object.entries(this.schema)) {
            const data = def as columnDef;
            let part = `${name} ${this.to_type(data.type)}`;

            if (data?.primary) {
                part += " PRIMARY KEY";
            }

            if (data?.default != undefined) {
                part += ` DEFAULT ${this.to_value(data.default, data.type)}`;
            }

            if (!data?.nullable) {
                if (data?.default == undefined) throw Error(`database: missing default value for ${name}`);
                part += " NOT NULL";
            }

            parts.push(part);
        }

        this.get_db().exec(`
            CREATE TABLE IF NOT EXISTS ${this.name} (${parts.join(", ")})
        `);

        this.prepare("clear", `DELETE FROM ${this.name}`);
    };

    update(data: Partial<T>): void {
        const keys = Object.keys(data);
        const placeholders = keys.map((_) => "?");
        const set_clause = keys.map((k) => `${k} = EXCLUDED.${k}`).join(", ");

        const statement = this.get_db().prepare(`
            INSERT INTO ${this.name} (${keys.join(", ")})
            VALUES(${placeholders})
            ON CONFLICT DO UPDATE SET ${set_clause}
        `);

        statement.run(this.to_values(data));
    }

    to_type = (_type: columnType) => {
        if (_type == "BOOLEAN") {
            return "INTEGER";
        }

        return _type;
    };

    to_values = (data: Record<string, unknown>) => {
        const result: unknown[] = [];

        for (const [, value] of Object.entries(data)) {
            if (typeof value === "boolean") {
                result.push(Number(value));
            } else {
                result.push(value);
            }
        }

        return result;
    };

    to_value = (value: unknown, _type?: columnType) => {
        if (_type == "BOOLEAN" || typeof value == "boolean") {
            return Number(value);
        }

        if (_type == "TEXT" || typeof value == "string") {
            return `'${value}'`;
        }

        return value;
    };

    reinitialize = async (): Promise<void> => {
        await this.initialize();
    };

    clear = () => {
        return this.statements["clear"]!.run();
    };

    protected prepare = (name: string, sql: string): Statement => {
        this.statements[name] = this.get_db().prepare(sql);
        return this.statements[name];
    };

    protected stmt = (name: string): Statement | undefined => {
        return this.statements[name];
    };

    protected get_db = (): Database.Database => {
        if (!this.db) {
            this.db = DatabaseManager.get();
        }

        return this.db;
    };
}
