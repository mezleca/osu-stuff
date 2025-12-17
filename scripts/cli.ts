import { spawn, build } from "bun";
import type { Subprocess } from "bun";
import { cp, rm, mkdir, readFile, writeFile } from "fs/promises";
import { existsSync, watch } from "fs";
import { execSync } from "child_process";

import svelte_plugin from "./plugins/svelte";
import path from "path";

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

let vite_process: Subprocess | null = null;
let electron_process: Subprocess | null = null;
let is_restarting = false;

const kill_process_tree = async (proc: Subprocess | null) => {
    if (!proc || proc.exitCode !== null) return;

    const pid = proc.pid;
    if (!pid) {
        proc.kill("SIGKILL");
        return;
    }

    try {
        if (process.platform === "win32") {
            execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
        } else {
            process.kill(-pid, "SIGTERM");
            await Promise.race([proc.exited, new Promise((r) => setTimeout(r, 1500))]);
            try {
                process.kill(-pid, "SIGKILL");
            } catch {}
        }
    } catch (e) {
        console.log(`[script] process ${pid} probably already dead`);
    }

    try {
        await proc.exited;
    } catch {}
};

const free_port_5173 = () => {
    if (process.platform === "win32") {
        try {
            const output = execSync("netstat -ano | findstr :5173", { stdio: "pipe" }).toString();
            const lines = output.trim().split("\n");
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim()) continue;
                const parts = line.trim().split(/\s+/);
                const pid_str = parts[parts.length - 1];
                const pid = parseInt(pid_str, 10);
                if (isNaN(pid) || pid === 0) continue;
                console.log(`[script] killing old process on port 5173 (PID ${pid})`);
                execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
            }
        } catch {}
    } else {
        try {
            execSync("lsof -t -i:5173 | xargs -r kill -9", { stdio: "ignore" });
        } catch {}
    }
};

const cleanup = async () => {
    console.log("[script] cleaning up processes...");
    const tasks: Promise<void>[] = [];
    if (vite_process) tasks.push(kill_process_tree(vite_process));
    if (electron_process) tasks.push(kill_process_tree(electron_process));
    await Promise.all(tasks);

    vite_process = null;
    electron_process = null;
};

const handle_signal = async () => {
    await cleanup();
    process.exit(0);
};

process.on("SIGINT", handle_signal);
process.on("SIGTERM", handle_signal);
process.on("exit", () => {
    if (vite_process && vite_process.exitCode === null) vite_process.kill("SIGKILL");
    if (electron_process && electron_process.exitCode === null) electron_process.kill("SIGKILL");
});

process.on("uncaughtException", async (err) => {
    console.error("[script] uncaught exception:", err);
    await cleanup();
    process.exit(1);
});

process.on("unhandledRejection", async (err) => {
    console.error("[script] unhandled rejection:", err);
    await cleanup();
    process.exit(1);
});

const bundle = async (config: any) => {
    console.log(`[build] building ${config.label}...`);
    const result = await build({
        ...config,
        sourcemap: IS_DEV ? "inline" : "none",
        minify: !IS_DEV
    });
    if (!result.success) {
        console.error(`[build] failed (${config.label})`, result.logs);
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

const start_electron = async (dev: boolean) => {
    if (electron_process) {
        is_restarting = true;
        await kill_process_tree(electron_process);

        try {
            await electron_process.exited;
            if (process.platform === "win32") {
                await new Promise((r) => setTimeout(r, 800));
            }
        } catch {}
    }

    const env: any = {
        ...process.env,
        NODE_ENV: dev ? "development" : "production"
    };
    if (dev) env.ELECTRON_RENDERER_URL = "http://localhost:5173";

    electron_process = spawn(["bunx", "electron", "."], {
        stdout: "inherit",
        stderr: "inherit",
        env
    });

    const current_process = electron_process;
    is_restarting = false;

    current_process.exited.then(async () => {
        if (is_restarting && electron_process !== current_process) return;

        if (!is_restarting) {
            console.log("[script] electron closed, exiting...");
            await cleanup();
            process.exit(0);
        }
    });
};

const dev = async () => {
    await clean();
    free_port_5173();

    console.log("[script] starting vite...");

    vite_process = spawn(["bunx", "vite", "dev", "--port", "5173", "--strictPort"], {
        stdout: "inherit",
        stderr: "inherit"
    });

    await new Promise((r) => setTimeout(r, 2000));

    if (vite_process.exitCode !== null) {
        console.error("[script] vite failed to start");
        process.exit(1);
    }

    await build_main();
    await build_preload();
    await start_electron(true);

    watch(path.join(PATHS.ROOT, "src/renderer"), { recursive: true }, () => {});
};

const build_all = async () => {
    await clean();
    await build_main();
    await build_preload();
    await build_renderer();
};

(async () => {
    try {
        if (IS_DEV) {
            await dev();
        } else if (IS_START) {
            await build_all();
            await start_electron(false);
        } else {
            await build_all();
        }
    } catch (error) {
        console.error("[script] fatal error:", error);
        await cleanup();
        process.exit(1);
    }
})();
