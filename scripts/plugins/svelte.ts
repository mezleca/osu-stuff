import { compile, preprocess } from "svelte/compiler";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "fs";

export default {
    name: "svelte-loader",
    setup: async (build: any) => {
        build.onLoad({ filter: /\.svelte$/ }, async (args: any) => {
            const source = readFileSync(args.path, "utf-8");

            const processed = await preprocess(source, vitePreprocess(), {
                filename: args.path
            });

            const compiled = compile(processed.code, {
                filename: args.path,
                generate: "client",
                css: "injected"
            });

            return { contents: compiled.js.code, loader: "js" };
        });
    }
};
