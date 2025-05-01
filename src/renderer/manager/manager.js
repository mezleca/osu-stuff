import { core } from "../app.js";
import { load_osu_files, save_config, is_lazer_mode } from "../utils/config.js";
import { create_element } from "../utils/global.js";
import { setup_collector } from "../stuff/collector.js";
import { create_alert, create_custom_popup, message_types, quick_confirm } from "../popup/popup.js";
import { downloader } from "../utils/downloader/client.js";
import { delete_beatmaps } from "../stuff/remove_maps.js";
import { download_from_players } from "../stuff/download_from_players.js";
import { missing_download } from "../stuff/missing.js";
import { fetch_osustats } from "../utils/other/fetch.js";
import { debounce, MAX_RENDER_AMMOUNT } from "../utils/global.js";
import { filter_beatmap } from "./tools/filter.js";
import { select_file } from "../utils/other/process.js";
import { beatmap_status } from "../utils/reader/models/stable.js";
import { Reader } from "../utils/reader/reader.js";
import { draggable_items_map, remove_all_selected, setup_draggables, update_collection_count, update_collections_count } from "./ui/draggable.js";
import { create_dropdown } from "./ui/dropdown.js";
import { create_range } from "./ui/range.js";
import { create_beatmap_card } from "./ui/beatmap.js";

const list = document.querySelector(".list_draggable_items");
const header_text = document.querySelector(".collection_header_text");
const collection_container = document.querySelector(".collection-container");
const search_input = document.getElementById("current_search");
const update_collection_button = document.querySelector(".update_collection");

const text_collection = document.getElementById("collection_text");

const manager_filters = new Map();
const rendered_beatmaps = { id: 0, idx: new Set() };

export const get_selected_collection = () => {

    const draggable_items = [...document.querySelectorAll(".draggable_item")];

    for (let i = 0; i < draggable_items.length; i++) {
        if (draggable_items[i].classList.contains("selected")) {
            return { id: draggable_items[i].id, name: draggable_items[i].querySelector(".collection-name").textContent }
        }
    }

    return { id: null, name: "" };
};

export const show_update_button = () => {
    update_collection_button.style.display = "block";  
};

export const hide_update_button = () => {
    update_collection_button.style.display = "none";  
};

export const get_sr_filter = () => {
    return manager_filters.get("manager-sr-filter");
};

export const get_bpm_filter = () => {
    return manager_filters.get("manager-bpm-filter");
};

export const get_status_filter = () => {
    return manager_filters.get("dropdown-status-filter");
};

// @TODO: rewrite this, some functions shoudn't be initialize here
export const lazer_mode = async (target, name) => {

    if (target.checked && !core.config.get("lazer_path")) {
        create_alert("wheres the lazer path mf", { type: "error" });
        target.checked = false;
        return;
    }

    await save_config(name, target.checked);

    if (!target.checked) {
        await load_osu_files(core.config.get("stable_path"));
    } else {
        core.reader.osu = {};
        await core.reader.get_osu_data();
        await core.reader.get_collections_data();
    }

    // update collections so we get the bpm min/max, etc..
    core.reader.update_collections();

    update_status_filter();
    setup_manager();

    if (target.checked) {
        create_alert("switched to lazer mode!");
    } else {
        create_alert("switched to stable mode!");
    }
};

search_input.addEventListener("input", debounce(() => {

    const { id } = get_selected_collection();

    if (!id) {
        return;
    }

    if (search_input.value.length > 3) {

        if (core.search_filters.size != 0) {
            core.search_filters = new Map();
        }

        const result = search_input.value.matchAll(/\b(?<key>\w+)(?<op>!?[:=]|[><][:=]?)(?<value>(".*"!?|\S*))/g);
        for (const [text, k, o, v] of result) {
            core.search_filters.set(k, { text: text, o: o, v: v });
        }
    }
    
    core.search_query = search_input.value;
    render_page(id, 0, true);
}, 300));

export const remove_beatmap = (hash) => {

    const { id, name } = get_selected_collection();
    const beatmaps = core.reader.collections.beatmaps.get(name).maps;

    if (!beatmaps) {
        console.log("[manager] failed to get collection", name);
        return;
    }

    document.getElementById(`bn_${hash}`).remove();
    beatmaps.delete(hash);
    window.ctxmenu.delete(`bn_${hash}`);
    update_collection_count(id, name);
    show_update_button();
};

const get_from_player = async () => {

    if (core.login == null) {
        create_alert("did you forgor to setup your config?");
        return;
    }

    const method = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "search option",
        elements: [
            {
                key: "players",
                element: { tag: { placeholder: "player name", show_add: true, limit: 8 } }
            },
            {
                key: "beatmap options",
                element: { list: { multiple: true, options: ["best performance", "first place", "favourites", "created maps"] }}
            },
            {
                key: "beatmap status",
                element: { list: { multiple: true, options: Object.keys(beatmap_status) }}
            },
            {
                key: "difficulty range",
                element: { range: { min: 0.00, max: 100.00, identifier: "★", decimal_places: "2" }}
            }
        ]
    });

    if (method == null) {
        return;
    }

    if (method?.players.size == 0) {
        create_alert("uhhh you need at least 1 player bro", { type: "warning" });
        return;
    }

    if (method?.beatmap_options.size == 0) {
        create_alert("select at least one beatmap option", { type: "warning" });
        return;
    }

    if (method?.beatmap_status.size == 0) {
        method.beatmap_status.add("all");        
    }

    method.name = `${Array.from(method.players).join(", ")})`;

    download_from_players(method);
};

const add_new_collection = async () => {

    const prompt = await create_custom_popup({     
        type: message_types.INPUT, 
        label: "add new collection (from url)<br>valid websites: osu!collector, osustats.ppy.sh",
        html: true
    });

    if (!prompt) {
        return;
    }

    const url = new URL(prompt);
    const url_is_valid = url.hostname == "osustats.ppy.sh" || url.hostname == "osucollector.com";

    if (!url || !url_is_valid) {
        return;
    }

    const info = url.hostname == "osustats.ppy.sh" ? await fetch_osustats(url.toString()) : await setup_collector(url.toString());

    if (!info) {
        return;
    }

    const { c_maps: maps, maps: yep_maps, collection } = info;
    const { name } = get_selected_collection();

    if (name) {

        const confirmation = await quick_confirm(`merge with ${name}?`);

        if (confirmation) {

            const collection = core.reader.collections.beatmaps.get(name).maps;

            if (!collection) {
                create_alert(`failed to get current collection ${collection} ${name}`, { type: "error" } );
                return;
            }

            const new_maps = [...collection, ...maps];
            await add_collection_manager(new_maps, name);
        } 
        else {
                    
            if (core.reader.collections.beatmaps.has(collection.name)) {
                create_alert("you already have a collection with this name");
                return;
            }

            await add_collection_manager(maps, collection.name);
        }
    } 
    else {
        
        if (core.reader.collections.beatmaps.has(collection.name)) {
            create_alert("you already have a collection with this name");
            return;
        }

        await add_collection_manager(maps, collection.name);
    }

    const download = await quick_confirm(`download maps from ${collection.name}?`);

    if (!download) {
        return;
    }

    if (!core.login?.access_token) {
        create_alert("no osu_id / secret configured :c", { type: "error" });
        return;
    }

    // add to downloader queue
    downloader.create_download({ id: crypto.randomUUID(), name: collection.name, maps: yep_maps });
};

const get_missing_beatmaps = async () => {

    if (core.login == null) {
        create_alert("did you forgor to setup your config?");
        return;
    }

    missing_download();
};

const delete_beatmaps_manager = async () => {
    
    const { name } = get_selected_collection();

    // make sure the collection is valid
    if (!name) {
        core.progress.update("failed to get current collection");
        return;
    }

    const old_collection = core.reader.collections.beatmaps.get(name);
    const all_beatmaps = Array.from(old_collection.maps);
    const beatmaps = new Map();

    if (!all_beatmaps) {
        core.progress.update("failed to get collection beatmaps");
        return;
    }

    for (let i = 0; i < all_beatmaps.length; i++) {

        if (filter_beatmap(all_beatmaps[i])) {

            const data = core.reader.osu.beatmaps.get(all_beatmaps[i]);

            if (!data) {
                continue;
            }

            beatmaps.set(all_beatmaps[i], data);
        }
    }

    if (beatmaps.size == 0) {
        core.progress.update("no beatmaps to delete");
        return;
    }

    const remove_from_collection = await quick_confirm(`delete ${beatmaps.size == all_beatmaps.length ? "all" : beatmaps.size } beatmap${beatmaps.size > 1 ? "s" : ""} from ${name}?`);
    
    if (remove_from_collection == null) {
        return;
    }

    if (remove_from_collection) {

        for (const [md5, _] of beatmaps) {
            remove_beatmap(md5);
        }

        // update single collection
        core.reader.update_collection(name);
    }

    const remove_from_folder = await quick_confirm(`remove from osu folder?`);

    if (remove_from_folder) {
        await delete_beatmaps(Array.from(beatmaps.values()));
    }
};

const create_empty_collection = async (name) => {
    core.reader.collections.beatmaps.set(name, { maps: [] });
    setup_manager();
    show_update_button();
};

const create_new_collection = async () => {

    const method = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "method",
        elements: [{
            key: "name",
            element: { list: ["empty", "from url", "from file", "from player"] }
        }]
    });

    if (!method?.name) {
        return;
    }

    switch (method.name) {

        case "empty": {

            const collection_name = await create_custom_popup({     
                type: message_types.INPUT, 
                label: "collection name" 
            });
            
            if (!collection_name) {
                return;
            }
    
            if (core.reader.collections.beatmaps.has(collection_name)) {
                return create_alert("this collection already exists");
            }
    
            create_empty_collection(collection_name);
            break;
        }
        case "from url": 
            add_new_collection();
            break;
        case "from file": {

            const data = await select_file({
                title: "select the file",
                properties: ["openFile"],
                filters: [
                    { name: "collection files", extensions: ["osdb", "db"], }
                ]
            });

            // cancelled
            if (!data) {
                return;
            }

            const { name, buffer } = data;
            const reader = new Reader();

            const collections = path.extname(name) == ".osdb" ? { b: await reader.get_osdb_data(buffer) } : await reader.get_collections_data(buffer);
            
            // lazy ass solution
            if (path.extname(name) == ".osdb") {

                collections.beatmaps = new Map();

                for (let i = 0; i < collections.b.collections.length; i++) {

                    const data = collections.b.collections[i];
                    const beatmaps = data.hash_only_beatmaps.length == 0 ? data.beatmaps.map((b) => b.md5) : data.hash_only_beatmaps;

                    collections.beatmaps.set(data.name, { maps: new Set(beatmaps) });
                } 
            }

            console.log(collections);

            const select = await create_custom_popup({
                type: message_types.CUSTOM_MENU,
                title: "collections to import",
                elements: [
                    { 
                        key: "collections",
                        element: { 
                            cards: Array.from(collections.beatmaps).map(([k, c]) => {
                                // dont make existing collections selectable 
                                const is_selectable = core.reader.collections.beatmaps.has(k);
                                return {
                                    selectable: !is_selectable,
                                    name: k,
                                    count: c.maps.size
                                }
                            })
                        }
                    }
                ]
            });

            // cancelled
            if (!select || select?.collections.length == 0) {
                return;
            }

            // add collections to manager
            for (const name of select.collections) {
                add_collection_manager(Array.from(collections.beatmaps.get(name).maps), name);
            }

            break;
        }
        default:
            get_from_player();
            break;
    }
};

header_text.addEventListener("click", async () => {
    text_collection.style.display = "block";
    remove_all_selected();
    setup_manager();
});

// setup more options context menu
const more_options = document.querySelector(".more_options");
window.ctxmenu.attach(more_options, [
    { text: "more options" },
    { isDivider: true },
    { text: "create new collection", action: () => create_new_collection() },
    { text: "get missing beatmaps", action: () => get_missing_beatmaps() },
    { text: "delete beatmaps", action: () => delete_beatmaps_manager() }
], { onClick: true, Fixed: { left: "calc(100vw - 220px)", top: `${more_options.getBoundingClientRect().bottom + 15}px` }});

const render = (id, offset = 0, _new = false, _inverted = false) => {

    const elements = [];
    const collection = draggable_items_map.get(id)?.collection;

    if (!collection) {
        console.log("[manager] failed to get collection", id);
        return;
    }

    const { sr_max, bpm_max } = draggable_items_map.get(id)?.collection;

    if (text_collection) {
        text_collection.style.display = "none";
    }

    const sr_filter = get_sr_filter();
    const bpm_filter = get_bpm_filter();

    const beatmaps = Array.from(collection.maps);

    // update sr filter slider min/max
    if (beatmaps.length >= 0 && sr_filter.limit != sr_max) {
        sr_filter.set_limit(sr_max, false);
    }

    // update bpm filter slider min/max
    if (beatmaps.length >= 0 && bpm_filter.limit != bpm_max) {
        bpm_filter.set_limit(bpm_max, false);
    }

    if (rendered_beatmaps.id != id || _new) {
        rendered_beatmaps.id = id;
        rendered_beatmaps.idx = new Set();
    }

    collection_container.dataset.id = draggable_items_map.get(id)?.collection_id;

    if (!beatmaps) {
        return;
    }

    for (let i = offset; i < beatmaps.length; i++) {

        const beatmap = beatmaps[i];

        // make sure we have a valid beatmap (should be valid)
        if (!beatmap) {
            continue;
        }

        // only render x ammounts of item per iteration
        if (elements.length > MAX_RENDER_AMMOUNT) {
            break;
        }

        if (rendered_beatmaps.idx.has(i)) {
            continue;
        }

        // filter by name
        if (!filter_beatmap(beatmap)) {
            continue;
        }

        const beatmap_item = create_beatmap_card(beatmap);
        beatmap_item.dataset.id = i;

        // yay we are gonna render it!!!
        elements.push(beatmap_item);

        // @TODO: this is a very horrible hack
        // but since this entire function sucks ass i gonna have to refactor everything to change this shit
        rendered_beatmaps.idx.add(i);
    }

    if (offset == 0 || _new) {
        collection_container.replaceChildren(...elements);
    } else {
        if (_inverted) {
            collection_container.prepend(...elements);
        } else {
            collection_container.append(...elements);
        }
    }
};

export const render_page = debounce((id, offset = 0, _new = false, _inverted = false) => {
    render(id, offset, _new, _inverted);
}, 10);

collection_container.addEventListener("scroll", () => {

    const first_card = collection_container.firstChild;
    const last_card = collection_container.lastChild;
    const top = collection_container.scrollTop;
    const height = collection_container.scrollHeight;
    const clientH = collection_container.clientHeight;
    
    if (last_card && (height - clientH) - top < 10) {
        const next_offset = Number(last_card.dataset.id) + 1;
        render_page(get_selected_collection().id, next_offset);
        return;
    }
    
    if (first_card && top < 10 && first_card.dataset.id != 0) {

        const current_first_id = Number(first_card.dataset.id);
        const new_offset = Math.max(0, current_first_id - MAX_RENDER_AMMOUNT);
        
        if (new_offset < current_first_id) {
            render_page(get_selected_collection().id, new_offset, false, true);
        }
    }
});

export const merge_collections = (cl1, cl2) => {
    return new Set([...cl1, ...cl2]);
};

update_collection_button.addEventListener("click", async () => {

    const confirm = await quick_confirm("are you sure?");

    if (!confirm) {
        return;
    }
    
    // make sure we have the correct length
    core.reader.collections.length = core.reader.collections.beatmaps.size;

    console.log("[manager] updating collection:", core.reader.collections);

    await core.reader.write_collections_data();
    create_alert("updated!");

    hide_update_button();
});

export const setup_manager = () => {

    // clean list and container
    list.innerHTML = "";
    collection_container.innerHTML = "";
    collection_container.removeAttribute("data-id");

    if (manager_filters.size == 0) {
        manager_filters.set("manager-bpm-filter", create_range({ id: "manager-bpm-filter", text: "bpm range", iden: "", fix: 0, initial: 500 }));
        manager_filters.set("manager-sr-filter", create_range({ id: "manager-sr-filter", text: "difficulty range", iden: "★", fix: 2, initial: 10 }));
        manager_filters.set("dropdown-status-filter", create_dropdown({ id: "dropdown-status-filter", name: "status", values: Object.keys(Reader.get_status_object()) }));
    }

    // clean draggable_items list
    for (let [k] of draggable_items_map) {
        draggable_items_map.delete(k);
    }

    // if filters is not intialized, create and append it to filter box
    if (!document.querySelector(".sr-filter-container")) {

        // get filters (kinda stupid)
        const sr_filter = manager_filters.get("manager-sr-filter");
        const status_filter = manager_filters.get("dropdown-status-filter");
        const bpm_filter = manager_filters.get("manager-bpm-filter");
        
        // create filter containers
        const filter_container = document.querySelector(".filter-box");
        const sr_filter_container = create_element(`<div class="sr-filter-container"></div>`);
        const status_filter_container = create_element(`<div class="status-filter-container"></div>`);
        const bpm_filter_container = create_element(`<div class="bpm-filter-container"></div>`);

        const update = () => {

            const { id } = get_selected_collection();

            if (!id) {
                return;
            }

            // render page again
            render_page(id, 0, true);
        }

        // update maps on filter update
        status_filter.callback = update;
        sr_filter.callback = update;
        bpm_filter.callback = update;

        status_filter_container.appendChild(status_filter.element);
        sr_filter_container.appendChild(sr_filter.element);
        bpm_filter_container.appendChild(bpm_filter.element);

        filter_container.appendChild(sr_filter_container);
        filter_container.appendChild(bpm_filter_container);
        filter_container.appendChild(status_filter_container);
    }

    setup_draggables();
};

// make sure we actually have a md5
const update_map_info = (map) => {

    if (typeof map == 'string') {
        return map;
    }

    if (typeof map == 'object' && map?.md5) {
        return map.md5;
    }

    return null;
};
 
export const update_status_filter = () => {
    const filter = get_status_filter();
    filter.create(Object.keys(Reader.get_status_object()));
};

export const add_collection_manager = async (maps, collection) => {

    const updated_map = new Set(maps.map(map => update_map_info(map)).filter((b) => typeof b == "string"));
    core.reader.collections.beatmaps.set(collection, { maps: updated_map });

    // update all collections count
    update_collections_count();

    await initialize();
    show_update_button();
};

export const initialize = async (options) => {

    if (!core.reader.osu?.beatmaps) {
        list.innerHTML = "";
        return;
    }
    
    const lazer_mode = is_lazer_mode();

    if (options?.force) {

        core.reader.osu = {};

        if (lazer_mode) {
            await core.reader.get_osu_data();
        } else {
            await load_osu_files(core.config.get("stable_path"));
        }
    }

    core.reader.update_collections();
    setup_manager();
};
