import fs from "fs";
import path from "path";

// @TOFIX: move to shared later
type LoggerConfig = {
    name: string;
    show_date: boolean;
    save_to_path: {
        path: string;
    } | null;
};

type Logger = {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
};

export const create_logger = (
    config: LoggerConfig = {
        name: "default",
        show_date: true,
        save_to_path: null
    }
): Logger => {
    const get_formatted_date = (): string => {
        const date = new Date();
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    };

    const format_value = (value: unknown): string => {
        if (Array.isArray(value)) {
            return value.map((item) => format_value(item)).join(", ");
        } else if (typeof value == "object" && value != null) {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    };

    const format_message = (level: string, ...messages: unknown[]): string => {
        const date_string = config.show_date ? `[${get_formatted_date()}] ` : "";
        const formatted_message = messages.map((msg) => format_value(msg)).join(" ");
        return `${date_string}[${level}]: ${formatted_message}`;
    };

    const write_to_file = (formatted_message: string): void => {
        if (!config.save_to_path) {
            return;
        }

        const log_path = path.resolve(config.save_to_path.path, `${config.name}.log`);
        const log_dir = path.dirname(log_path);

        if (!fs.existsSync(log_dir)) {
            fs.mkdirSync(log_dir, { recursive: true });
        }

        if (!fs.existsSync(log_path)) {
            fs.writeFileSync(log_path, "", { encoding: "utf-8" });
        }

        fs.appendFileSync(log_path, formatted_message + "\n");
    };

    return {
        info: (...args: unknown[]): void => {
            const formatted = format_message("INFO", ...args);
            console.log(formatted);
            write_to_file(formatted);
        },
        warn: (...args: unknown[]): void => {
            const formatted = format_message("WARN", ...args);
            console.warn(formatted);
            write_to_file(formatted);
        },
        error: (...args: unknown[]): void => {
            const formatted = format_message("ERROR", ...args);
            console.error(formatted);
            write_to_file(formatted);
        },
        debug: (...args: unknown[]): void => {
            const formatted = format_message("DEBUG", ...args);
            console.debug(formatted);
            write_to_file(formatted);
        }
    };
};
