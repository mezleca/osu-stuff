<script>
    import { marked } from "marked";
    import { onMount } from "svelte";
    import { is_dev_mode } from "../../lib/utils/utils";

    // fix tables
    import ExtendedTables from "marked-extended-tables";

    // @TODO: move markdown stuff to MarkDownRenderer component

    // markdown content
    import IndexMarkdown from "../../assets/index.md?raw";

    // test tab
    import TestContent from "./test.svelte";

    // github like css for markdown
    import "github-markdown-css/github-markdown.css";

    // create image map for easier matching
    const images = import.meta.glob("../../assets/images/*.{png,jpg,jpeg,gif,svg}", { eager: true, import: "default" });
    const image_map = {};

    Object.keys(images).forEach((full_path) => {
        const file_name = full_path.split("/").pop();
        image_map[file_name] = images[full_path];
        image_map[full_path] = images[full_path]; // keep full path too
    });

    function resolve_image_path(href) {
        // try exact path first
        if (image_map[href]) {
            return image_map[href];
        }

        // try just filename
        const file_name = href.split("/").pop();

        if (image_map[file_name]) {
            return image_map[file_name];
        }

        // if not found, return original path
        return href;
    }

    marked.use(ExtendedTables());
    marked.use({
        renderer: {
            image(href, text, title) {
                const resolved_href = resolve_image_path(href);
                return `<img src="${resolved_href}" alt="${text || ""}" ${title ? `title="${title}"` : ""}/>`;
            }
        },
        hooks: {
            postprocess(html) {
                // regex to find <img> tags with src that needs to be resolved
                return html.replace(/<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (_, before, src, after) => {
                    const resolved_src = resolve_image_path(src);
                    return `<img${before}src="${resolved_src}"${after}>`;
                });
            }
        }
    });

    marked.setOptions({
        gfm: true,
        tables: true
    });

    $: container = null;
    $: index_content = "";
    $: show_test = false;

    onMount(async () => {
        // update content
        index_content = await marked.parse(IndexMarkdown);

        // wait until we have the container
        await new Promise((r) => {
            let interval = setInterval(() => {
                if (container != null) {
                    r();
                    clearInterval(interval);
                }
            }, 10);
        });

        // now that we have the container, lets handle links stuff
        const all_links = [...container.querySelectorAll("a")];

        for (const link of all_links) {
            link.addEventListener("click", (e) => {
                // we dont want to open shit on the current webview
                e.preventDefault();

                // get target url
                const target_url = e.target.getAttribute("href");

                if (!target_url || target_url == "") {
                    return;
                }

                // open on browser
                window.shell.open(target_url, {});
            });
        }
    });
</script>

<div class="markdown-body content tab-content index-content" bind:this={container}>
    {@html index_content}
    {#if $is_dev_mode}
        <button onclick={() => (show_test = !show_test)}>toggle test</button>
    {/if}
    {#if show_test}
        <TestContent />
    {/if}
</div>

<style>
    .index-content {
        flex-direction: column;
        overflow-y: auto;
    }

    :global(.markdown-body p) {
        font-size: 1em;
    }

    :global(.markdown-body h2, .markdown-body h1) {
        font-size: 1.7em;
        padding-bottom: 0.1em;
    }

    :global(.markdown-body table) {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 16px;
        overflow: visible;
    }
</style>
