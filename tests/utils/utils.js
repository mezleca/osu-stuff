import fs from "fs";
import path from "path";

import { $ } from "bun";

export const TEST_TARGET_PATH = path.resolve(__dirname, "..", ".temp");

export const create_temp_path = () => {
    if (!fs.existsSync(TEST_TARGET_PATH)) {
        fs.mkdirSync(TEST_TARGET_PATH);
    }
};

export const clean_test_path = async () => {
    // ensure path acutally exists
    if (!fs.existsSync(TEST_TARGET_PATH)) {
        create_temp_path();
        return;
    }

    let result = "";

    if (process.platform == "win32") {
        result = await $`powershell -Command "Remove-Item '${TEST_TARGET_PATH}\\*' -Force -Recurse -ErrorAction SilentlyContinue"`.text();
    } else {
        result = await $`rm ${TEST_TARGET_PATH}/*`.text();
    }
};
