export type LoggerConfig = {
    name: string;
    show_date: boolean;
    save_to_path: {
        path: string;
    } | null;
};

export type Logger = {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
};
