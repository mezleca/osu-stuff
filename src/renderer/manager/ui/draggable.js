
import { core } from "../../app.js";
import { DRAG_ACTIVATION_THRESHOLD_MS, fs } from "../../utils/global.js";
import { setup_manager, render_page, merge_collections, show_update_button, get_selected_collection } from "../manager.js";
import { create_element, path } from "../../utils/global.js";
import { create_alert, create_custom_popup, message_types, quick_confirm } from "../../popup/popup.js";
import { create_context } from "./context.js";
import { Reader } from "../../utils/reader/reader.js";

export const draggable_items_map = new Map();

const draggable_context = create_context({
    id: crypto.randomUUID(),
    values: []
});

const search_input = document.querySelector(".collection-search");
const draggable_item_bin = document.querySelector(".draggable_item_bin");
const list = document.querySelector(".list_draggable_items");
const collection_container = document.querySelector(".collection-container");
const list_container = document.querySelector(".list_container");

let mouse_y, mouse_x;

const handle_move = (event) => {
    mouse_x = event.clientX;
    mouse_y = event.clientY;
};

// yeah i could do this with css but i dont give a shit
const update_draggable_item_pos = (draggable_item, id) => {

    const draggable_item_obj = draggable_items_map.get(id);

    if (draggable_item_obj.stop) {
        draggable_item.style.transform = "";
        return;
    }
 
    if (draggable_item.y == null) {
        draggable_item.y = mouse_y;
    }

    if (draggable_item.x == null) {
        draggable_item.x = mouse_x;
    }

    const new_x = mouse_x - draggable_item.x;
    const new_y = mouse_y - draggable_item.y;

    // set pos preview
    draggable_item.style.transform = `translate(${new_x}px, ${new_y}px)`;
};

const reset_preview_pos = (id) => {

    const draggable_item = draggable_items_map.get(id);

    if (!draggable_item) {
        return;
    }

    // remove merge style from all elements
    for (let [k, v] of draggable_items_map) {    
        if (v.target.classList.contains("merge")) {
            v.target.classList.remove("merge");
        }
    }

    // reset style thingy
    draggable_item.target.style = "";

    // remove hidden shit
    draggable_item.target.classList.remove("hidden");

    // reset current state
    draggable_item.dragging = false;
    draggable_item.x = null;
    draggable_item.y = null;
    draggable_item.stop = false;
    draggable_item.hold_time = 0;

    // reset mouse state
    mouse_x = 0;
    mouse_y = 0;
};

export const remove_all_selected = () => {

    const draggable_items = [...document.querySelectorAll(".draggable_item")];

    for (let i = 0; i < draggable_items.length; i++) {

        if (draggable_items[i].classList.contains("selected")) {
            draggable_items[i].classList.remove("selected");
        }
    }
};

const detect_collision = (el1, el2, center) => {

    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();

    const centerX = rect1.left + rect1.width / 2;
    const centerY = rect1.top + rect1.height / 2;

    if (!center) {
        return !(
            rect1.bottom < rect2.top ||
            rect1.top > rect2.bottom ||
            rect1.right < rect2.left ||
            rect1.left > rect2.right
          );
    }
  
    return (
        centerX >= rect2.left &&
        centerX <= rect2.right &&
        centerY >= rect2.top &&
        centerY <= rect2.bottom
    );
};

const drag_callback = (id, placeholder_draggable_item) => {
    
    const draggable_item = draggable_items_map.get(id);

    if (!draggable_item) {
        return;
    }

    // make sure the draggable_item state is still valid.
    if (!draggable_item.dragging || !document.hasFocus()) {
        reset_preview_pos(id);
        return;
    }

    if (!draggable_item.hold_time) {
        draggable_item.hold_time = 0;
    }

    draggable_item.hold_time += 1;

    // give 500ms to enable drag mode
    if (draggable_item.hold_time * 60 < DRAG_ACTIVATION_THRESHOLD_MS) {
        return requestAnimationFrame(() => drag_callback(id, placeholder_draggable_item));
    }

    draggable_item_bin.classList.add("enabled");

    // append the placeholder element
    if (!list_container.contains(placeholder_draggable_item)) {
        placeholder_draggable_item.classList.add("selected");
        draggable_item.target.classList.add("hidden");
        list_container.appendChild(placeholder_draggable_item);
    }

    // enable color transition
    if (detect_collision(placeholder_draggable_item, draggable_item_bin)) {
        draggable_item_bin.classList.add("hover");
    } else {
        draggable_item_bin.classList.remove("hover");
    }

    for (let [k, v] of draggable_items_map) {    

        const other_draggable_item = v.target;

        // ignore hidden draggable_items
        if (other_draggable_item.classList.contains("hidden")) {
            continue;
        }

        if (!detect_collision(placeholder_draggable_item, other_draggable_item, true)) {
            other_draggable_item.classList.remove("merge");      
            continue;
        }

        other_draggable_item.classList.add("merge");
    }

    update_draggable_item_pos(placeholder_draggable_item, id);
    requestAnimationFrame(() => drag_callback(id, placeholder_draggable_item));
};

export const check_merge = async (id) => {

    const draggable_item = draggable_items_map.get(id);

    if (!draggable_item) {
        console.log("[manager ui] failed to get draggable item");
        return false;
    }

    // get the merge draggable_item
    const merge_draggable_item = document.querySelector(".merge");

    if (!merge_draggable_item) {
        return false;
    }

    // force draggable cursor to stop
    draggable_item.stop = true;

    // create a unique array with content from current_draggable_item and merge
    const cl1_id = draggable_items_map.get(merge_draggable_item.id)?.collection_id;
    const cl2_id = draggable_items_map.get(id)?.collection_id;

    if (!cl1_id || !cl2_id) {
        console.log("[manager ui] failed to get collection id", id, merge_draggable_item.id);
        return false;
    }

    const new_name = await create_custom_popup({
        type: message_types.INPUT,
        title: "collection name",
        label: "new collection name",
        input_type: "text",
        value: `${cl2_id} + ${cl1_id}`
    });

    if (!new_name) {
        return false;
    }

    // check if this collection already exists
    if (core.reader.collections.beatmaps.has(new_name)) {
        create_alert("this collection already exists");
        return false;
    }

    const cl1 = core.reader.collections.beatmaps.get(cl1_id).maps;
    const cl2 = core.reader.collections.beatmaps.get(cl2_id).maps;

    if (!cl1 || !cl2) {
        console.log("[manager ui] failed to get collection", id, merge_draggable_item.id);
        return false;
    }

    core.reader.collections.beatmaps.set(new_name, { maps: merge_collections(cl1, cl2) });
    core.reader.update_collections();

    show_update_button();
    setup_manager();
};

export const change_collection_name = async (id, element) => {

    const new_name = await create_custom_popup({
        type: message_types.INPUT,
        title: "new collection name",
        label: "new collection name",
        value: element.textContent,
        input_type: "text",
    });

    if (!new_name) {
        return;
    }

    // check if this collection already exists
    if (core.reader.collections.beatmaps.has(new_name)) {
        create_alert("this collection already exists");
        return;
    }

    element.textContent = new_name;

    const old_draggable_item = draggable_items_map.get(id);
    const old_collection = core.reader.collections.beatmaps.get(old_draggable_item.collection_id);

    if (!old_collection) {
        console.log("[manager ui] failed to get old collection", old_draggable_item);
        return;
    }

    // remove old collection and create a new one with all beatmaps
    core.reader.delete_collection(old_draggable_item.collection_id);
    core.reader.collections.beatmaps.set(new_name, old_collection);

    // update draggable_item object to contain new name
    old_draggable_item.collection.maps = old_collection.maps;
    old_draggable_item.collection_id = new_name;

    // update current draggable_item
    draggable_items_map.delete(id);
    draggable_items_map.set(id, old_draggable_item);

    show_update_button();
};

export const delete_draggable = (collection_id, id, target) => {

    core.reader.delete_collection(collection_id);
    draggable_items_map.delete(id);

    reset_preview_pos();
    list.removeChild(target);
    
    core.progress.update(`deleted ${collection_id}`);
    show_update_button();     
};

export const check_delete_thing = async (id, placeholder_draggable_item) => {

    const draggable_item = draggable_items_map.get(id);

    if (!draggable_item) {
        return false;
    }

    // check if is colliding with the bin
    if (detect_collision(placeholder_draggable_item, draggable_item_bin)) {
    
        const will_delete = await quick_confirm("are you sure?");

        if (will_delete) {

            const collection_id = draggable_items_map.get(id)?.collection_id;

            if (!collection_id) {
                console.log("[manager ui] failed to get collection id on delete", id);
                return false;
            }

            delete_draggable(collection_id, id, draggable_item.target);

            return true;
        }
    }

    return false;
};

const show_all_draggables = () => {

    for (const [k, v] of draggable_items_map) {

    }    
};

search_input.addEventListener("input", () => {

    const value = search_input.value;

    for (const [k, v] of draggable_items_map) {
        
        const target = v.target;
        const name = target.querySelector(".collection-name");
        
        if (name.textContent.toLowerCase().includes(value.toLowerCase())) {
            target.classList.remove("hidden");
        } else {
            target.classList.add("hidden");
        }
    }    
});

export const export_all_beatmaps = async (id) => {
    
    const collection = core.reader.collections.beatmaps.get(id);
    const exported = new Set();

    if (collection.maps.size == 0) {
        create_alert("no maps to export :c");
        return;
    }

    for (const hash of collection.maps) {

        const beatmap = core.reader.osu.beatmaps.get(hash);

        if (!beatmap || exported.has(beatmap.beatmap_id)) {
            continue;
        }

        core.progress.update(`exporting ${beatmap.beatmap_id}...`);

        await core.reader.export_beatmap(beatmap);
        exported.add(beatmap.beatmap_id);
    }

    create_alert(`exported all ${exported.size} beatmaps successfully!`);
};

export const export_collection = async (id) => {

    // get the collcetion by id and create a new collection.db with the exported one
    const collection = core.reader.collections.beatmaps.get(id);

    if (!collection) {
        create_alert("failed to get collection", { type: "error" });
        return;
    }

    const method = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "search option",
        elements: [
            {
                key: "export as",
                element: { list: { options: ["stable collection", "osdb"] }}
            },
        ]
    });

    if (!method) {
        return;
    }

    const reader = new Reader();

    if (method.export_as != "osdb") {

        // set data
        reader.collections = {
            length: 1,
            version: core.reader.collections.version,
            beatmaps: new Map([[id, collection]])
        }
    
        const buffer = reader.write_stable_collection();

        if (!core.config.get("export_path")) {
            create_alert("uhhh, can you please set you export path again? :3");
            return;
        }

        await fs.save_exported(`${id}.db`, buffer);

    } else {

        const beatmaps = Array.from(collection.maps);
        const buffer = await reader.write_osdb_data({
            save_date: new Date(),
            last_editor: "", // no ideia what this is
            collections: [{ 
                name: id,
                online_id: 0, // maybe something related to osu!stats
                hash_only_beatmaps: beatmaps,
                beatmaps: beatmaps.map((md5) => {
                    const beatmap = core.reader.osu.beatmaps.get(md5);
                    return { 
                        md5: md5, 
                        map_id: beatmap?.beatmap_id || 0, // maybe its fine to return 0?
                        map_set_id: beatmap?.beatmapset_id || 0, // maybe its fIne to return 0?
                        user_comment: "",
                    }
                }),
                
            }]
        }, "o!dm7min"); // minimal cuz we might have missing beatmaps

        if (!core.config.get("export_path")) {
            create_alert("uhhh, can you please set you export path again? :3");
            return;
        }

        fs.save_exported(`${id}.osdb`, buffer);
    }
    
    core.progress.update(`exported ${id}`);
};

export const create_collection_item = (id, name) => {

    const element = create_element(`
        <div class="draggable_item">
            <div class="collection-info">
                <svg class="music-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                <h1 class="collection-name"></h1>
            </div>
            <p class="beatmap-count">
                0 maps
            </p>
        </div>
    `);

    const name_element = element.querySelector(".collection-name");
    const count_element = element.querySelector(".beatmap-count");

    name_element.textContent = name;
    element.id = id;

    return { draggable_item: element, name_element: name_element, count_element: count_element };
};

export const update_collections_count = () => {

    for (let [k, v] of draggable_items_map) {

        const item = v.target;
        const collection = v.collection;
        const count = item.querySelector(".beatmap-count");

        if (collection.maps.size == 1) {
            count.textContent = "1 map";
        } else {
            count.textContent = `${collection.maps.size} maps`;
        }
    }
};

export const update_collection_count = (id) => {

    const item = document.getElementById(id);
    const collection = core.reader.collections.beatmaps.get(get_selected_collection());
    const count = item.querySelector(".beatmap-count");

    if (collection.maps.size == 1) {
        count.textContent = "1 map";
    } else {
        count.textContent = `${collection.maps.size} maps`;
    }
};

export const setup_draggables = () => {

    if (!core.reader.osu?.beatmaps) {
        return;
    }

    const collection_keys = Array.from(core.reader.collections.beatmaps.keys());

    for (let [k, v] of core.reader.collections.beatmaps) {

        // create the new elements and append to draggable_items map
        const id = crypto.randomUUID();
        const { draggable_item, name_element, count_element } = create_collection_item(id, k);

        if (!draggable_item) {
            continue;
        }

        list.appendChild(draggable_item);
        
        if (v.maps.size == 1) {
            count_element.textContent = "1 map";
        } else {
            count_element.textContent = `${v.maps?.size || 0} maps`;
        }

        draggable_item.addEventListener("mousedown", (event) => {

            const draggable_item = draggable_items_map.get(id);

            // ignore mouse2 events
            if (event.button == 2) {
                return;
            }

            // save mouse position
            mouse_x = event.clientX;
            mouse_y = event.clientY;
    
            const placeholder_draggable_item = draggable_item.target.cloneNode(true);
    
            const handle_up = async () => {

                // if the holdtime is less than 500, then render the beatmaps page
                if (draggable_item.hold_time * 60 < 500) {

                    // check if this page is already rendered
                    if (collection_container.dataset.id != k) {

                        const current_selected = get_selected_collection(true);          

                        // save the offset of the previous selected collection
                        if (current_selected && collection_container.children.length > 16) {

                            const c_rect = collection_container.getBoundingClientRect();
                            const visible = Array.from(collection_container.children).find((element) => {
                                const rect = element.getBoundingClientRect();
                                return rect.bottom > c_rect.top && rect.top < c_rect.bottom;
                            });

                            draggable_items_map.get(current_selected).offset = visible.dataset.id;
                        }
  
                        // remove selected from all divs
                        remove_all_selected();

                        draggable_item.target.classList.add("selected");
                        draggable_item.selected = true;

                        render_page(id, draggable_item?.offset || 0, true);
                    }
                }

                check_merge(id);
                check_delete_thing(id, placeholder_draggable_item)

                reset_preview_pos(id);

                if (list_container.contains(placeholder_draggable_item)) {
                    list_container.removeChild(placeholder_draggable_item);
                }

                draggable_item_bin.classList.remove("enabled");
                draggable_item_bin.classList.remove("hover");

                document.removeEventListener("mousemove", handle_move);
                document.removeEventListener("mouseup", handle_up);
            };
    
            // create listeners to get mouse_pos and mouse up
            document.addEventListener("mousemove", handle_move);
            document.addEventListener("mouseup", handle_up);

            draggable_item.dragging = true;
            draggable_item.selected = true;

            // get the position from the original draggable_item and pass it to the placeholder.
            const rect = draggable_item.target.getBoundingClientRect();

            // change the placeholder position to the og one.
            placeholder_draggable_item.style.position = "absolute";
            placeholder_draggable_item.style.top = rect.top + "px";
            placeholder_draggable_item.style.left = rect.left + "px";
            placeholder_draggable_item.style.width = rect.width + "px";
            placeholder_draggable_item.style.height = rect.height + "px";
            placeholder_draggable_item.style.zIndex = "999";

            // run the drag_callback
            requestAnimationFrame(() => drag_callback(id, placeholder_draggable_item));
        });

        // @TODO: create one function to do both merge through draggables and context submenu
        const context_merge = async (el) => {
            
            const cl1 = core.reader.collections.beatmaps.get(el);

            if (!cl1) {
                console.log("[merge] failed to get collection 1");
                return;
            }

            // to make sure we get the newest name in case of name changes
            const cl2_name = draggable_items_map.get(id).collection_id;

            const new_name = await create_custom_popup({
                type: message_types.INPUT,
                title: "collection name",
                label: "new collection name",
                input_type: "text",
                value: `${cl2_name} + ${el}`
            });
        
            if (!new_name) {
                return false;
            }
        
            // check if this collection already exists
            if (core.reader.collections.beatmaps.has(new_name)) {
                create_alert("this collection already exists");
                return false;
            }
            
            core.reader.collections.beatmaps.set(new_name, { maps: merge_collections(cl1.maps, v.maps) });
            core.reader.update_collections();

            show_update_button();
            setup_manager();
        }

        draggable_item.addEventListener("contextmenu", () => {

            if (draggable_context.id != id) {

                draggable_context.update([
                    { 
                        type: "submenu", value: "merge with", 
                        values: collection_keys.filter((e) => e != k).map((e) => { return { value: e, callback: () => context_merge(e) } }), 
                    },
                    { type: "default", value: "rename collection", callback: () => { change_collection_name(id, name_element) }},
                    { type: "default", value: "export collection", callback: () => { export_collection(k) }},
                    { type: "default", value: "export beatmaps", callback: () => { export_all_beatmaps(k) }},
                    { type: "default", value: "remove", callback: () => { delete_draggable(k, id, draggable_item) }},
                ]);

                draggable_context.id = id;
            }

            draggable_context.show();
        });

        const new_draggable_item = { 
            id: id,
            y: null,
            x: null,
            target: draggable_item,
            collection: v,
            collection_id: k,
            dragging: false, 
            selected: false 
        };

        draggable_items_map.set(id, new_draggable_item); 
    }
};
