import { defineConfig } from "vitest/config";
// import { enhancedImages } from '@sveltejs/enhanced-img';

import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [
        // enhancedImages(),
        tsconfigPaths(),
        {
            name: "node-loader",
            load(id) {
                if (id.endsWith(".node")) {
                    return {
                        code: `export default require(${JSON.stringify(id)});`,
                        map: null
                    };
                }
            }
        }
    ],
    test: {
        globals: true,
        environment: "node"
    }
});
