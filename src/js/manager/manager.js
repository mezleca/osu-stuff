import { core } from "../app.js";
import { load_osu_files, save_config, is_lazer_mode } from "../utils/config.js";
import { create_element } from "../utils/global.js";
import { setup_collector } from "../stuff/collector.js";
import { create_alert, create_custom_popup, message_types, quick_confirm } from "../popup/popup.js";
import { download_map } from "../utils/downloader.js";
import { create_download_task, create_task } from "../events/events.js";
import { delete_beatmaps } from "../stuff/remove_maps.js";
import { download_from_players } from "../stuff/download_from_players.js";
import { missing_download } from "../stuff/missing.js";
import { fetch_osustats } from "../utils/other/fetch.js";
import { debounce, fs, path, placeholder_image, MAX_RENDER_AMMOUNT, star_ranges } from "../utils/global.js";
import { filter_beatmap } from "./tools/filter.js";
import { get_beatmap_sr } from "./tools/beatmaps.js";
import { open_url } from "../utils/other/process.js";
import { beatmap_status } from "../utils/reader/models/stable.js";
import { Reader } from "../utils/reader/reader.js";
import { draggable_items_map, remove_all_selected, setup_draggables } from "./ui/draggable.js";
import { create_dropdown } from "./ui/dropdown.js";
import { create_context } from "./ui/context.js";
import { create_range } from "./ui/range.js";

const list = document.querySelector(".list_draggable_items");
const header_text = document.querySelector(".collection_header_text");
const more_options = document.querySelector(".more_options");
const collection_container = document.querySelector(".collection-container");
const search_input = document.getElementById("current_search");
const update_collection_button = document.querySelector(".update_collection");

const text_collection = document.getElementById("collection_text");

const audio_core = { audio: null, id: 0, target: null };
const default_options = ["create new collection", "get missing beatmaps"];

const beatmaps_context = create_context({
    id: crypto.randomUUID(),
    values: []
});

const manager_filters = new Map();

export const get_selected_collection = (id) => {

    const draggable_items = [...document.querySelectorAll(".draggable_item")];

    for (let i = 0; i < draggable_items.length; i++) {
        if (draggable_items[i].classList.contains("selected")) {
            return id ? draggable_items[i].id : draggable_items[i].children[0].textContent;
        }
    }

    return null;
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

    const selected_id = get_selected_collection(true);

    if (!selected_id) {
        return;
    }

    render_page(selected_id, 0);
}, 300));

const remove_beatmap = (hash) => {

    const name = get_selected_collection();
    const beatmaps = core.reader.collections.beatmaps.get(name).maps;

    if (!beatmaps) {
        console.log("[manager] failed to get collection", name);
        return;
    }

    beatmaps.delete(hash);

    show_update_button();
    document.getElementById(`bn_${hash}`).remove();
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
    await create_task(method.name, download_from_players, method);
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
    const current_collection = get_selected_collection(false);

    if (current_collection) {

        const confirmation = await quick_confirm(`merge with ${current_collection}?`);

        if (confirmation) {

            const collection = core.reader.collections.beatmaps.get(current_collection).maps;

            if (!collection) {
                create_alert(`failed to get current collection ${collection} ${current_collection}`, { type: "error" } );
                return;
            }

            const new_maps = [...collection, ...maps];
            await add_collection_manager(new_maps, current_collection);
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

    await create_download_task(collection.name, yep_maps);
};

const get_missing_beatmaps = async () => {

    if (core.login == null) {
        create_alert("did you forgor to setup your config?");
        return;
    }

    create_task("missing beatmaps", missing_download);
};

const delete_beatmaps_manager = async () => {
    
    const name = get_selected_collection();

    // make sure the collection is valid
    if (!name) {
        core.progress.update("failed to get current collection", { type: "error" });
        return;
    }

    const old_collection = core.reader.collections.beatmaps.get(name);
    const all_beatmaps = Array.from(old_collection.maps);
    const beatmaps = new Map();

    if (!all_beatmaps) {
        core.progress.update("failed to get collection beatmaps", { type: "error" });
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

        if (core.reader.collections.beatmaps.has(collection_name)) {
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
    text_collection.style.display = "block";
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
            break;
    }
});

const move_to = (el, md5) => {

    // make sure to get the updated beatmap
    const collection_name = el.innerText;

    if (!core.reader.collections.beatmaps.has(collection_name)) {
        return;
    }

    const collection = core.reader.collections.beatmaps.get(collection_name);
    collection.maps = new Set([...collection.maps, md5]);
    
    // update sr and shit
    core.reader.update_collections();

    show_update_button();
};

const delete_set = (md5) => {

    // make sure to get the updated beatmap
    const updated_beatmap = core.reader.osu.beatmaps.get(md5);
    const collection_name = get_selected_collection();

    if (!core.reader.collections.beatmaps.has(collection_name)) {
        return;
    }

    const beatmap_id = updated_beatmap.beatmap_id;
    const collection = core.reader.collections.beatmaps.get(collection_name);

    // remove diffs that have the save beatmap_id
    for (const [k, v] of core.reader.osu.beatmaps) {
        if (v.beatmap_id == beatmap_id && collection.maps.has(v.md5)) {
            remove_beatmap(v.md5);
        }
    }

    show_update_button();
};

const open_in_browser = (beatmap) => {
    const url = beatmap.url || `https://osu.ppy.sh/b/${beatmap.difficulty_id}`;
    open_url(url);
};

const create_beatmap_card = (md5) => {

    const beatmap = core.reader.osu.beatmaps.get(md5) || {};
    const has_beatmap = Boolean(beatmap?.artist_name);
    const beatmap_html = `
        <div class="beatmap-card">
            <img class="bg-image">
            <div class="beatmap-card-data">
                <div class="beatmap-metadata">
                    <div class="title">placeholder</div>
                    <div class="subtitle">placeholder</div>
                    <div class="beatmap-card-status">
                        <div class="beatmap-status">UNKNOWN</div>
                        <div class="beatmap-status star_fucking_rate">★ 0.00</div>
                    </div>
                </div>
                <div class="beatmap-status-control">
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

        </div>
    `;

    // get individual elmeents from beatmap card
    const beatmap_element = create_element(beatmap_html);
    const title = beatmap_element.querySelector('.title');
    const subtitle = beatmap_element.querySelector('.subtitle')
    const download_button = beatmap_element.querySelector(".download-button");
    const beatmap_bg = beatmap_element.querySelector(".bg-image");
    const beatmap_status = beatmap_element.querySelector(".beatmap-card-status").children[0];
    const remove_button = beatmap_element.querySelector(".remove-btn");
    const preview_button = beatmap_element.querySelector(".preview-button");
    const star_rating = beatmap_element.querySelector(".star_fucking_rate");

    const status = Reader.get_beatmap_status(beatmap.status) || "Unknown";
    const beatmap_sr = get_beatmap_sr(beatmap);

    const set_loading_status = (status) => {
        beatmap_status.innerText = String(status).toUpperCase();
        beatmap_status.classList.add(String(status).toLowerCase());
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
    
    const get_beatmap_image = (beatmap) => {

        if (core.config.get("get_images_from_web")) {
            return `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/cover.jpg`;
        }

        const img_src = core.reader.get_beatmap_image(beatmap);

        if (!img_src) {
            return `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/cover.jpg`;
        }

        return `media://${encodeURIComponent(img_src)}`;
    }

    set_loading_status(status);

    if (!isNaN(beatmap_sr)) {
        update_sr(beatmap_sr);
    }

    // set shit for lazy loading
    beatmap_element.dataset.title = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]`.toLowerCase() : "Unknown (not downloaded)".toLowerCase();
    beatmap_element.dataset.mapper = has_beatmap ? beatmap.mapper.toLowerCase() : "Unknown";
    beatmap_element.dataset.tags = has_beatmap ? beatmap.tags.toLowerCase() : "";
    beatmap_element.dataset.artist = has_beatmap ? beatmap.artist_name.toLowerCase() : "";
    beatmap_element.id = `bn_${md5}`;

    title.textContent = beatmap?.song_title || "Unknown";
    subtitle.textContent = beatmap?.difficulty || "Unknown";

    if (has_beatmap) {

        download_button.remove();

        const og_beatmap_image = get_beatmap_image(beatmap);
        beatmap_bg.src = og_beatmap_image || placeholder_image;

        // only apply offset thing if we're using the full bg image
        if (!core.config.get("get_images_from_web")) {
            beatmap_bg.classList.add("bg-image-custom");
        }

        const current_collection = get_selected_collection();
        const collection_keys = Array.from(core.reader.collections.beatmaps.keys())
            .filter((k) => k != current_collection)
            .map((k) => { return { value: k, callback: (el) => { move_to(el, md5) } }});

        // update & show context on click
        beatmap_element.addEventListener("contextmenu", () => {

            // update options on click
            if (beatmaps_context.id != md5) {
                beatmaps_context.update([
                    { type: "default", value: "open on browser", callback: () => { open_in_browser(beatmap) } },
                    { type: "default", value: "export beatmap", callback: () => { 
                        core.reader.export_beatmap(beatmap);
                        create_alert(`exported ${beatmap.beatmap_id}`);
                    }},
                    { type: "submenu", value: "move to", values: collection_keys },
                    { type: "default", value: "remove beatmap set", callback: () => { delete_set(md5) } },
                    { type: "default", value: "remove beatmap", callback: () => { remove_beatmap(md5) } },
                ]);
            }

            beatmaps_context.show();
        });

        title.addEventListener("click", () => { open_in_browser(beatmap) } );

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

            const preview_data = await fetch(`https://b.ppy.sh/preview/${beatmap.beatmap_id}.mp3`, {
                headers: {
                    "Accept": "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5",
                    "Sec-GPC": "1",
                    "Sec-Fetch-Dest": "audio",
                }
            });

            // create a new audio source using the preview buffer
            const audio_source = await preview_data.blob();

            // initialize new audio object
            audio_core.audio = new Audio(window.URL.createObjectURL(audio_source));
            audio_core.audio.volume = 0.5;
            audio_core.id = beatmap.beatmap_id;
            audio_core.target = preview_button.children[0];

            audio_core.audio.addEventListener("ended", stop);

            play();
        });

    } else {

        preview_button.remove();
        beatmap_bg.src = placeholder_image;

        download_button.addEventListener("click", async () => {

            core.progress.update("searching beatmap...");

            const beatmap_data = await download_map(md5);

            if (!beatmap_data) {
                create_alert("failed to find beatmap :c", { type: "alert" });
                return;
            }

            const updated = Object.assign(beatmap, {
                artist_name: beatmap_data.beatmapset.artist,
                song_title: beatmap_data.beatmapset.title,
                difficulty: beatmap_data.version,
                md5: beatmap_data.checksum,
                mapper: beatmap_data.beatmapset.creator,
                difficulty_id: beatmap_data.beatmapset_id,
                beatmap_id: beatmap_data.beatmapset.id,
                url: beatmap_data.url,
                sr: beatmap_data.difficulty_rating,
                bpm: beatmap_data.bpm,
                tags: "",
                status: Reader.get_beatmap_status_code(beatmap_data.status) || 0
            });

            core.reader.osu.beatmaps.set(beatmap_data.checksum, updated);

            const image_url = `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/cover.jpg`;

            set_loading_status(beatmap_data.status);
            update_sr(beatmap_data.difficulty_rating);

            title.addEventListener("click", () => { open_in_browser(beatmap) } ); 
            title.textContent = beatmap?.song_title || "Unknown";

            subtitle.textContent = beatmap?.difficulty || "Unknown";
            beatmap_bg.src = image_url;
        });
    }
    
    remove_button.id = `bn_${md5}`;
    remove_button.addEventListener("click", () => remove_beatmap(md5));

    return beatmap_element;
};

export const render_page = (id, offset = 0, _new = false, _inverted = false) => {

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
        sr_filter.set_limit(sr_max);
    }

    // update bpm filter slider min/max
    if (beatmaps.length >= 0 && bpm_filter.limit != bpm_max) {
        bpm_filter.set_limit(bpm_max);
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

        // filter by name
        if (!filter_beatmap(beatmap)) {
            continue;
        }

        const beatmap_item = create_beatmap_card(beatmap);
        beatmap_item.dataset.id = i;

        // yay we are gonna render it!!!
        elements.push(beatmap_item);
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

collection_container.addEventListener("scroll", () => {

    const first_card = collection_container.firstChild;
    const last_card = collection_container.lastChild;

    const top = collection_container.scrollTop;
    const height = collection_container.scrollHeight;
    const clientH = collection_container.clientHeight;

    // render more items until we finish the list
    if (last_card && (height - clientH) - top < 10) {
        render_page(get_selected_collection(true), Number(last_card.dataset.id) + 1);
        return;
    }

    // if we are close to the top and the first beatmap card id is not equal to 0
    // render more
    if (first_card && top < 10 && first_card.dataset.id != 0) {
        const ammount = Number(first_card.dataset.id) - MAX_RENDER_AMMOUNT;
        render_page(get_selected_collection(true), ammount > 0 ? ammount : 0, false, true);
        return;
    } 
});

export const merge_collections = (cl1, cl2) => {
    return new Set([...cl1, ...cl2]);
};

update_collection_button.addEventListener("click", async () => {

    const lazer_mode = is_lazer_mode();
    const confirm = await quick_confirm("are you sure?");

    if (!confirm) {
        return;
    }
    
    // make sure we have the correct length
    core.reader.collections.length = core.reader.collections.beatmaps.size;

    console.log("[manager] updating collection:", core.reader.collections);

    if (lazer_mode) {
        // yep no backup for lazer...
        await core.reader.write_collections_data();
        create_alert("updated!");
    } 
    else {
        const backup_name = `collection_backup_${Date.now()}.db`;
        const old_name = path.resolve(core.config.get("stable_path"), "collection.db"), 
            new_name = path.resolve(core.config.get("stable_path"), backup_name);

        if (fs.existsSync(old_name)) {
            fs.renameSync(old_name, new_name);
        }
        
        await core.reader.write_collections_data(old_name);
        create_alert("updated!");
    }

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

            const current_id = get_selected_collection(true);

            if (!current_id) {
                sr_filter.callback = null;
                return;
            }

            // render page again
            render_page(current_id, 0);
        }

        // update maps on filter update
        status_filter.set_callback(update);
        sr_filter.set_callback(update);
        bpm_filter.set_callback(update);

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

    await initialize();
    show_update_button();
};

export const initialize = async (options) => {

    if (!core.reader.osu?.beatmaps) {
        list.innerHTML = "";
        return;
    }
    
    const lazer_mode = is_lazer_mode();
    const no_update = options?.no_update || false;
    const force = options?.force || false;

    if (force) {

        core.reader.osu = {};

        if (lazer_mode) {
            await core.reader.get_osu_data();
        } else {
            await load_osu_files(core.config.get("stable_path"));
        }
    }

    core.reader.update_collections();
    
    if (!no_update) {
        setup_manager();
    }
};
