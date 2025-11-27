<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { show_export_progress } from "../../lib/store/export_progress";
    import { input } from "../../lib/store/input";
    import { finish_notification, show_notification, edit_notification } from "../../lib/store/notifications";
    import { context_menu_manager } from "../../lib/store/context-menu";

    const export_test_data = { active: true, id: 123, collection: "abc", status: "start" };

    interface TestItem {
        id: string;
        text: string;
        data?: TestItem[];
    }

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

    onMount(() => {
        input.on("a", () => {
            show_export_progress(export_test_data);
        });
        input.on("control+a", () => {
            show_export_progress({ ...export_test_data, status: "missing" });
        });
    });

    onDestroy(() => {
        input.unregister("a", "control+a");
    });
</script>

<div class="test">
    <button onclick={() => show_notification({ id: notification_id, type: "error", text: "Hello Bro", duration: 1000, persist: true })}
        >notification persist</button
    >
    <button onclick={() => close_notification()}>end notification</button>
    <button oncontextmenu={open_context_menu}>open context menu (right click)</button>
</div>

<style>
    .test {
        padding: 10px;
    }
</style>
