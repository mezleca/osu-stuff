import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

const SHARED_ALIAS = {
    "@shared": path.resolve(__dirname, "src/shared"),
    "@assets": path.resolve(__dirname, "src/renderer/src/assets")
};

export default defineConfig({
    root: "src/renderer",
    plugins: [svelte()],
    resolve: {
        alias: SHARED_ALIAS,
        preserveSymlinks: true
    },
    optimizeDeps: {
        // these packages create workers/wasm urls internally.
        // pre-bundling in optimize deps rewrites paths and breaks worker resolution.
        exclude: ["@rel-packages/osu-beatmap-parser", "@rel-packages/osu-beatmap-parser/browser"]
    },
    build: {
        outDir: "../../out/renderer",
        emptyOutDir: true
    },
    base: "./"
});
