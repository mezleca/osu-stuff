import { core, load_osu_files, create_element } from "../utils/config.js"
import { setup_collector } from "../stuff/collector.js"
import { create_alert, create_custom_popup, message_types, quick_confirm } from "../popup/popup.js"
import { download_map } from "../utils/download_maps.js"
import { create_download_task, create_task } from "../events/events.js";
import { beatmap_status as _status, beatmap_status, delete_beatmaps } from "../stuff/remove_maps.js";
import { download_from_players } from "../stuff/download_from_players.js";
import { missing_download } from "../stuff/missing.js";
import { fetch_osustats } from "../utils/other/fetch.js";
import { debounce, collections, fs, path, placeholder_image, MAX_RENDER_AMMOUNT, star_ranges } from "../utils/global.js";
import { filter_beatmap, sr_filter, status_filter, bpm_filter } from "./ui/filter.js";
import { draggable_items_map, remove_all_selected, setup_draggables } from "./ui/draggable.js";
import { create_context_menu } from "./ui/context.js";
import { get_beatmap_sr, get_beatmap_bpm } from "./tools/beatmaps.js";

const list = document.querySelector(".list_draggable_items");
const header_text = document.querySelector(".collection_header_text");
const more_options = document.querySelector(".more_options");
const collection_container = document.querySelector(".collection-container");
const search_input = document.getElementById("current_search");
const update_collection_button = document.querySelector(".update_collection");

const audio_core = { audio: null, id: 0, target: null };
const default_options = ["create new collection", "get missing beatmaps"];

export const get_selected_collection = (id) => {

    const draggable_items = [...document.querySelectorAll(".draggable_item")];

    for (let i = 0; i < draggable_items.length; i++) {
        if (draggable_items[i].classList.contains("selected")) {
            return id ? draggable_items[i].id : draggable_items[i].innerText;
        }
    }

    return null;
};

search_input.addEventListener("input", debounce(() => {

    const selected_id = get_selected_collection(true);

    if (!selected_id) {
        return;
    }

    render_page(selected_id, 0);
}, 300));

const remove_beatmap = (hash) => {

    const name = get_selected_collection();
    const beatmaps = collections.get(name).maps;

    if (!beatmaps) {
        console.log("[Manager] failed to get collection", name);
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

const create_more_button = (id, offset) => {

    const current_draggable_item = draggable_items_map.get(id);
    const button_html = `
        <button class="load_more_button">
            load more (${offset}/${current_draggable_item.collection.maps.length})
        </button>
    `;

    const button_element = create_element(button_html);
    button_element.addEventListener("click", () => {
        button_element.remove();
        render_page(id, offset);
    });

    return button_element;
};

const get_from_player = async () => {

    if (core.login == null) {
        create_alert("Did you forgor to setup your config?");
        return;
    }

    const method = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "custom options",
        elements: [
            {
                key: "player name",
                element: { input: { } }
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

    if (!method.player_name) {
        return;
    }

    if (method.beatmap_options.length == 0) {
        create_alert("please select at least one beatmap option", { type: "warning" });
        return;
    }

    if (method.beatmap_status.length == 0) {
        method.beatmap_status.push("all");        
    }
    

    // @TODO: this is a hack, i have no ideia but im getting duplicated options
    const options = new Set(method.beatmap_options);

    method.name = `${method.player_name} - (${Array.from(options.values()).join(", ")})`;
    await create_task(method.name, download_from_players, method);
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

            const collection = collections.get(current_collection).maps;

            if (!collection) {
                create_alert(`failed to get current collection ${collection} ${current_collection}`, { type: "error" } );
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

const delete_beatmaps_manager = async () => {
    
    const name = get_selected_collection();

    // make sure the collection is valid
    if (!name) {
        create_alert("failed to get current collection", { type: "error" });
        return;
    }

    const old_collection = collections.get(name);
    const all_beatmaps = Array.from(old_collection.maps);
    const beatmaps = new Map();

    if (!all_beatmaps) {
        create_alert("[Manager] failed to get collection beatmaps", { type: "error" });
        return;
    }

    for (let i = 0; i < all_beatmaps.length; i++) {
        if (filter_beatmap(all_beatmaps[i])) {
            beatmaps.set(all_beatmaps[i].md5, all_beatmaps[i]);
        }
    }

    if (beatmaps.length == 0) {
        create_alert("no beatmaps to delete");
        return;
    }

    const conf = await quick_confirm(`delete ${beatmaps.size == all_beatmaps.length ? "all" : beatmaps.size } beatmap${beatmaps.length > 1 ? "s" : ""} from ${name}?`);

    if (!conf) {
        return;
    }

    // delete beatmaps in the osu folder
    const success = await delete_beatmaps(Array.from(beatmaps.values()));

    if (!success) {
        return;
    }

    // update the current collection with "unknown beatmaps"
    // collections.set(name, { maps: old_collection.maps.filter((b) => !beatmaps.has(b.md5)) });

    // render manager once again
    await initialize();
    setup_manager();
};

const create_empty_collection = async (name) => {
    collections.set(name, { maps: [] });
    setup_manager();
};

const create_new_collection = async () => {

    const method = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "method",
        elements: [{
            key: "name",
            element: { list: ["empty", "from url", "from player"] }
        }]
    });

    if (!method?.name) {
        return;
    }

    if (method.name == "empty") {

        const collection_name = await create_custom_popup({     
            type: message_types.INPUT, 
            label: "collection name" 
        });
        
        if (!collection_name) {
            return;
        }

        if (collections.has(collection_name)) {
            return create_alert("this collection already exists");
        }

        create_empty_collection(collection_name);
    }
    else if (method.name == "from url") {
        add_new_collection();
    }
    else {
        get_from_player();
    }
};

header_text.addEventListener("click", async () => {
    remove_all_selected();
    setup_manager();
});

more_options.addEventListener("click", async () => {

    // if theres a collection selected, add extra option
    const current_collection = get_selected_collection(false);

    if (current_collection && !default_options.includes("delete beatmaps")) {
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
        case "create new collection":
            create_new_collection();
            break;
        case "get missing beatmaps":
            get_missing_beatmaps();
            break;
        case "delete beatmaps":
            delete_beatmaps_manager();
            break;
        default:
            create_alert("invalid option");
            break;
    }
});

const render_beatmap = (beatmap) => {

    const has_beatmap = Boolean(beatmap.artist_name);
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

    const status = Object.entries(_status).find(([k, v]) => v == beatmap.status)?.[0];
    const beatmap_sr = get_beatmap_sr(beatmap);

    const set_loading_status = (status) => {
        beatmap_status.innerText = String(status).toUpperCase();
        beatmap_status.classList.add(String(status).toLowerCase());
    };

    const open_in_browser = () => {
        const url = beatmap.url || `https://osu.ppy.sh/b/${beatmap.difficulty_id}`;
        window.electron.shell.openExternal(url);
    };

    const move_to = (el) => {

        // make sure to get the updated beatmap
        const updated_beatmap = core.reader.osu.beatmaps.get(beatmap.md5);
        const collection_name = el.innerText;

        if (!collections.has(collection_name)) {
            return;
        }

        const collection = collections.get(collection_name);
        collection.maps.push(updated_beatmap);
    };

    const delete_set = () => {

        // make sure to get the updated beatmap
        const updated_beatmap = core.reader.osu.beatmaps.get(beatmap.md5);
        const collection_name = get_selected_collection();

        if (!collections.has(collection_name)) {
            return;
        }

        const beatmap_id = updated_beatmap.beatmap_id;

        // remove diffs that have the save beatmap_id
        Array.from(collections.get(collection_name).maps).forEach((b) => {
            if (beatmap_id == b.beatmap_id) {
                remove_beatmap(b.md5);
            }
        });

        // need to update
        update_collection_button.style.display = "block";
    };

    const update_sr = (beatmap_sr) => {

        const class_name = star_ranges.find(([min, max]) => beatmap_sr >= min && beatmap_sr <= max)[2];

        star_rating.innerText = `★ ${beatmap_sr}`;
        star_rating.classList.add(class_name);

        // if its more than 7 stars turn that shit yellow
        if (beatmap_sr >= 7) {
            star_rating.style.color = "#ebcf34";
        }
    };

    set_loading_status(status);

    if (!isNaN(beatmap_sr)) {
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

        const current_collection = get_selected_collection();
        const collection_keys = Array.from(collections.keys())
            .filter((k) => k != current_collection)
            .map((k) => { return { value: k, callback: move_to }});

        title.addEventListener("click", open_in_browser);

        // add contextmenu handler
        create_context_menu({
            id: beatmap.md5,
            target: beatmap_element,
            values: [
                { type: "default", value: "open in browser", callback: open_in_browser },
                { type: "submenu", value: "move to", values: collection_keys },
                { type: "default", value: "remove beatmap set", callback: (el) => { delete_set(el) } },
                { type: "default", value: "remove beatmap", callback: () => { remove_beatmap(beatmap.md5) } }
            ]
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

            set_loading_status(beatmap_data.status);
            update_sr(beatmap_data.difficulty_rating);

            title.addEventListener("click", open_in_browser);
         
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

export const render_page = (id, _offset) => {

    let offset = _offset || 0, add_more = true;

    if (offset == 0) {
        collection_container.innerHTML = "";
    }

    const collection = draggable_items_map.get(id)?.collection;
    const text_collection = document.getElementById("collection_text");

    if (!collection) {
        console.log("[Manager] failed to get collection", id);
        return;
    }

    const { sr_max, bpm_max } = draggable_items_map.get(id)?.collection;

    if (text_collection) {
        text_collection.remove();
    }

    // update sr filter slider min/max
    if (sr_filter.limit > 0 && sr_filter.limit != sr_max) {
        sr_filter.set_limit(sr_max);
    }

    // update bpm filter slider min/max
    if (sr_filter.limit > 0 && bpm_filter.limit != bpm_max) {
        bpm_filter.set_limit(bpm_max);
    }

    // only render 16 at time
    for (let i = 0; i < MAX_RENDER_AMMOUNT; i++) {

        const beatmaps = collection?.maps;

        // no beatmaps? maybe a empty collection
        if (!beatmaps) {
            console.log("[Manager] no beatmaps", collection);
            add_more = false;
            break;
        }

        // check if i reached the collection limit
        if (offset >= beatmaps.length) {
            add_more = false;
            break;
        }

        // check if the beatmap is valid (should be)
        if (!beatmaps[offset]) {
            offset++;
            continue;
        }

        // filter by name
        if (!filter_beatmap(beatmaps[offset])) {
            offset++;   
            i--;
            continue;
        }

        const beatmap_item = render_beatmap(beatmaps[offset]);
        collection_container.appendChild(beatmap_item);

        offset++;
    }

    if (add_more) {
        const load_more_button = create_more_button(id, offset);
        collection_container.appendChild(load_more_button);
    }

    collection_container.dataset.id = draggable_items_map.get(id)?.collection_id;
};

export const merge_collections = (cl1, cl2) => {

    const merged_map = new Map();
  
    [...cl1, ...cl2].forEach(item => {
        merged_map.set(item.md5, item);
    });
  
    return Array.from(merged_map.values());
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

        const maps = v?.maps;
        const obj = { name: k, maps: [] };

        if (!maps) {
            create_alert("invalid map object", { type: "error" });
            return;
        }

        for (let i = 0 ; i < maps.length; i++) {
            const map = maps[i];
            obj.maps.push(map.md5);
        }

        new_collection.beatmaps.push(obj);
    }

    console.log("[Manager] updated collection:", new_collection);

    core.reader.collections = new_collection;
    const backup_name = `collection_backup_${Date.now()}.db`;

    const old_name = path.resolve(core.config.get("osu_path"), "collection.db"), 
          new_name = path.resolve(core.config.get("osu_path"), backup_name);

    await fs.renameSync(old_name, new_name);

    core.reader.write_collections_data(old_name);
    create_alert("updated!");

    update_collection_button.style.display = "none";
});

export const setup_manager = () => {

    // clean list and container
    list.innerHTML = "";
    collection_container.innerHTML = "";
    collection_container.removeAttribute("data-id");

    // clean draggable_items list
    for (let [k] of draggable_items_map) {
        draggable_items_map.delete(k);
    }

    // if filters is not intialized, create and append it to filter box
    if (!document.querySelector(".sr-filter-container")) {
        
        const filter_container = document.querySelector(".filter-box");
        const sr_filter_container = create_element(`<div class="sr-filter-container"></div>`);
        const status_filter_container = create_element(`<div class="status-filter-container"></div>`);
        const bpm_filter_container = create_element(`<div class="bpm-filter-container"></div>`);

        const update = () => {

            const current_id = get_selected_collection(true);

            if (!current_id) {
                sr_filter.callback = null;
                return;
            }

            // render page again
            render_page(current_id, 0);
        }

        // update maps on filter update
        sr_filter.callback = debounce(update, 100);
        status_filter.callback = debounce(update, 100);
        bpm_filter.callback = debounce(update, 100);

        status_filter_container.appendChild(status_filter.element);
        sr_filter_container.appendChild(sr_filter.element);
        bpm_filter_container.appendChild(bpm_filter.element);

        filter_container.appendChild(sr_filter_container);
        filter_container.appendChild(bpm_filter_container);
        filter_container.appendChild(status_filter_container);
    }

    setup_draggables();
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
    collections.set(collection, { maps: updated_map });

    await initialize();

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
        await load_osu_files(core.config.get("osu_path"));
    }

    if (collections.size == 0) {

      for (const collection of core.reader.collections.beatmaps) {

            const updated_maps = collection.maps.map(update_map_info);
            let sr_max = 1, bpm_max = 0;

            for (const map of updated_maps) {
                const sr = Number(get_beatmap_sr(map));
                const bpm = Number(get_beatmap_bpm(map));
                if (sr > sr_max) sr_max = sr;
                if (bpm > bpm_max) bpm_max = bpm;
            }
            
            collections.set(collection.name, {
                maps: updated_maps,
                bpm_max,
                sr_max
            });
      }
    } else {

        for (const [name, data] of collections) {

            const maps = data?.maps;

            if (!maps) {
                continue;
            }

            const updated_maps = maps.map(update_map_info);
            let sr_max = 1, bpm_max = 0;
            
            for (const map of updated_maps) {
                const sr = Number(get_beatmap_sr(map));
                const bpm = Number(get_beatmap_bpm(map));
                if (sr > sr_max) sr_max = sr;
                if (bpm > bpm_max) bpm_max = bpm;
            }
                
            collections.set(name, {
                maps: updated_maps,
                bpm_max,
                sr_max
            });
        }
    }
    
    if (!no_update) {
        setup_manager();
    }
};
