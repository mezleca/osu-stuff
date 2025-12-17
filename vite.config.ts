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
        alias: SHARED_ALIAS
    },
    build: {
        outDir: "../../out/renderer",
        emptyOutDir: true
    },
    base: "./"
});
