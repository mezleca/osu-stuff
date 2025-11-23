import path from "path";
import fs from "fs";

// NOTE: pretty sure you can achieve this by simply using the yml file...
export default async (ctx: any) => {
    const dir = path.resolve(ctx.appOutDir);
    const result = fs.readdirSync(dir);
    const node_extra_folder = path.resolve(dir, "resources", "app.asar.unpacked", "node_modules");

    // remove unecessary node_modules
    if (fs.existsSync(node_extra_folder)) {
        console.log("[cleanup] removing", node_extra_folder);
    }

    for (const file of result) {
        // remove unecessary license files
        if (file.startsWith("LICENSE")) {
            console.log("[cleanup] removing", file);
            fs.rmSync(path.resolve(dir, file));
        }
    }
};
