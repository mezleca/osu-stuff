const path = require("path");
const fs = require("fs");
const os = require("os");

const { exec } = require("child_process");

import { database } from "../database/indexed.js";

const is_subpath = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

export const validate_path = async (target_path, allowed_base, db_name = "config", key_name = "stable_path") => {

    if (!target_path) {
        return false;
    }
    
    if (allowed_base) {
        return is_subpath(allowed_base, target_path);
    }
    
    try {

        const base_path = await database.get(db_name, key_name);

        if (!base_path) {
            return false;
        }
        
        return is_subpath(base_path, target_path);
    } catch (err) {
        return false;
    }
};

export const check_folder_permissions = async (folder) => {

    try {

        const test_file = path.join(folder, `test-${Date.now()}.tmp`);
        const test_file_renamed = path.join(folder, "renamed-test.tmp");

        fs.writeFileSync(test_file, "test");
        fs.readFileSync(test_file);
        fs.renameSync(test_file, test_file_renamed);
        fs.unlinkSync(test_file_renamed);

        const first_file = fs.readdirSync(folder)[0];

        if (first_file) {
            const file_path = path.join(folder, first_file);
            const stats = fs.statSync(file_path);
            const is_dir = (stats.mode & 0o170000) == 0o040000;
            const temp_name = path.join(folder, is_dir ? "stufttest0101" : "renamed-test.tmp");
            fs.renameSync(file_path, temp_name);
            fs.renameSync(temp_name, file_path);
        }

        return true;
    } catch (err) {
        console.log("folder perm error:", err);
        return false;
    }
};

export const get_linux_path = async () => {
    
    const default_path = path.join(os.homedir(), '.local', 'share', 'osu-wine', 'osu!');
    const custom_path = path.join(os.homedir(), ".local/share/osuconfig/osupath");

    if (fs.existsSync(default_path)) {
        return "";
    }

    const result = await new Promise((resolve, reject) => {

        exec(`[ -e "$HOME/.local/share/osuconfig/osupath" ] && echo "1" || echo "0"`, (err, stdout, stderr) => {

            if (err) {
                return resolve("");
            }

            if (stderr) {
                return resolve("");
            }

            if (stdout.trim() == "1" && fs.existsSync(custom_path)) {
                return resolve(fs.readFileSync(custom_path, "utf-8").split("\n")[0]);
            }
            
            return resolve("");
        });
    });

    return result;
};
