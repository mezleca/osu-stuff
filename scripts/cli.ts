import { spawn, build } from "bun";
import { cp, rm, mkdir, readFile, writeFile } from "fs/promises";
import { existsSync, watch } from "fs";

import path from "path";
import svelte_plugin from "./plugins/svelte";

const ARGS = process.argv.slice(2);
const IS_DEV = ARGS.includes("dev");
const IS_START = ARGS.includes("start");

const PATHS = {
    ROOT: path.resolve(__dirname, ".."),
    OUT: path.resolve(__dirname, "../out"),
    SRC_MAIN: path.resolve(__dirname, "../src/main/index.ts"),
    SRC_PRELOAD: path.resolve(__dirname, "../src/preload/index.ts"),
    SRC_RENDERER: path.resolve(__dirname, "../src/renderer/src/main.ts"),
    HTML_TEMPLATE: path.resolve(__dirname, "../src/renderer/index.html"),
    RESOURCES: path.resolve(__dirname, "../resources")
};

const children: any[] = [];
let electron_proc: any = null;
let is_restarting = false;

const cleanup = async () => {
    const kill_promises = children.map(async (p) => {
        if (!p || p.killed) return;

        try {
            if (process.platform == "win32" && p.pid) {
                await spawn(["taskkill", "/pid", p.pid.toString(), "/T", "/F"]).exited;
            } else {
                p.kill();
            }
        } catch {}
    });

    await Promise.all(kill_promises);
};

process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
});

const bundle = async (config: any) => {
    console.log(`building ${config.label}...`);
    const result = await build({
        ...config,
        sourcemap: IS_DEV ? "inline" : "none",
        minify: !IS_DEV
    });

    if (!result.success) {
        console.error(`build failed (${config.label})`, result.logs);
        if (!IS_DEV) process.exit(1);
    }
};

const clean = async () => {
    if (existsSync(PATHS.OUT)) await rm(PATHS.OUT, { recursive: true, force: true }).catch(() => {});
    await mkdir(PATHS.OUT, { recursive: true });
};

const build_main = () =>
    bundle({
        label: "main",
        entrypoints: [PATHS.SRC_MAIN],
        outdir: path.join(PATHS.OUT, "main"),
        target: "node",
        external: ["electron", "better-sqlite3"],
        tsconfig: "tsconfig.node.json"
    });

const build_preload = () =>
    bundle({
        label: "preload",
        entrypoints: [PATHS.SRC_PRELOAD],
        outdir: path.join(PATHS.OUT, "preload"),
        target: "node",
        external: ["electron"],
        tsconfig: "tsconfig.node.json"
    });

const build_renderer = async () => {
    const assets_src = path.join(PATHS.ROOT, "src/renderer/src/assets");
    if (existsSync(assets_src)) {
        await cp(assets_src, path.join(PATHS.OUT, "renderer/assets"), { recursive: true });
    }

    await bundle({
        label: "renderer",
        entrypoints: [PATHS.SRC_RENDERER],
        outdir: path.join(PATHS.OUT, "renderer"),
        target: "browser",
        plugins: [svelte_plugin]
    });

    let html = await readFile(PATHS.HTML_TEMPLATE, "utf-8");
    html = html.replace(/src="\/src\/main.ts"/, 'src="./main.js"').replace("</head>", '<link rel="stylesheet" href="./main.css">\n</head>');

    await writeFile(path.join(PATHS.OUT, "renderer/index.html"), html);
};

const start_electron = (dev: boolean) => {
    if (electron_proc) {
        is_restarting = true;
        try {
            process.kill(electron_proc.pid);
        } catch {}
    }

    const env: any = {
        ...process.env,
        NODE_ENV: dev ? "development" : "production"
    };

    if (dev) env.ELECTRON_RENDERER_URL = "http://localhost:5173";

    electron_proc = spawn(["bunx", "electron", "."], {
        stdout: "inherit",
        stderr: "inherit",
        env
    });

    const current = electron_proc;
    is_restarting = false;

    electron_proc.exited.then(async (code: number) => {
        if (current != electron_proc) return;
        if (!is_restarting) {
            await cleanup();
            process.exit(0);
        }
    });

    children.push(electron_proc);
};

const dev = async () => {
    await clean();

    children.push(spawn(["bunx", "vite", "dev", "--port", "5173", "--strictPort"], { stdout: "inherit", stderr: "inherit" }));

    await new Promise((r) => setTimeout(r, 2000));
    await build_main();
    await build_preload();
    start_electron(true);

    watch(path.join(PATHS.ROOT, "src"), { recursive: true }, async (_, filename) => {
        if (!filename || filename.startsWith("renderer")) return;

        if (filename.startsWith("preload")) {
            await build_preload();
        } else {
            await build_main();
        }

        start_electron(true);
    });
};

const build_all = async () => {
    await clean();
    await build_main();
    await build_preload();
    await build_renderer();
};

(async () => {
    if (IS_DEV) {
        dev();
    } else if (IS_START) {
        await build_all();
        start_electron(false);
    } else {
        build_all();
    }
})();
