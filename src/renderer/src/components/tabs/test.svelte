<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { finish_notification, show_notification, edit_notification } from "../../lib/store/notifications";
    import { context_menu_manager } from "../../lib/store/context-menu";
    import { downloader } from "../../lib/store/downloader";
    import { ModalType, show_modal } from "../../lib/utils/modal";
    import { collections } from "../../lib/store/collections";
    import { string_is_valid } from "../../lib/utils/utils";
    import { beatmap_preview, get_beatmap } from "../../lib/utils/beatmaps";

    let beatmaps: Array<{ md5: string }> = [];
    let download_id = 0;

    interface TestItem {
        id: string;
        text: string;
        data?: TestItem[];
    }

    const add_download = () => {
        const amt = Math.floor(Math.random() * 100) || 1;
        const test_beatmaps = beatmaps.splice(0, amt);
        downloader.add({ id: `test download (${download_id++})`, beatmaps: test_beatmaps });
    };

    const show_beatmap_preview = async () => {
        // attempt to get a random ass beatmap
        const c = collections.get_all();

        for (const collection of c) {
            if (collection.beatmaps.length == 0) continue;

            const random_idx = Math.floor(Math.random() * collection.beatmaps.length);
            const hash = collection.beatmaps[random_idx];

            if (string_is_valid(hash)) {
                const beatmap = await get_beatmap(hash);
                if (beatmap) {
                    beatmap_preview.set(beatmap);
                    show_modal(ModalType.beatmap_preview);
                    return;
                }
            }
        }

        show_notification({ type: "error", text: "no beatmaps found in collections for preview" });
    };

    const generate_nested_array = (depth: number, current = 1): TestItem[] => {
        const get_id = () => Math.random().toString(36).substring(2, 8);
        const make_text = (id: number) => `Item ${id}`;

        const items = Array.from({ length: 3 }, (_, i) => {
            const obj: TestItem = {
                id: get_id(),
                text: make_text(i + 1)
            };

            if (i == 2 && current < depth) {
                obj.data = generate_nested_array(depth, current + 1);
            }

            return obj;
        });

        return items;
    };

    const notification_id = crypto.randomUUID();
    const random_options = generate_nested_array(5);

    const close_notification = () => {
        edit_notification(notification_id, { type: "success" });
        finish_notification(notification_id);
    };

    const open_context_menu = (e: MouseEvent) => {
        e.preventDefault();
        context_menu_manager.show(e, random_options as any, () => {
            console.log("context menu closed");
        });
    };

    onMount(async () => {
        if (beatmaps.length == 0) {
            const a = await window.api.invoke("driver:search_beatmaps", { query: "", sort: "artist", unique: false });
            beatmaps = a.beatmaps;
        }
    });

    onDestroy(() => {});
</script>

<div class="test">
    {#if beatmaps.length > 0}
        <button onclick={() => add_download()}>download</button>
    {/if}
    <button onclick={() => show_notification({ id: notification_id, type: "error", text: "Hello Bro", duration: 1000, persist: true })}
        >notification persist</button
    >
    <button onclick={() => show_beatmap_preview()}>show player</button>
    <button onclick={() => close_notification()}>end notification</button>
    <button oncontextmenu={open_context_menu}>open context menu (right click)</button>
</div>

<style>
    .test {
        padding: 10px;
    }
</style>
