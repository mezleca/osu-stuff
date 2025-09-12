import path from "path";
import fs from "fs";

import { builtinModules } from "module";
import { spawn } from "child_process";
import { build, createServer } from "vite";
import { dependencies } from "../package.json";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// @TODO: for some reason i need 2 sigints in order to kill this process...

const args = process.argv;

let IS_SHUTTING_DOWN = false;
let ACTIVE_ELECTRON_PROCESS = null;
let DEV_SERVER = null;

// FOLDERS
const RENDERER_PATH = path.resolve("src", "renderer");
const PRELOAD_PATH = path.resolve("src", "preload");
const MAIN_PATH = path.resolve("src", "main");
const DEPENDENCIES = [];

// ELECTRON ENV
const env = Object.assign({}, process.env, {
    IS_DEV: true,
    ELECTRON_RENDERER_URL: "http://localhost:8082/"
});

const IGNORE_NODE_PLUGIN = {
    name: "ignore-native",
    resolveId(id) {
        if (id.endsWith(".node")) {
            return { id, external: true };
        }
        return null;
    }
};

const RENDERER_CONFIG = {
    plugins: [svelte()],
    build: {
        outDir: path.resolve("out/renderer")
    },
    root: "src/renderer",
    base: "./"
};

const MAIN_CONFIG = {
    build: {
        outDir: "out/main",
        target: "node22",
        lib: {
            entry: "src/main/index.js",
            name: "main",
            fileName: () => "index.js",
            formats: ["cjs"]
        },
        rollupOptions: {
            external: (id) => {
                if (id == "electron" || id.endsWith(".node")) {
                    return true;
                }
                return DEPENDENCIES.includes(id);
            }
        },
        minify: false
    },
    resolve: {
        preferBuiltins: true
    }
};

const PRELOAD_CONFIG = {
    build: {
        outDir: "out/preload",
        target: "node22",
        lib: {
            entry: "src/preload/index.js",
            name: "preload",
            fileName: () => "index.js",
            formats: ["cjs"]
        },
        rollupOptions: {
            external: (id) => {
                return DEPENDENCIES.includes(id) || id.endsWith(".node");
            },
            plugins: [IGNORE_NODE_PLUGIN]
        },
        minify: false
    },
    resolve: {
        preferBuiltins: true
    }
};

const show_error = (message) => {
    throw new Error(`cli error: ${message}`);
};

const build_electron_files = async () => {
    if (!fs.existsSync(MAIN_PATH)) show_error("main folder not found at: " + MAIN_PATH);
    if (!fs.existsSync(PRELOAD_PATH)) show_error("preload folder not found at: " + PRELOAD_PATH);

    try {
        await build(MAIN_CONFIG);
    } catch (err) {
        show_error("main build failed: " + err.message);
    }
    try {
        await build(PRELOAD_CONFIG);
    } catch (err) {
        show_error("preload build failed: " + err.message);
    }
};

const build_renderer_files = async () => {
    if (!fs.existsSync(RENDERER_PATH)) show_error("renderer folder not found at: " + RENDERER_PATH);
    await build(RENDERER_CONFIG);
};

const start_renderer_server = async () => {
    DEV_SERVER = await createServer({
        plugins: [svelte()],
        configFile: false,
        root: path.resolve("src", "renderer"),
        server: {
            port: 8082
        }
    });

    await DEV_SERVER.listen();
    console.log("cli: dev server running on port 8082");
};

const start_electron_process = () => {
    return new Promise((resolve) => {
        ACTIVE_ELECTRON_PROCESS = spawn("bun", ["run", "electron", "."], {
            env: env,
            detached: false,
            stdio: "inherit"
        });

        ACTIVE_ELECTRON_PROCESS.on("close", (code) => {
            console.log(`cli: electron process exited with code ${code}`);
            ACTIVE_ELECTRON_PROCESS = null;
            resolve(code);
        });

        ACTIVE_ELECTRON_PROCESS.on("error", (err) => {
            console.error("cli: electron process error:", err);
            ACTIVE_ELECTRON_PROCESS = null;
            resolve(1);
        });
    });
};

const watch = async () => {
    await start_renderer_server();
    await start_electron_process();
};

const cleanup = async () => {
    // prevent new calls
    if (IS_SHUTTING_DOWN) {
        return;
    }

    IS_SHUTTING_DOWN = true;
    const cleanup_promises = [];

    // kill electron process
    if (ACTIVE_ELECTRON_PROCESS && !ACTIVE_ELECTRON_PROCESS.killed) {
        cleanup_promises.push(
            new Promise((resolve) => {
                console.log("cli: killing electron process");

                // try sigint first
                ACTIVE_ELECTRON_PROCESS.kill("SIGINT");

                const timeout = setTimeout(() => {
                    if (ACTIVE_ELECTRON_PROCESS && !ACTIVE_ELECTRON_PROCESS.killed) {
                        ACTIVE_ELECTRON_PROCESS.kill("SIGKILL");
                    }
                    resolve();
                }, 3000);

                ACTIVE_ELECTRON_PROCESS.on("close", () => {
                    clearTimeout(timeout);
                    resolve();
                });

                ACTIVE_ELECTRON_PROCESS.kill("SIGTERM");
            })
        );
    }

    // close dev server
    if (DEV_SERVER) {
        cleanup_promises.push(DEV_SERVER.close());
    }

    console.log("cli: cleaning up...");
    await Promise.all(cleanup_promises);
    console.log("cli: cleanup done");
};

const main = async () => {
    const mode = args[2]?.split("--")[1];

    if (!mode) {
        console.log("cli: expected an argument");
        return;
    }

    // add project dependencies
    const deps_from_package = Object.keys(dependencies);

    if (deps_from_package.length > 0) {
        DEPENDENCIES.push(...deps_from_package);
    }

    // add bultin modules
    DEPENDENCIES.push(...builtinModules);

    switch (mode) {
        case "build":
            await build_electron_files();
            await build_renderer_files();
            break;
        case "watch":
            await build_electron_files();
            await watch();
            break;
    }

    console.log("cli: exiting");
};

// handle shutdown
process.on("SIGINT", async () => {
    console.log("\ncli: received SIGINT, shutting down...");
    await cleanup();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("cli: received SIGTERM, shutting down...");
    await cleanup();
    process.exit(0);
});

main();
