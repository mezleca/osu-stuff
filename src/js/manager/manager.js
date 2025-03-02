import { core, get_files } from "../utils/config.js"
import { setup_collector } from "../stuff/collector.js"
import { create_alert, create_custom_popup, message_types, quick_confirm } from "../popup/popup.js"
import { download_map } from "../utils/download_maps.js"
import { create_download_task, create_task } from "../tabs.js";
import { beatmap_status as _status } from "../stuff/remove_maps.js";
import { download_from_players } from "../stuff/download_from_players.js";
import { missing_download } from "../stuff/missing.js";
import { fetch_osustats } from "../utils/other/fetch.js";
import { debounce, collections, fs, path } from "../utils/global.js";

const header_text = document.querySelector(".collection_header_text");
const more_options = document.querySelector(".more_options");
const list = document.querySelector(".list_draggable_items");
const list_container = document.querySelector(".list_container");
const draggable_item_bin = document.querySelector(".draggable_item_bin");
const collection_container = document.querySelector(".collection-container");
const search_input = document.getElementById("current_search");
const update_collection_button = document.querySelector(".update_collection");

const audio_core = { audio: null, id: 0, target: null };
const draggable_items_map = new Map();
const placeholder_image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
const MAX_RENDER_AMMOUNT = 16;
const DRAG_ACTIVATION_THRESHOLD_MS = 500;

let mouse_y, mouse_x;

const create_element = (data) => {
    return new DOMParser().parseFromString(data, "text/html").body.firstElementChild;
};

export const get_selected_collection = (id) => {

    const draggable_items = [...document.querySelectorAll(".draggable_item")];

    for (let i = 0; i < draggable_items.length; i++) {
        if (draggable_items[i].classList.contains("selected")) {
            return id ? draggable_items[i].id : draggable_items[i].innerText;
        }
    }

    return null;
};
    
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

const remove_all_selected = () => {
    const draggable_items = [...document.querySelectorAll(".draggable_item")];
    for (let i = 0; i < draggable_items.length; i++) {
        const modify_button = draggable_items[i].children[1];
        modify_button.classList.add("hidden");
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

const filter_beatmap = (beatmap, filter) => {

    if (!filter) {
        return true;
    }

    // do this so the user can search for not downloaded beatmaps
    const artist = beatmap?.artist_name || "Unknown";
    const title = beatmap?.song_title || "Unknown";
    const difficulty = beatmap?.difficulty || "Unknown";
    const creator = beatmap.creator_name || "Unknown";
    const tags = beatmap?.tags || "";

    const searchable_text = `${artist} ${title} ${difficulty} ${creator} ${tags}`.toLowerCase();
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

    // need to save
    update_collection_button.style.display = "block";
    document.getElementById(hash).remove();
};

const create_more_button = (id, filter, offset) => {

    const current_draggable_item = draggable_items_map.get(id);
    const button_html = `
        <button class="load_more_button">
            load more (${offset}/${current_draggable_item.collection.length})
        </button>
    `;

    const button_element = create_element(button_html);
    button_element.addEventListener("click", () => {
        button_element.remove();
        render_page(id, filter, offset);
    });

    return button_element;
};

const get_from_player = async () => {

    if (core.login == null) {
        create_alert("Did you forgor to setup your config?");
        return;
    }

    const player = await create_custom_popup({
        type: message_types.INPUT,
        label: "player name",
        input_type: "text",
    });

    if (!player) {
        return;
    }

    const method = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "method",
        elements: [{
            key: "name",
            element: { list: ["best performance", "first place", "favourites", "created maps", "all"] }
        }]
    });

    if (!method.name) {
        return;
    }

    const task_name = `${player} - ${method.name}`;
    await create_task(task_name, download_from_players, player, method.name);
};

const add_new_collection = async () => {

    const prompt = await create_custom_popup({     
        type: "input", 
        label: "add new collection (from url)<br>valid websites: osu!collector, osustats.ppy.sh" 
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
    const current_collection = get_selected_collection(false);

    if (current_collection) {

        const confirmation = await quick_confirm(`merge with ${current_collection}?`);

        if (confirmation) {

            const collection = collections.get(current_collection);

            if (!collection) {
                create_alert("failed to get current collection", { type: "error" } );
                return;
            }

            const new_maps = [...collection, ...maps];
            await add_collection_manager(new_maps, current_collection);
        } 
        else {
                    
            if (collections.has(collection.name)) {
                create_alert("you already have a collection with this name");
                return;
            }

            await add_collection_manager(maps, collection.name);
        }
    } 
    else {
        
        if (collections.has(collection.name)) {
            create_alert("you already have a collection with this name");
            return;
        }

        await add_collection_manager(maps, collection.name);
    }

    const download = await quick_confirm(`download maps from ${collection.name}?`);

    if (!download) {
        return;
    }

    await create_download_task(collection.name, yep_maps);
};

const get_missing_beatmaps = async () => {

    if (core.login == null) {
        create_alert("Did you forgor to setup your config?");
        return;
    }

    create_task("missing beatmaps", missing_download);
};

header_text.addEventListener("click", async () => {
    remove_all_selected();
    setup_manager();
});

more_options.addEventListener("click", async () => {

    // if theres a collection selected, add extra option
    const default_options = ["add new collection", "get from player", "get missing beatmaps"];
    const current_collection = get_selected_collection(false);

    if (current_collection) {
        default_options.push("delete beatmaps");
    }

    const option = await create_custom_popup({
        type: message_types.MENU,
        title: "extra options",
        items: default_options
    });

    if (!option) {
        return;
    }

    switch (option) {
        case "get from player":
            get_from_player();
            break;
        case "get missing beatmaps":
            get_missing_beatmaps();
            break;
        case "add new collection":
            add_new_collection();
            break;
        case "delete beatmaps":
            create_alert("not implemented yet");
            break;
        default:
            create_alert("invalid option");
            break;
    }
});

// @TODO: this only works for "standard" mode
// @TOFIX: sometimes this does not work.
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
                    <div class="beatmap_status">UNKNOWN</div>
                    <div class="beatmap_status star_fucking_rate">★ 0.00</div>
                </div>
            </div>
            <div class="beatmap_controls">
                <button class="preview-button">
                    <i class="bi bi-play-fill"></i>
                </button>      
                <button class="download-button">
                    <i class="bi bi-download"></i>
                </button>
                <button class="remove-btn">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </div>
        </div>
    `;

    // get individual elmeents from beatmap card
    const beatmap_element = create_element(beatmap_html);
    const title = beatmap_element.querySelector('.title');
    const subtitle = beatmap_element.querySelector('.subtitle')
    const download_button = beatmap_element.querySelector(".download-button");
    const beatmap_bg = beatmap_element.querySelector(".bg-image");
    const beatmap_status = beatmap_element.querySelector(".beatmap_thing_status").children[0];
    const remove_button = beatmap_element.querySelector(".remove-btn");
    const preview_button = beatmap_element.querySelector(".preview-button");
    const star_rating = beatmap_element.querySelector(".star_fucking_rate");

    const status = Object.entries(_status).find(([k, v]) => v === beatmap.status)?.[0];
    const beatmap_sr = get_beatmap_sr(beatmap);

    const update_status = (status) => {
        switch (status) {
            case "pending":
                beatmap_status.classList.add("pending");
                beatmap_status.innerText = "PENDING";
                break;
            case "ranked":
                beatmap_status.classList.add("ranked");
                beatmap_status.innerText = "RANKED";
                break;
            case "approved":
                beatmap_status.classList.add("ranked");
                beatmap_status.innerText = "APPROVED";
                break;
            case "qualified":
                beatmap_status.classList.add("qualified");
                beatmap_status.innerText = "QUALIFIED";
                break;
            case "loved":
                beatmap_status.classList.add("loved");
                beatmap_status.innerText = "LOVED";
                break;
            default:
                break;
        }
    };

    const update_sr = (beatmap_sr) => {

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
    };

    update_status(status);

    if (beatmap_sr) {
        update_sr(beatmap_sr);
    }

    // set shit for lazy loading
    beatmap_element.dataset.title = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]`.toLowerCase() : "Unknown (not downloaded)".toLowerCase();
    beatmap_element.dataset.mapper = beatmap.creator_name ? beatmap.creator_name.toLowerCase() : "Unknown";
    beatmap_element.dataset.tags = beatmap.tags ? beatmap.tags.toLowerCase() : "";
    beatmap_element.dataset.artist = beatmap.artist_name ? beatmap.artist_name.toLowerCase() : "";
    beatmap_element.id = beatmap.md5;

    title.textContent = beatmap?.song_title || "Unknown";
    subtitle.textContent = beatmap?.difficulty || "Unknown";

    beatmap_bg.src = has_beatmap ? image_url : placeholder_image;
    remove_button.id = `bn_${beatmap.beatmap_id}`;

    if (has_beatmap) {

        title.addEventListener("click", () => {
            const url = beatmap.url || `https://osu.ppy.sh/b/${beatmap.difficulty_id}`;
            window.electron.shell.openExternal(url);
        });

        // @TODO: get mp3 from osu folder for downloaded beatmaps
        preview_button.addEventListener("click", async () => {

            const play = () => {
                audio_core.audio.play();
                audio_core.target.classList.add("bi-pause-fill");
                audio_core.target.classList.remove("bi-play-fill"); 
            };

            const stop = () => {
                audio_core.audio.pause();
                audio_core.audio.currentTime = 0;
                audio_core.target.classList.remove("bi-pause-fill");
                audio_core.target.classList.add("bi-play-fill"); 
            };

            // update target in case its another diff from the same map
            if (audio_core.id == beatmap.beatmap_id) {
                if (audio_core.audio.paused) {            
                    audio_core.target = preview_button.children[0];    
                    return play();
                }
                return stop();
            }

            // prevent double audio
            if (audio_core.audio) {
                stop();
            }

            const preview_data = await fetch(`https://b.ppy.sh/preview/${beatmap.beatmap_id}.mp3`);
            const buffer = await preview_data.arrayBuffer();

            // create a new audio source using the preview buffer
            const audio_source = new Blob([buffer], { type: "audio/wav" }); 

            // initialize new audio object
            audio_core.audio = new Audio(window.URL.createObjectURL(audio_source));
            audio_core.audio.volume = 0.5;
            audio_core.id = beatmap.beatmap_id;
            audio_core.target = preview_button.children[0];

            audio_core.audio.addEventListener("ended", stop);

            play();
        });

        download_button.remove();
    } else {
        preview_button.remove();
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
                beatmap_id: beatmap_data.beatmapset.id,
                url: beatmap_data.url,
                status: _status[beatmap_data.status] || 0
            });

            const image_url = `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/cover.jpg`;

            update_status(beatmap_data.status);
            update_sr(beatmap_data.difficulty_rating);

            title.addEventListener("click", () => {
                const url = beatmap.url || `https://osu.ppy.sh/b/${beatmap.difficulty_id}`;
                window.electron.shell.openExternal(url);
            });
         
            title.textContent = beatmap?.song_title || "Unknown";
            subtitle.textContent = beatmap?.difficulty || "Unknown";
            beatmap_bg.src = image_url;
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

    const collection = draggable_items_map.get(id)?.collection;
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

    collection_container.dataset.id = draggable_items_map.get(id)?.collection_id;
};

const check_delete_thing = async (id, placeholder_draggable_item) => {

    const draggable_item = draggable_items_map.get(id);

    if (!draggable_item) {
        return false;
    }

    // check if is colliding with the bin
    if (detect_collision(placeholder_draggable_item, draggable_item_bin)) {
    
        const will_delete = await quick_confirm("Are you sure?");

        if (will_delete) {

            const collection_id = draggable_items_map.get(id)?.collection_id;

            if (!collection_id) {
                console.log("failed to get collection id", id);
                return false;
            }

            collections.delete(collection_id);
            draggable_items_map.delete(id);

            reset_preview_pos();
            list.removeChild(draggable_item.target);
            
            // need to save
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

    const draggable_item = draggable_items_map.get(id);

    if (!draggable_item) {
        console.log("???");
        return false;
    }

    // get the merge draggable_item
    const merge_draggable_item = document.querySelector(".merge");
    if (!merge_draggable_item) {
        return false;
    }

    // force draggable_item cursor to stop
    draggable_item.stop = true;

    const new_name = await create_custom_popup({
        type: message_types.INPUT,
        title: "collection name",
        label: "new collection name",
        input_type: "text",
    });

    if (!new_name) {
        return false;
    }

    // check if this collection already exists
    if (collections.has(new_name)) {
        create_alert("this collection already exists");
        return false;
    }

    // create a unique array with content from current_draggable_item and merge
    const cl1_id = draggable_items_map.get(merge_draggable_item.id)?.collection_id;
    const cl2_id = draggable_items_map.get(id)?.collection_id;

    if (!cl1_id || !cl2_id) {
        console.log("failed to get collection id", id, merge_draggable_item.id);
        return false;
    }

    const cl1 = collections.get(cl1_id);
    const cl2 = collections.get(cl2_id);

    if (!cl1 || !cl2) {
        console.log("failed to get collection", id, merge_draggable_item.id);
        return false;
    }

    collections.set(new_name, merge_collections(cl1, cl2));

    // need to save
    update_collection_button.style.display = "block";
    setup_manager();
};

const change_collection_name = async (event, id, name_element) => {

    event.stopPropagation();

    const new_name = await create_custom_popup({
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

    const old_draggable_item = draggable_items_map.get(id);
    const old_collection = collections.get(old_draggable_item.collection_id);

    if (!old_collection) {
        console.log("failed to get old collection", old_draggable_item);
        return;
    }

    // remove old collection and create a new one with all beatmaps
    collections.delete(old_draggable_item.collection_id);
    collections.set(new_name, old_collection);

    // update draggable_item object to contain new name
    old_draggable_item.collection = old_collection;
    old_draggable_item.collection_id = new_name;

    // update current draggable_item
    draggable_items_map.delete(id);
    draggable_items_map.set(id, old_draggable_item);

    // need to save
    update_collection_button.style.display = "block";
};

update_collection_button.addEventListener("click", async () => {

    const confirm = await quick_confirm("are you sure?<br>if you click yes your collection file will be modified");

    if (!confirm) {
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
    create_alert("done!");

    update_collection_button.style.display = "none";
});

const setup_manager = () => {

    // clean list and container
    list.innerHTML = "";
    collection_container.innerHTML = "";
    collection_container.removeAttribute("data-id");

    // clean draggable_items list
    for (let [k] of draggable_items_map) {
        draggable_items_map.delete(k);
    }

    for (let [k, v] of collections) {

        // create the new elements and append to draggable_items map
        const id = crypto.randomUUID();
        const draggable_item_html = `
            <div class="draggable_item" id=${id}>
                <h1>${k}</h1>
                <i class="bi bi-pencil-square hidden"></i>
            </div>
        `;

        const draggable_item = create_element(draggable_item_html);

        const draggable_item_name = draggable_item.children[0];
        const modify_name = draggable_item.children[1];

        list.appendChild(draggable_item);

        draggable_item_name.addEventListener("mousedown", (event) => {

            const draggable_item = draggable_items_map.get(id);

            // save mouse position
            mouse_x = event.clientX;
            mouse_y = event.clientY;
    
            // @TODO: better way to move element thorugh divs
            const placeholder_html = `
                <div class="draggable_item">
                    <h1>${draggable_item_name.innerText}</h1>
                    <i class="bi bi-pencil-square"></i>
                </div>
            `
            const placeholder_draggable_item = create_element(placeholder_html);
    
            const handle_up = async () => {

                // if the holdtime is less than 500, then render the beatmaps page
                if (draggable_item.hold_time * 60 < 500) {

                    // check if this page is already rendered
                    if (collection_container.dataset.id != k) {
  
                        // remove selected from all divs
                        remove_all_selected();

                        draggable_item.target.classList.add("selected");
                        draggable_item.target.children[1].classList.remove("hidden");
                        draggable_item.selected = true;

                        render_page(id);
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

        modify_name.addEventListener("click", async (event) => {
            await change_collection_name(event, id, draggable_item_name);
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

    const updated_map = maps.map(map => update_map_info(map));
    collections.set(collection, updated_map);

    await initialize();
    setup_manager();

    // need to save
    update_collection_button.style.display = "block";
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
