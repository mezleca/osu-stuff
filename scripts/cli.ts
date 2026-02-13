import { spawn, build } from "bun";
import type { Subprocess } from "bun";
import { rm, mkdir } from "fs/promises";
import { existsSync, watch } from "fs";
import { execSync } from "child_process";
import path from "path";

const ARGS = process.argv.slice(2);
const IS_DEV = ARGS.includes("dev");
const IS_START = ARGS.includes("start");

const PATHS = {
    ROOT: path.resolve(__dirname, ".."),
    OUT: path.resolve(__dirname, "../out"),
    SRC_MAIN: path.resolve(__dirname, "../src/main/index.ts"),
    SRC_PRELOAD: path.resolve(__dirname, "../src/preload/index.ts"),
    RESOURCES: path.resolve(__dirname, "../resources")
};

let vite_process: Subprocess | null = null;
let electron_process: Subprocess | null = null;
let is_restarting = false;

const kill_process_tree = async (proc: Subprocess | null) => {
    if (!proc || proc.exitCode !== null) {
        return;
    }

    const pid = proc.pid;

    if (!pid) {
        proc.kill("SIGKILL");
        return;
    }

    try {
        if (process.platform === "win32") {
            execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
        } else {
            proc.kill("SIGTERM");
            await Promise.race([proc.exited, new Promise((r) => setTimeout(r, 1500))]);
            if (proc.exitCode === null) {
                proc.kill("SIGKILL");
            }
        }
    } catch (e) {
        console.log(`[cli] process ${pid} probably already dead`);
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
                if (!line.trim()) {
                    continue;
                }

                const parts = line.trim().split(/\s+/);
                const pid_str = parts[parts.length - 1];
                const pid = parseInt(pid_str, 10);

                if (isNaN(pid) || pid === 0) {
                    continue;
                }

                console.log(`[cli] killing old process on port 5173 (PID ${pid})`);
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
    console.log("[cli] cleaning up processes...");
    const tasks: Promise<void>[] = [];

    if (vite_process) {
        tasks.push(kill_process_tree(vite_process));
    }

    if (electron_process) {
        tasks.push(kill_process_tree(electron_process));
    }

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
    if (vite_process && vite_process.exitCode === null) {
        vite_process.kill("SIGKILL");
    }
    if (electron_process && electron_process.exitCode === null) {
        electron_process.kill("SIGKILL");
    }
});

process.on("uncaughtException", async (err) => {
    console.error("[cli] uncaught exception:", err);
    await cleanup();
    process.exit(1);
});

process.on("unhandledRejection", async (err) => {
    console.error("[cli] unhandled rejection:", err);
    await cleanup();
    process.exit(1);
});

const bundle = async (config: any) => {
    console.log(`[build] building ${config.label}...`);

    const result = await build({
        ...config,
        sourcemap: IS_DEV ? "inline" : "none",
        minify: !IS_DEV,
        define: {
            "process.env.NODE_ENV": JSON.stringify(IS_DEV ? "development" : "production")
        }
    });

    if (!result.success) {
        console.error(`[build] failed (${config.label})`, result.logs);
        if (!IS_DEV) {
            process.exit(1);
        }
    }
};

const clean = async () => {
    if (existsSync(PATHS.OUT)) {
        await rm(PATHS.OUT, { recursive: true, force: true }).catch(() => {});
    }

    await mkdir(PATHS.OUT, { recursive: true });
};

const build_main = () => {
    return bundle({
        label: "main",
        entrypoints: [PATHS.SRC_MAIN],
        outdir: path.join(PATHS.OUT, "main"),
        target: "node",
        format: "cjs",
        external: ["electron", "better-sqlite3", "realm", "electron-updater", "@rel-packages/osu-beatmap-parser", "@rel-packages/audio-utils"],
        tsconfig: "tsconfig.node.json"
    });
};

const build_preload = () => {
    return bundle({
        label: "preload",
        entrypoints: [PATHS.SRC_PRELOAD],
        outdir: path.join(PATHS.OUT, "preload"),
        target: "node",
        format: "cjs",
        external: ["electron"],
        tsconfig: "tsconfig.node.json"
    });
};

const build_renderer = async () => {
    console.log("[build] building renderer...");

    const vite_build = spawn(["bunx", "vite", "build", "--config", path.join(PATHS.ROOT, "vite.config.ts")], {
        stdout: "inherit",
        stderr: "inherit"
    });

    const exit_code = await vite_build.exited;

    if (exit_code !== 0) {
        throw new Error(`renderer build failed (exit code: ${exit_code})`);
    }
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

    if (dev) {
        env.ELECTRON_RENDERER_URL = "http://localhost:5173";
    }

    const electron_bin = process.platform === "win32" ? "node_modules\\.bin\\electron.exe" : "node_modules/.bin/electron";

    electron_process = spawn([electron_bin, "."], {
        stdout: "inherit",
        stderr: "inherit",
        env
    });

    console.log(`[cli] starting electron in ${env.NODE_ENV} mode`);

    const current_process = electron_process;
    is_restarting = false;

    current_process.exited.then(async () => {
        if (is_restarting && electron_process !== current_process) {
            return;
        }

        if (!is_restarting) {
            console.log("[cli] electron closed, exiting...");
            await cleanup();
            process.exit(0);
        }
    });
};

const dev = async () => {
    await clean();
    free_port_5173();

    console.log("[cli] starting vite...");

    vite_process = spawn(["bunx", "vite", "dev", "--port", "5173", "--strictPort"], {
        stdout: "inherit",
        stderr: "inherit"
    });

    await new Promise((r) => setTimeout(r, 2000));

    if (vite_process.exitCode !== null) {
        console.error("[cli] vite failed to start");
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

const run = async () => {
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
        console.error("[cli] fatal error:", error);
        await cleanup();
        process.exit(1);
    }
};

run();
