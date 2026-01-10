export const is_dev_mode = (): boolean => {
    return process.env?.NODE_ENV == "dev" || process.env?.NODE_ENV == "development";
};
