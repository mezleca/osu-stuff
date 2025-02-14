import { core, get_files } from "../utils/config.js"
import { setup_collector } from "../stuff/collector.js"
import { create_alert, create_custom_message, message_types } from "../popup/popup.js"
import { download_map } from "../utils/download_maps.js"
import { create_download_task } from "../tabs.js";
import { save_to_db, get_from_database } from "../utils/other/indexed_db.js";

const style = window.getComputedStyle(document.body);

const more_options = document.querySelector(".more_options");
const list = document.querySelector(".list_selectors");
const list_container = document.querySelector(".list_container");
const selector_bin = document.querySelector(".selector_bin");
const collection_container = document.querySelector(".collection-container");
const search_input = document.getElementById("current_search");
const update_collection_button = document.querySelector(".update_collection");

const selectors_map = new Map();
export const collections = new Map();
const placeholder_image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const MAX_RENDER_AMMOUNT = 16;
// @TODO: idk why but on electron the y is wrong by like 80+ pixels.
const ELECTRON_BULLSHIT = 80;

let mouse_y, mouse_x;

const fs = window.nodeAPI.fs;
const path = window.nodeAPI.path;

export const debounce = (func, delay) => {

    let timeout;

    return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), delay)
    };
}

const create_element = (data) => {
    return new DOMParser().parseFromString(data, "text/html").body.firstElementChild;
};

const get_selected_collection = (id) => {

    const selectors = [...document.querySelectorAll(".selector")];

    for (let i = 0; i < selectors.length; i++) {
        if (selectors[i].classList.contains("selected")) {
            return id ? selectors[i].id : selectors[i].innerText;
        }
    }

    return null;
};
    
const handle_move = (event) => {
    mouse_x = event.clientX;
    mouse_y = event.clientY;
};

// yeah i could do this with css but i dont give a shit
const update_selector_pos = (selector) => {
 
    if (selector.y == null) {
        selector.y = mouse_y;
    }

    if (selector.x == null) {
        selector.x = mouse_x;
    }

    const new_x = mouse_x - selector.x;
    const new_y = mouse_y - selector.y - ELECTRON_BULLSHIT;

    // set pos preview
    selector.style.transform = `translate(${new_x}px, ${new_y}px)`;
};

const reset_preview_pos = (id) => {

    const selector = selectors_map.get(id);

    if (!selector) {
        return;
    }

    // remove merge style from all elements
    for (let [k, v] of selectors_map) {    
        if (v.target.classList.contains("merge")) {
            v.target.classList.remove("merge");
        }
    }

    // reset style thingy
    selector.target.style = "";

    // remove hidden shit
    selector.target.classList.remove("hidden");

    // reset current state
    selector.dragging = false;
    selector.x = null;
    selector.y = null;
    selector.hold_time = 0;

    // reset mouse state
    mouse_x = 0;
    mouse_y = 0;
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

const drag_callback = (id, placeholder_selector) => {
    
    const selector = selectors_map.get(id);

    if (!selector) {
        return;
    }

    // make sure the selector state is still valid.
    if (!selector.dragging || !document.hasFocus()) {
        reset_preview_pos(id);
        return;
    }

    if (!selector.hold_time) {
        selector.hold_time = 0;
    }

    selector.hold_time += 1;

    // give 500ms to enable drag mode
    if (selector.hold_time * 60 < 500) {
        return requestAnimationFrame(() => drag_callback(id, placeholder_selector));
    }

    selector_bin.classList.add("enabled");

    // append the placeholder element
    if (!list_container.contains(placeholder_selector)) {
        placeholder_selector.classList.add("selected");
        selector.target.classList.add("hidden");
        list_container.appendChild(placeholder_selector);
    }

    // enable color transition
    if (detect_collision(placeholder_selector, selector_bin)) {
        selector_bin.classList.add("hover");
    } else {
        selector_bin.classList.remove("hover");
    }

    for (let [k, v] of selectors_map) {    

        const other_selector = v.target;

        // ignore hidden selectors
        if (other_selector.classList.contains("hidden")) {
            continue;
        }

        if (!detect_collision(placeholder_selector, other_selector, true)) {
            other_selector.classList.remove("merge");      
            continue;
        }

        other_selector.classList.add("merge");
    }

    update_selector_pos(placeholder_selector);
    requestAnimationFrame(() => drag_callback(id, placeholder_selector));
};

const filter_beatmap = (beatmap, filter) => {

    if (!filter) {
        return true;
    }

    const searchable_text = `${beatmap.artist_name} ${beatmap.song_title} ${beatmap.difficulty} ${beatmap.creator_name} ${beatmap.tags}`.toLowerCase();
    return searchable_text.includes(filter.toLowerCase());
};

search_input.addEventListener("input", debounce(() => {

    const selected_id = get_selected_collection(true);

    if (!selected_id) {
        return;
    }

    render_page(selected_id, search_input.value.toLowerCase(), 0);
}, 300));

const remove_beatmap = (hash) => {

    const name = get_selected_collection();
    const beatmaps = collections.get(name);

    if (!beatmaps) {
        console.log("failed to get collection", name);
        return;
    }

    for (let i = 0; i < beatmaps.length; i++) {

        const beatmap = beatmaps[i];

        if (beatmap.md5 == hash) {
            beatmaps.splice(i, 1);
            break;
        }
    }

    update_collection_button.style.display = "block";
    document.getElementById(hash).remove();
};

const create_more_button = (id, filter, offset) => {

    const current_selector = selectors_map.get(id);
    const button_html = `
        <button class="load_more_button">
            load more (${offset}/${current_selector.collection.length})
        </button>
    `;

    const button_element = create_element(button_html);
    button_element.addEventListener("click", () => {
        button_element.remove();
        render_page(id, filter, offset);
    });

    return button_element;
};

more_options.addEventListener("click", () => {
});

// @TODO: this only works for "standard" mode
const get_beatmap_sr = (beatmap) => {
    try {
        const beatmap_sr = beatmap?.sr[0] || 0; // lmao
        if (beatmap_sr) {
            if (!beatmap_sr.sr.length) {
                return 0;
            } else {
                return Number(beatmap_sr.sr[0][1]).toFixed(2);
            }   
        }
    } catch(err) {
        return 0;
    }  
};

const render_beatmap = (beatmap) => {

    const has_beatmap = Boolean(beatmap.artist_name);

    // @TODO: implement sr thing, status

    const image_url = `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/cover.jpg`;
    const beatmap_html = `
        <div class="mini-container">
            <img class="bg-image">
            <div class="beatmap_metadata">
                <div class="title">placeholder</div>
                <div class="subtitle">placeholder</div>
                <div class="beatmap_thing_status">
                    <div class="beatmap_status ranked">RANKED</div>
                    <div class="beatmap_status star_fucking_rate">★ 0.00</div>
                </div>
            </div>
            <div class="beatmap_controls">      
                <button class="download-button"><i class="bi bi-download"></i></button>
                <button class="remove-btn"><i class="bi bi-trash-fill"></i></button>
            </div>
        </div>
    `;

    // get individual elmeents from beatmap card
    const beatmap_element = create_element(beatmap_html);
    const title = beatmap_element.querySelector('.title');
    const subtitle = beatmap_element.querySelector('.subtitle')
    const download_button = beatmap_element.querySelector(".download-button");
    const beatmap_bg = beatmap_element.querySelector(".bg-image");
    const remove_button = beatmap_element.querySelector(".remove-btn");
    const star_rating = beatmap_element.querySelector(".star_fucking_rate");
    //const mapper = beatmap_element.querySelector(".beatmap_mapper");

    const beatmap_sr = get_beatmap_sr(beatmap);

    if (beatmap_sr) {

        star_rating.innerText = `★ ${beatmap_sr}`;

        // @TODO: ...
        if (beatmap_sr >= 1 && beatmap_sr <= 2.99) {
            star_rating.classList.add("sr1");
        }

        if (beatmap_sr >= 3 && beatmap_sr <= 4.99) {
            star_rating.classList.add("sr2");
        }

        if (beatmap_sr >= 5 && beatmap_sr <= 6.99) {
            star_rating.classList.add("sr3");
        }

        if (beatmap_sr >= 7 && beatmap_sr <= 7.99) {
            star_rating.classList.add("sr4");
        }

        if (beatmap_sr >= 8 && beatmap_sr <= 8.99) {
            star_rating.classList.add("sr5");
        }

        if (beatmap_sr >= 9) {
            star_rating.classList.add("sr6");
        }

        // if its more than 7 stars turn that shit yellow
        if (beatmap_sr >= 7) {
            star_rating.style.color = "#ebcf34";
        }
    }

    // set shit for lazy loading
    beatmap_element.dataset.title = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]`.toLowerCase() : "Unknown (not downloaded)".toLowerCase();
    beatmap_element.dataset.mapper = beatmap.creator_name ? beatmap.creator_name.toLowerCase() : "Unknown";
    beatmap_element.dataset.tags = beatmap.tags ? beatmap.tags.toLowerCase() : "";
    beatmap_element.dataset.artist = beatmap.artist_name ? beatmap.artist_name.toLowerCase() : "";
    beatmap_element.id = beatmap.md5;

    title.textContent = beatmap?.song_title || "Unknown";
    subtitle.textContent = beatmap?.difficulty || "Unknown";
    // mapper.innerText = `mapped by ${beatmap.creator_name}`;

    beatmap_bg.src = has_beatmap ? image_url : placeholder_image;
    remove_button.id = `bn_${beatmap.beatmap_id}`;

    if (has_beatmap) {

        title.addEventListener("click", () => {
            const url = beatmap.url || `https://osu.ppy.sh/b/${beatmap.difficulty_id}`;
            // window.electron.shell.openExternal(url);
        });

        download_button.remove();
    } else {

        download_button.addEventListener("click", async () => {

            create_alert("searching beatmap...");

            const beatmap_data = await download_map(beatmap.md5);

            if (!beatmap_data) {
                create_alert("Beatmap not found :c", { type: "alert" });
                return;
            }

            Object.assign(beatmap, {
                artist_name: beatmap_data.beatmapset.artist,
                song_title: beatmap_data.beatmapset.title,
                difficulty: beatmap_data.version,
                md5: beatmap_data.checksum,
                creator_name: beatmap_data.beatmapset.creator,
                difficulty_id: beatmap_data.beatmapset_id,
                url: beatmap_data.url,
                bg: beatmap_data.beatmapset.covers.list
            });

            title.innerText = `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]`;
            subtitle.innerText = `mapped by ${beatmap.creator_name}`;
            beatmap_bg.src = beatmap.bg;
        });
    }

    remove_button.addEventListener("click", () => {
        remove_beatmap(beatmap.md5);
    });

    return beatmap_element;
};

const render_page = (id, filter, _offset) => {

    let offset = _offset || 0, add_more = true;

    if (offset == 0) {
        collection_container.innerHTML = "";
    }

    const collection = selectors_map.get(id)?.collection;
    const text_collection = document.getElementById("collection_text");

    if (!collection) {
        console.log("failed to get collection", id);
        return;
    }

    if (text_collection) {
        text_collection.remove();
    }

    // only render 16 at time
    for (let i = 0; i < MAX_RENDER_AMMOUNT; i++) {

        // check if i reached the collection limit
        if (offset >= collection.length) {
            add_more = false;
            break;
        }

        // filter shit
        if (filter && !filter_beatmap(collection[offset], filter)) {
            offset++;
            i--;
            continue;
        }

        // check if the beatmap is valid (should be)
        if (!collection[offset]) {
            offset++;
            continue;
        }

        const beatmap_item = render_beatmap(collection[offset]);
        collection_container.appendChild(beatmap_item);

        offset++;
    }

    if (add_more) {
        const load_more_button = create_more_button(id, filter, offset);
        collection_container.appendChild(load_more_button);
    }
};

const check_delete_thing = (id, placeholder_selector) => {

    const selector = selectors_map.get(id);

    if (!selector) {
        console.log("???");
        return false;
    }

    // check if is colliding with the bin
    if (detect_collision(placeholder_selector, selector_bin)) {
    
        const will_delete = confirm("Are you sure?");

        if (will_delete) {

            const collection_id = selectors_map.get(id)?.collection_id;

            if (!collection_id) {
                console.log("failed to get collection id", id);
                return false;
            }

            collections.delete(collection_id);

            reset_preview_pos(id);
            selectors_map.delete(id);
            
            list.removeChild(selector.target);
            update_collection_button.style.display = "block";
            return true;
        }
    }

    return false;
};

const merge_collections = (cl1, cl2) => {

    const merged_map = new Map();
  
    [...cl1, ...cl2].forEach(item => {
        merged_map.set(item.md5, item);
    });
  
    return Array.from(merged_map.values());
  };

const check_merge = async (id) => {
    
    const selector = selectors_map.get(id);

    if (!selector) {
        console.log("???");
        return false;
    }

    // get the merge selector
    const merge_selector = document.querySelector(".merge");

    if (!merge_selector) {
        return false;
    }

    // create a unique array with content from current_selector and merge
    const cl1_id = selectors_map.get(merge_selector.id)?.collection_id;
    const cl2_id = selectors_map.get(id)?.collection_id;

    if (!cl1_id || !cl2_id) {
        console.log("failed to get collection id", id, merge_selector.id);
        return false;
    }

    const cl1 = collections.get(cl1_id);
    const cl2 = collections.get(cl2_id);

    if (!cl1 || !cl2) {
        console.log("failed to get collection", id, merge_selector.id);
        return false;
    }

    const content = merge_collections(cl1, cl2);
    const new_name = await create_custom_message({
        type: message_types.INPUT,
        title: "collection name",
        label: "new collection name",
        input_type: "text",
    });

    if (!new_name) {
        return false;
    }

    collections.set(new_name, content);

    // setup manager again
    setup_manager();
};

const change_collection_name = async (event, id, name_element) => {

    event.stopPropagation();

    const new_name = await create_custom_message({
        type: message_types.INPUT,
        title: "new collection name",
        label: "new collection name",
        input_type: "text",
    });

    if (!new_name) {
        return;
    }

    // check if this collection already exists
    if (collections.has(new_name)) {
        create_alert("this collection already exists");
        return;
    }

    name_element.innerText = new_name;

    const old_selector = selectors_map.get(id);
    const old_collection = collections.get(old_selector.collection_id);

    if (!old_collection) {
        console.log("failed to get old collection", old_selector);
        return;
    }

    console.log(old_selector.collection_id, old_selector);

    // remove old collection and create a new one with all beatmaps
    collections.delete(old_selector.collection_id);
    collections.set(new_name, old_collection);

    // update selector object to contain new name
    old_selector.collection = old_collection;
    old_selector.collection_id = new_name;

    // update current selector
    selectors_map.delete(id);
    selectors_map.set(id, old_selector);

    update_collection_button.style.display = "block";
};

update_collection_button.addEventListener("click", async () => {

    const confirm = await create_custom_message({
        type: message_types.MENU,
        title: "are you sure?<br>if you click yes your collection file will be modified",
        items: ["yes", "no"]
    });

    if (confirm != "yes") {
        return;
    }

    const new_collection = {
        version: core.reader.collections.version,
        length: collections.size,
        beatmaps: []
    };

    for (let [k, v] of collections) {
        const obj = { name: k, maps: [] };
        for (let i = 0 ; i < v.length; i++) {
            const map = v[i];
            obj.maps.push(map.md5);
        }
        new_collection.beatmaps.push(obj);
    }

    console.log("updated collection:", new_collection);

    core.reader.collections = new_collection;
    const backup_name = `collection_backup_${Date.now()}.db`;

    const old_name = path.resolve(core.config.get("osu_path"), "collection.db"), 
          new_name = path.resolve(core.config.get("osu_path"), backup_name);

    await fs.renameSync(old_name, new_name);

    core.reader.write_collections_data(old_name);
    create_alert("Done!");

    update_collection_button.style.display = "none";
});

const setup_manager = () => {

    // clean list and container
    list.innerHTML = "";
    collection_container.innerHTML = "";

    // clean selectors list
    for (let [k] of selectors_map) {
        selectors_map.delete(k);
    }

    for (let [k, v] of collections) {

        // create the new elements and append to selectors map
        const id = crypto.randomUUID();
        const selector_html = `
            <div class="selector" id=${id}>
                <h1>${k}</h1>
                <i class="bi bi-pencil-square hidden"></i>
            </div>
        `;

        const selector = create_element(selector_html);

        const selector_name = selector.children[0];
        const modify_name = selector.children[1];

        list.appendChild(selector);

        selector_name.addEventListener("mousedown", (event) => {

            const selector = selectors_map.get(id);

            // save mouse position
            mouse_x = event.clientX;
            mouse_y = event.clientY;
    
            // @TODO: better way to move element thorugh divs
            const placeholder_html = `
                <div class="selector">
                    <h1>${selector_name.innerText}</h1>
                    <i class="bi bi-pencil-square"></i>
                </div>
            `
            const placeholder_selector = create_element(placeholder_html);
    
            const handle_up = async () => {

                // if the holdtime is less than 500, then render the beatmaps page
                if (selector.hold_time * 60 < 500) {

                    const selectors = [...document.querySelectorAll(".selector")]

                    // remove selected from all divs
                    for (let i = 0; i < selectors.length; i++) {

                        // only show "modify button" if the selector is selected
                        const modify_button = selectors[i].children[1];
                        modify_button.classList.add("hidden");

                        if (selectors[i].classList.contains("selected")) {
                            selectors[i].classList.remove("selected");
                        }
                    }

                    selector.target.classList.add("selected");
                    selector.target.children[1].classList.remove("hidden");
                    selector.selected = true;

                    render_page(id);
                }
                
                // check merge
                if (!await check_merge(id)) {
                    reset_preview_pos(id);
                }

                // chck delete
                if (!check_delete_thing(id, placeholder_selector)) {
                    reset_preview_pos(id);
                }

                if (list_container.contains(placeholder_selector)) {
                    list_container.removeChild(placeholder_selector);
                }

                selector_bin.classList.remove("enabled");
                selector_bin.classList.remove("hover");

                document.removeEventListener("mousemove", handle_move);
                document.removeEventListener("mouseup", handle_up);
            };
    
            // create listeners to get mouse_pos and mouse up
            document.addEventListener("mousemove", handle_move);
            document.addEventListener("mouseup", handle_up);

            selector.dragging = true;
            selector.selected = true;

            // get the position from the original selector and pass it to the placeholder.
            const rect = selector.target.getBoundingClientRect();

            // change the placeholder position to the og one.
            placeholder_selector.style.position = "absolute";
            placeholder_selector.style.top = rect.top + "px";
            placeholder_selector.style.left = rect.left + "px";
            placeholder_selector.style.width = rect.width + "px";
            placeholder_selector.style.height = rect.height + "px";
            placeholder_selector.style.zIndex = "999";

            // run the drag_callback
            requestAnimationFrame(() => drag_callback(id, placeholder_selector));
        });

        modify_name.addEventListener("click", async (event) => {
            await change_collection_name(event, id, selector_name);
        });

        const new_selector = { 
            id: id,
            y: null,
            x: null,
            target: selector,
            collection: v,
            collection_id: k,
            dragging: false, 
            selected: false 
        };

        selectors_map.set(id, new_selector); 
    }
};

const update_map_info = (map) => {

    if (typeof map === 'string') {
        return core.reader.osu.beatmaps.get(map) || { md5: map };
    } else if (typeof map === 'object' && map.md5) {
        const info = core.reader.osu.beatmaps.get(map.md5);
        return info ? { ...map, ...info } : map;
    }

    return map;
};

export const add_collection_manager = async (maps, collection) => {
    const updated_map = maps.map(md5 => update_map_info({ md5 }));
    collections.set(collection.name, updated_map);
    await initialize();
    setup_manager();
};

export const initialize = async (options) => {

    const no_update = options?.no_update || false;
    const force = options?.force || false;

    if (!core.reader.buffer) {
        return;
    }

    if (force) {
        await get_files(core.config.get("osu_path"));
    }

    if (collections.size === 0) {
        for (const collection of core.reader.collections.beatmaps) {
            const updated_map = collection.maps.map(update_map_info);
            collections.set(collection.name, updated_map);
        }
    } else { 
        for (const [name, maps] of collections) {
            const updated_map = maps.map(update_map_info);
            collections.set(name, updated_map);
        }
    }

    if (!no_update) {
        setup_manager();
    }
};