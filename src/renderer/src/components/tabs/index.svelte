<script>
    import { onMount } from "svelte";
    import { add_new_popup, show_popup, PopupAddon } from "../../lib/store/popup";

    // componentes
    import Popup from "../utils/popup.svelte";

    const show_shit = (data) => {
        console.log(data);
    };

    const create_fuck_ton_addon = () => {
        const addon = new PopupAddon();

        addon.add({ id: "mhm", type: "checkbox", label: "thats a checkbox" });
        addon.add({ id: "container", type: "container" });
        addon.add({ id: "drop", type: "dropdown", text: "items", data: ["123", "321", "1", "aaaaaaa"] });
        addon.add({ id: "cool", type: "buttons", label: "cool", data: ["mhm", "test", "thats a test"] });
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
