<script>
    import { onDestroy, onMount } from "svelte";
    import { get_popup_manager, show_popup, PopupAddon, ConfirmAddon, quick_confirm } from "../../lib/store/popup";
    import { show_export_progress } from "../../lib/store/export_progress";
    import { input } from "../../lib/store/input";
    import { finish_notification, show_notification, edit_notification } from "../../lib/store/notifications";

    // components
    import Popup from "../utils/popup/popup.svelte";
    import ContextMenu from "../utils/context-menu.svelte";

    const popup_manager = get_popup_manager("index");
    const export_test_data = { active: true, id: 123, collection: "abc", status: "start" };

    const generate_nested_array = (depth, current = 1) => {
        const get_id = () => Math.random().toString(36).substring(2, 8);
        const make_text = (id) => `Item ${id}`;

        const items = Array.from({ length: 3 }, (_, i) => {
            const obj = {
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

    function get_random_shit(max = 5) {
        const items = ["foo", "bar", "baz", "qux", "quux", "corge", "grault", "garply", "waldo", "fred", "plugh", "xyzzy", "thud"];
        const result = [];
        for (let i = 0; i < Math.floor(Math.random() * max); i++) {
            const idx = Math.floor(Math.random() * items.length);
            result.push(items[idx]);
        }
        return result;
    }

    const create_confirm_addon = () => {
        const addon = new ConfirmAddon();

        addon.add_title("select and option");
        addon.add_button("123", "button 1");
        addon.add_button("1253", "button 2");

        addon.set_callback((v) => console.log("selected option: ", v));
        popup_manager.register("aids", addon);
    };

    const show_yes_no_addon = async () => {
        const result = await quick_confirm("hello", { key: "index" });
        console.log(result);
    };

    const create_test_addon = () => {
        const addon = new PopupAddon();

        addon.add({ id: "something", type: "text", text: "ts is a text", font_size: 20 });
        addon.add({ id: "range-test", type: "range", label: "range test", min: 0, max: 105 });
        addon.add({ id: "dialog-test", type: "file-dialog", label: "select a file" });
        // shoud enable container 1 on checked
        addon.add({ id: "mhm", type: "checkbox", label: "checkbox to enable da container" });
        // should enable container 2 on "active"
        addon.add({ id: "mhm2", type: "dropdown", text: "dropdown to enable container2", data: ["not active", "active", "test"] });
        addon.add({ id: "container", type: "container", show_when: { id: "mhm", equals: true } });
        addon.add({ id: "container2", type: "container", show_when: { id: "mhm2", equals: "active" } });
        addon.add({ id: "drop", type: "dropdown", text: "items", data: ["123", "321", "1", "aaaaaaa"] });
        addon.add({ id: "cool", type: "buttons", label: "cool (row)", class: "row", multiple: true, data: () => ["abc", "bcd", "efg"] });
        addon.add({ id: "cool2", type: "buttons", label: "cool2", multiple: false, parent: "container", data: () => get_random_shit(10) });
        addon.add({ id: "cool3", type: "buttons", label: "cool3", multiple: true, parent: "container2", data: ["321", "123"] });

        addon.set_callback((data) => console.log(data));
        popup_manager.register("test", addon);
    };

    const close_notification = () => {
        edit_notification(notification_id, { type: "success" });
        finish_notification(notification_id);
    };

    onMount(() => {
        create_test_addon();
        create_confirm_addon();

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
    <button onclick={() => show_popup("test", "index")}>open popup addon</button>
    <button onclick={() => show_popup("aids", "index")}>open confirmation addon</button>
    <button onclick={() => show_yes_no_addon()}>open yes/no confirmation addon</button>
    <ContextMenu options={random_options} onclick={(e) => console.log(e)}>
        <button>open context menu</button>
    </ContextMenu>
    <Popup key={"index"} />
</div>

<style>
    .test {
        padding: 10px;
    }
</style>
