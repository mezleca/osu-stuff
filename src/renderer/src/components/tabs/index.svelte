<script>
    import { onMount } from "svelte";
    import { add_new_popup, show_popup, PopupAddon } from "../../lib/store/popup";

    // components
    import Popup from "../utils/popup.svelte";

    const show_shit = (data) => {
        console.log("test data", data);
    };

    const create_fuck_ton_addon = () => {
        const addon = new PopupAddon();

        addon.add({ id: "something", type: "text", text: "text123", font_size: 20 });
        // shoud enable container 1 on checked
        addon.add({ id: "mhm", type: "checkbox", label: "checkbox to enable da container" });
        // should enable container 2 on "active"
        addon.add({ id: "mhm2", type: "dropdown", text: "dropdown to enable container2", data: ["not active", "active", "test"] });
        addon.add({ id: "container", type: "container", active: () => ({ id: "mhm", value: true }) });
        addon.add({ id: "container2", type: "container", active: () => ({ id: "mhm2", value: "active" }) });
        addon.add({ id: "drop", type: "dropdown", text: "items", data: ["123", "321", "1", "aaaaaaa"] });
        addon.add({ id: "cool", type: "buttons", label: "cool", multiple: true, data: ["mhm", "test", "thats a test"] });
        addon.add({ id: "cool2", type: "buttons", label: "cool2", multiple: false, parent: "container", data: ["444", "555", "666"] });

        addon.set_callback(show_shit);
        add_new_popup("test", addon, "index");
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
