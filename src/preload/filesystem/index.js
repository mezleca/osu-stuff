const path = require("path");
const fs = require("fs");

import { validate_path } from "../utils/validator.js";
import { database } from "../database/indexed.js";

export const stuff_fs = {
    existsSync: (path) => fs.existsSync(path),
    mkdirSync: (path, options) => fs.mkdirSync(path, options),
    readdirSync: (path, options) => fs.readdirSync(path, options),
    unlinkSync: (path) => fs.unlinkSync(path),
    rmdirSync: (path, options) => fs.rmdirSync(path, options),
    renameSync: (a, b) => fs.renameSync(a, b),

    save_exported: async (name, buffer) => {

        const _path = await database.get("config", "export_path");
        
        if (!_path) {
            throw new Error("export path not configured");
        }
        
        const full_path = path.resolve(_path, name);
        const is_valid = await validate_path(full_path, _path);

        if (!is_valid) {
            throw new Error("invalid export path");
        }
        
        fs.writeFileSync(full_path, Buffer.from((buffer)));
    },
    
    save_osu_file: async (buffer) => {

        const base = await database.get("config", "stable_path");
        
        if (!base) {
            throw new Error("stable path not configured");
        }
        
        const full_path = path.resolve(base, "osu!.db");
        const is_valid = await validate_path(full_path, base);

        if (!is_valid) {
            throw new Error("invalid osu file path");
        }
        
        fs.writeFileSync(full_path, Buffer.from(buffer));
    },
    
    statSync: (path, options) => {

        const stat = fs.statSync(path, options);

        return {
            isFile: () => stat.isFile(),
            isDirectory: () => stat.isDirectory(),
            size: stat.size,
            mtime: stat.mtime,
            ctime: stat.ctime,
            birthtime: stat.birthtime
        };
    },
    
    save_collection_file: async (buffer, _path) => {

        if (!buffer) {
            throw new Error("missing buffer");
        }

        const base = await database.get("config", "stable_path");
        
        if (!base) {
            throw new Error("stable path not configured");
        }
        
        if (!_path) {

            const backup_name = `collection_backup_${Date.now()}.db`;
            const old_name = path.resolve(base, "collection.db"), 
                new_name = path.resolve(base, backup_name);
            
            const is_valid_old = await validate_path(old_name, base);
            const is_valid_new = await validate_path(new_name, base);
            
            if (!is_valid_old || !is_valid_new) {
                throw new Error("invalid collection backup path");
            }
            
            if (fs.existsSync(old_name)) {
                fs.renameSync(old_name, new_name);
            }
            
            fs.writeFileSync(old_name, Buffer.from(buffer));
        } else {

            const is_valid = await validate_path(_path, base);

            if (!is_valid) {
                throw new Error("invalid collection path");
            }
            
            fs.writeFileSync(_path, Buffer.from(buffer));
        }
    },
    
    get_osu_file: (file) => {

        const ext = path.extname(file);
        
        if (ext != ".osu") {
            return null;
        }
        
        return fs.readFileSync(file, "utf-8");
    },
    
    get_osu_files: async () => {

        const base = await database.get("config", "stable_path");
        
        if (!base) {
            throw new Error("Stable path not configured");
        }
        
        const db_path = path.join(base, "osu!.db");
        const cl_path = path.join(base, "collection.db");
        
        const is_valid_db = await validate_path(db_path, base);
        const is_valid_cl = await validate_path(cl_path, base);
        
        if (!is_valid_db || !is_valid_cl) {
            throw new Error("invalid osu files path");
        }
        
        const db_file = fs.readFileSync(db_path);
        const cl_file = fs.readFileSync(cl_path);
        
        return { db: db_file, cl: cl_file };
    }
};
