<script>
    import { onDestroy, onMount } from "svelte";
    import { get_popup_manager, show_popup, PopupAddon, ConfirmAddon } from "../../lib/store/popup";
    import { show_export_progress } from "../../lib/store/export_progress";
    import { input } from "../../lib/store/input";

    // components
    import Popup from "../utils/popup/popup.svelte";
    import { get_player_data } from "../../lib/utils/beatmaps";

    const popup_manager = get_popup_manager("index");
    const export_test_data = { active: true, id: 123, collection: "abc", status: "start" };

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

    const create_yes_no_confirm_addon = () => {
        const addon = new ConfirmAddon();

        // force show action
        addon.set_custom_action(true);

        addon.add({ text: "test player fetch?" });

        addon.set_callback(async (v) => {
            const result = await get_player_data({
                player_name: "Froslass",
                beatmap_options: new Set(["created maps", "first place"]),
                beatmap_status: new Set(["ranked", "loved"]),
                star_rating: { min: 0, max: 10 }
            });

            console.log(result);
        });

        popup_manager.register("question", addon);
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

    onMount(() => {
        create_test_addon();
        create_confirm_addon();
        create_yes_no_confirm_addon();

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

<div class="content tab-content">
    <Popup key={"index"} />
    <div class="index-content">
        <h1>hey</h1>
        <p>yeah thats the main tab</p>
        <button onclick={() => show_popup("test", "index")}>open popup addon</button>
        <button onclick={() => show_popup("aids", "index")}>open confirmation addon</button>
        <button onclick={() => show_popup("question", "index")}>open yes/no confirmation addon</button>
    </div>
</div>
