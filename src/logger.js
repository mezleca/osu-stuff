import fs from "fs";
import path from "path";

export const create_logger = (config = { name: "default", show_date: true, save_to_path: null }) => {

    const get_formatted_date = () => {
        
        const date = new Date();
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const format_value = (value) => {

        if (Array.isArray(value)) {
            return value.map((item) => format_value(item)).join(", ");
        } else if (typeof value === "object" && value !== null) {
            return JSON.stringify(value, null, 2);
        }

        return String(value);
    };

    const format_message = (level, ...messages) => {
        const date_string = config.show_date ? `[${get_formatted_date()}] ` : "";
        const formatted_message = messages.map((msg) => format_value(msg)).join(" ");
        return `${date_string}[${level}]: ${formatted_message}`;
    };

    const write_to_file = (formatted_message) => {

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
        info: (...args) => {
            const formatted = format_message("INFO", ...args);
            console.log(formatted);
            write_to_file(formatted);
        },
        
        warn: (...args) => {
            const formatted = format_message("WARN", ...args);
            console.warn(formatted);
            write_to_file(formatted);
        },
        
        error: (...args) => {
            const formatted = format_message("ERROR", ...args);
            console.error(formatted);
            write_to_file(formatted);
        },
        
        debug: (...args) => {
            const formatted = format_message("DEBUG", ...args);
            console.debug(formatted);
            write_to_file(formatted);
        }
    };
};
