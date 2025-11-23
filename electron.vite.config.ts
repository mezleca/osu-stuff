import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import path from "path";

const SHARED_ALIAS = {
    "@shared": path.resolve(__dirname, "src/shared")
};

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        resolve: { alias: SHARED_ALIAS }
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        resolve: { alias: SHARED_ALIAS }
    },
    renderer: {
        plugins: [svelte()],
        resolve: { alias: SHARED_ALIAS }
    }
});
