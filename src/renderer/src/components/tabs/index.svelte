<script>
    import { onMount } from "svelte";
    import { is_dev_mode } from "../../lib/utils/utils";

    // stuff
    import TestContent from "./test.svelte";

    let container = null;
    let show_test = false;

    const mirrors = [
        { name: "nerinyan", url: "https://api.nerinyan.moe/d/" },
        { name: "osu.direct", url: "https://osu.direct/api/d/" },
        { name: "nekoha", url: "https://mirror.nekoha.moe/api4/beatmap/" },
        { name: "catboy", url: "https://catboy.best/d/" },
        { name: "sayobot", url: "https://dl.sayobot.cn/beatmaps/download/" }
    ];

    onMount(() => {
        // handle links to open in external browser
        const all_links = [...container.querySelectorAll("a")];

        for (const link of all_links) {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const target_url = e.target.getAttribute("href");

                if (target_url && target_url != "") {
                    window.api.invoke("shell:open", target_url);
                }
            });
        }
    });
</script>

<div class="content tab-content index-content" bind:this={container}>
    <div class="index-header">
        <div class="header-text">
            <h1>osu-stuff</h1>
            <p class="subtitle">yet another osu manager.</p>
        </div>
    </div>

    <div class="content-sections">
        {#if $is_dev_mode}
            <section style="margin-top: 20px;">
                <button on:click={() => (show_test = !show_test)}>toggle test</button>
                {#if show_test}
                    <TestContent />
                {/if}
            </section>
        {/if}

        <section>
            <h2>authentication</h2>
            <p>
                in order to get player information, check beatmaps by md5, etc... osu-stuff needs your
                <code>osu! id</code> and <code>osu! secret</code>.<br />
                the process to configure this is pretty simple:
            </p>
            <ul>
                <li>create a new OAuth application <a href="https://osu.ppy.sh/home/account/edit#new-oauth-application">here</a></li>
                <li>open the config tab in osu-stuff</li>
                <li>paste the 'client id' from osu! into the osu! id input</li>
                <li>click 'show client secret' on osu!'s website</li>
                <li>paste the 'client secret' into the osu! secret input</li>
                <li>done!</li>
            </ul>
        </section>

        <section>
            <h2>mirrors</h2>
            <p>
                mirrors are used to download osu! beatmaps.<br />
                by default, no mirrors are set in the config. if you want to download beatmaps, make sure to check the 'adding mirrors' section.
            </p>

            <table>
                <thead>
                    <tr>
                        <th>name</th>
                        <th>url</th>
                    </tr>
                </thead>
                <tbody>
                    {#each mirrors as mirror}
                        <tr>
                            <td><code>{mirror.name}</code></td>
                            <td><a href={mirror.url}>{mirror.url}</a></td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </section>

        <section>
            <h2>adding mirrors</h2>
            <p>
                you can add custom mirrors in the config tab.<br />
                to add one, click the "+" popup, enter any name, and the url.<br />
                if the mirror you're adding isn't listed above, make sure the url ends with the download endpoint.
            </p>
        </section>
    </div>
</div>

<style>
    .index-content {
        flex-direction: column;
        overflow-y: auto;
        padding: 0;
        background: var(--bg-color);
        height: 100%;
    }

    .index-header {
        display: flex;
        align-items: center;
        padding: 1.5em;
        background: var(--bg-primary);
        border-bottom: 1px solid var(--border-color);
    }

    .header-text {
        flex: 1;
        font-family: "Torus Bold";
    }

    h1 {
        font-family: "Torus Bold";
        font-size: 1.6rem;
        color: var(--text-color);
        margin: 0 0 0.5rem 0;
    }

    .subtitle {
        color: var(--text-secondary);
        font-family: "Torus SemiBold";
        font-size: 0.85rem;
        margin: 0;
        line-height: 1.4;
    }

    .content-sections {
        padding: 1.5em;
        padding-top: 0;
    }

    h2 {
        font-size: 1.4rem;
        color: var(--text-color);
        margin: 2rem 0 0.75rem 0;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.5rem;
        font-family: "Torus Bold";
    }

    p {
        font-size: 0.9rem;
        font-family: "Torus";
        color: var(--text-secondary);
    }

    ul {
        margin: 1rem 0;
        padding-left: 1.5rem;
        color: var(--text-secondary);
    }

    li {
        margin-bottom: 0.5rem;
        font-size: 0.95em;
        font-family: "Torus SemiBold";
    }

    code {
        background: var(--bg-secondary);
        color: var(--text-color);
        padding: 0.15rem 0.35rem;
        border-radius: 3px;
        font-size: 0.85em;
        border: 1px solid var(--border-color);
    }

    table {
        border-collapse: collapse;
        width: 100%;
        margin: 1rem 0;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        overflow: hidden;
    }

    th {
        background: var(--bg-secondary);
        color: var(--text-color);
        padding: 0.75rem 1rem;
        text-align: left;
        font-size: 0.9rem;
        border-bottom: 1px solid var(--border-color);
        user-select: none;
    }

    td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border-color);
        color: var(--text-secondary);
        font-size: 0.9rem;
        user-select: text;
        cursor: text;
    }

    td * {
        user-select: auto !important;
    }

    tr:last-child td {
        border-bottom: none;
    }

    tr:hover {
        background: var(--bg-secondary);
    }

    a {
        color: var(--accent-color);
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }

    @media (max-width: 768px) {
        .index-header {
            flex-direction: column;
            text-align: center;
            gap: 1em;
        }
    }
</style>
