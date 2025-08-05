<script>
    import { onMount } from "svelte";
    import { get_popup_manager, show_popup, PopupAddon } from "../../lib/store/popup";

    // components
    import Popup from "../utils/popup/popup.svelte";

    const popup_manager = get_popup_manager("index");

    const show_shit = (data) => {
        console.log("test data", data);
    };

    function get_random_shit(max = 5) {
        const items = ["foo", "bar", "baz", "qux", "quux", "corge", "grault", "garply", "waldo", "fred", "plugh", "xyzzy", "thud"];
        const result = [];
        for (let i = 0; i < Math.floor(Math.random() * max); i++) {
            const idx = Math.floor(Math.random() * items.length);
            result.push(items[idx]);
        }
        return result;
    }

    const create_fuck_ton_addon = () => {
        const addon = new PopupAddon();

        addon.add({ id: "something", type: "text", text: "ts is a text", font_size: 20 });
        addon.add({ id: "dialog-test", type: "file-dialog", label: "select a file" });
        // shoud enable container 1 on checked
        addon.add({ id: "mhm", type: "checkbox", label: "checkbox to enable da container" });
        // should enable container 2 on "active"
        addon.add({ id: "mhm2", type: "dropdown", text: "dropdown to enable container2", data: ["not active", "active", "test"] });
        addon.add({ id: "container", type: "container", show_when: { id: "mhm", equals: true } });
        addon.add({ id: "container2", type: "container", show_when: { id: "mhm2", equals: "active" } });
        addon.add({ id: "drop", type: "dropdown", text: "items", data: ["123", "321", "1", "aaaaaaa"] });
        addon.add({ id: "cool", type: "buttons", label: "cool", multiple: true, data: () => ["abc", "bcd", "efg"] });
        addon.add({ id: "cool2", type: "buttons", label: "cool2", multiple: false, parent: "container", data: () => get_random_shit(10) });
        addon.add({ id: "cool3", type: "buttons", label: "cool3", multiple: true, parent: "container2", data: ["321", "123"] });

        addon.set_callback(show_shit);
        popup_manager.register("test", addon);
    };

    onMount(() => {
        create_fuck_ton_addon();
    });
</script>

<div class="content tab-content">
    <Popup key={"index"} />
    <div class="index-content">
        <h1>hey</h1>
        <p>yeah thats the main tab</p>
        <button onclick={() => show_popup("test", "index")}>click me</button>
    </div>
</div>
