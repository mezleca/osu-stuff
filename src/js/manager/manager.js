import { core, get_files } from "../utils/config.js"
import { setup_collector } from "../stuff/collector.js"
import { create_alert, create_custom_message, message_types } from "../popup/popup.js"
import { download_map } from "../utils/download_maps.js"
import { create_download_task } from "../tabs.js";
import { save_to_db, get_from_database } from "../utils/other/indexed_db.js";

let current_name = "";
let need_to_save = false;

export const collections = new Map();

const fs = window.nodeAPI.fs;
const path = window.nodeAPI.path;

const collection_list = document.querySelector(".collection-list");
const main_content = document.querySelector(".main-content");
const input_collection_name = document.getElementById("collection_input_name");

const btn_add = document.querySelector(".btn-add");
const btn_update = document.getElementById("update_collections");
const search_box = document.getElementById("current_search");

const placeholder_image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const OSU_STATS_URL = "https://osustats.ppy.sh/apiv2/account/login?returnUrl=https://osustats.ppy.sh/";

const change_input_value = (name) => {
    input_collection_name.value = name;
}

const get_current_item = () => {

    const items = Array.from(document.querySelectorAll(".collection-item"));

    if (!items) {
        console.log("no items");
        return null;
    }

    for (let i = 0; i < items.length; i++) {
        
        const element = items[i];

        if (element.classList.contains("selected")) {
            return element;
        }
    }

    return null;
};

const remove_beatmap = (hash) => {

    const beatmaps = collections.get(current_name);

    for (let i = 0; i < beatmaps.length; i++) {

        const beatmap = beatmaps[i];

        if (beatmap.md5 == hash) {
            beatmaps.splice(i, 1);
        }
    }

    need_to_save = true;
    document.getElementById(hash).remove();
}

const render_beatmap = (beatmap) => {

    const template = document.createElement('template');
    template.innerHTML = `
        <div class="mini-container">
            <img class="bg-image">
            <div class="content">
                <div class="small-image-container">
                    <img class="small-image lazy" loading="lazy">
                </div>
                <div class="text-container">
                    <p class="title"></p>
                    <p class="subtitle"></p>
                </div>
                <button class="download-button"><i class="bi bi-download"></i></button>
                <button class="remove-btn"><i class="bi bi-trash-fill"></i></button>
            </div>
        </div>
    `

    const map_item = template.content.cloneNode(true).firstElementChild;
    const has_beatmap = Boolean(beatmap.artist_name);

    map_item.dataset.title = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]`.toLowerCase() : "Unknown (not downloaded)".toLowerCase();
    map_item.dataset.mapper = beatmap.creator_name ? beatmap.creator_name.toLowerCase() : "Unknown";
    map_item.dataset.tags = beatmap.tags ? beatmap.tags.toLowerCase() : "";
    map_item.dataset.artist = beatmap.artist_name ? beatmap.artist_name.toLowerCase() : "";

    map_item.id = beatmap.md5;

    const title = map_item.querySelector('.title');
    const subtitle = map_item.querySelector('.subtitle');
    const small_bg = map_item.querySelector('.small-image');
    const download_btn = map_item.querySelector('.download-button');
    const remove_btn = map_item.querySelector('.remove-btn');

    title.textContent = map_item.dataset.title;
    subtitle.textContent = has_beatmap ? `mapped by ${beatmap.creator_name}` : "mapped by Unknown";

    const beatmap_image_url = `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/list@2x.jpg`

    small_bg.dataset.src = has_beatmap ? beatmap_image_url : placeholder_image;
    remove_btn.id = `bn_${beatmap.beatmap_id}`;
    
    if (has_beatmap) {

        small_bg.addEventListener("click", () => {
            const url = beatmap.url || `https://osu.ppy.sh/b/${beatmap.difficulty_id}`;
            window.electron.shell.openExternal(url);
        });
    }

    remove_btn.addEventListener("click", () => {
        remove_beatmap(beatmap.md5);
    });

    if (!has_beatmap) {

        download_btn.addEventListener("click", async () => {

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
            small_bg.src = beatmap.bg;

            download_btn.remove();

            small_bg.addEventListener("click", () => {
                window.electron.shell.openExternal(beatmap_data.url);
            });
        });
    } else {
        download_btn.remove();
    }

    return map_item;
}

const render_tab = (tab, beatmaps, filter = "") => {

    tab.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const max_initial_render = 20;
    
    let total_matching = 0;
    let rendered_count = 0;

    for (let i = 0; i < beatmaps.length; i++) {

        const beatmap = beatmaps[i];

        if (filter_beatmap(beatmap, filter)) {

            total_matching++;

            if (rendered_count < max_initial_render) {
                const map_item = render_beatmap(beatmap);
                fragment.appendChild(map_item);
                rendered_count++;
            }
        }
    }

    tab.appendChild(fragment);

    if (total_matching > rendered_count) {
        add_load_more_button(tab, beatmaps, rendered_count, filter, total_matching);
    }

    requestAnimationFrame(() => {
        lazy_load();
    })
}

const add_load_more_button = (tab, beatmaps, start, filter, total_matching) => {

    const load_more = document.createElement('button');
    load_more.textContent = `load more (${start}/${total_matching})`;

    load_more.style.width = "95%";
    load_more.style.alignSelf = "center";

    load_more.addEventListener('click', () => {
        load_more.remove();
        render_more_beatmaps(tab, beatmaps, start, filter, total_matching);
    });

    tab.appendChild(load_more);
}

const render_more_beatmaps = (tab, beatmaps, start, filter, total_matching, count = 20) => {

    const fragment = document.createDocumentFragment();

    let rendered_count = 0;
    let current_index = 0;

    for (let i = 0; i < beatmaps.length && rendered_count < count; i++) {

        const beatmap = beatmaps[i];

        if (filter_beatmap(beatmap, filter)) {

            if (current_index <= start) {
                current_index++;
                continue;
            }

            const map_item = render_beatmap(beatmap);
            fragment.appendChild(map_item);

            rendered_count++;
        }
    }

    tab.appendChild(fragment);

    const new_start = start + rendered_count
    if (new_start < total_matching) {
        add_load_more_button(tab, beatmaps, new_start, filter, total_matching)
    }

    requestAnimationFrame(() => {
        lazy_load()
    });
}

const filter_beatmap = (beatmap, filter) => {

    if (!filter) {
        return true;
    }

    const searchable_text = `${beatmap.artist_name} ${beatmap.song_title} ${beatmap.difficulty} ${beatmap.creator_name} ${beatmap.tags}`.toLowerCase()
    return searchable_text.includes(filter.toLowerCase())
}

const remove_container = () => {

    const container = document.querySelector(".collection-container");

    if (main_content.hasChildNodes() && container) {
        main_content.removeChild(container)
    }
}

const create_container = (name) => {

    const container = document.createElement("div");

    container.classList.add("collection-container");
    container.id = `cl-${name}`;

    main_content.appendChild(container);
    return container;
}

input_collection_name.addEventListener("input", () => {

    const input = input_collection_name;

    if (!input.value) {
        return;
    }
    
    if (!collections.has(current_name)) {
        return;
    }

    if (collections.get(input.value)) {
        console.log("this collection already exist");
        return;
    }

    const old_value = collections.get(current_name);
    const collection_item = get_current_item();

    if (!collection_item) {
        console.log("item not found");
        return;
    }

    const collection_name = collection_item.children[0];
    collection_name.innerHTML = input.value;

    collections.delete(current_name);
    collections.set(input.value, old_value);

    current_name = input.value;
    need_to_save = true;

    update_current_item();
});

export const debounce = (func, delay) => {

    let timeout;

    return (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), delay)
    };
}

search_box.addEventListener("input", debounce(() => {

    const filter = search_box.value.toLowerCase();
    const container = document.querySelector(".collection-container");
    
    if (container && current_name) {
        render_tab(container, collections.get(current_name), filter);
    }
}, 300));

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

const fetch_osustats = async (collection_url) => {

    const id = collection_url.split("/").find((v) => Number(v));

    if (!id) {
        create_alert("failed to get collection id", { type: "error" });
        return;
    }

    const stats_data = await get_from_database("stats", "data");

    if (!stats_data) {
        create_alert("please login on osustats before using that feature", { type: "warning" });
        const data = await window.electron.create_auth(OSU_STATS_URL, "https://osustats.ppy.sh/");
        await save_to_db("stats", "data", data);
    }

    const url = `https://osustats.ppy.sh/apiv2/collection/${id}/download`;
    const collection_info = await fetch(`https://osustats.ppy.sh/apiv2/collection/${id}`);
    const file_data = await window.electron.fetchstats(url, stats_data);

    if (file_data?.cookie) {
        create_alert("hmm, something went wrong...<br>if you're logging for the first time, try again", { type: "error" });
        return;
    }

    if (!file_data || !file_data.ok) {
        create_alert("failed to get collection", { type: "error" });   
        return;
    }

    const collection_data = await collection_info.json();
    const buffer = file_data.data;

    core.reader.set_buffer(buffer);

    const osdb_data = await core.reader.get_osdb_data();
    const all_hashes = [];
    const missing_beatmaps = osdb_data.collections.reduce((acc, c) => {
        for (let i = 0; i < c.beatmaps.length; i++) {
            const b = c.beatmaps[i];
            if (!core.reader.osu.beatmaps.has(b.md5)) {
                acc.push({ id: b.map_set_id, md5: b.md5 });
            }
            all_hashes.push(b.md5);
        }
        return acc;
    }, []);

    collection_data.name = collection_data.title;

    return { 
        maps: missing_beatmaps,
        c_maps: all_hashes,
        collection: collection_data
    }
};

btn_add.addEventListener("click", async () => {

    if (need_to_save) {
        create_alert("please update before using this feature");
        return;
    }

    const prompt = await create_custom_message({ type: "input", label: "add new collection (from url)<br>valid websites: osu!collector, osustats.ppy.sh" });

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

    if (collections.has(collection.name)) {
        create_alert("you already have a collection with this name");
        return;
    }

    await add_collection_manager(maps, collection);

    if (document.querySelector(".collection-container")) {
        document.querySelector(".collection-container").remove();
    }

    const download = await create_custom_message({
        type: message_types.MENU,
        title: `download maps from ${collection.name}?`,
        items: ["yes", "no"]
    });

    if (download != "yes") {
        return;
    }

    await create_download_task(collection.name, yep_maps);
});

btn_update.addEventListener("click", async () => {

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

    need_to_save = false;
})

function lazy_load() {

    const images = document.querySelectorAll('img.lazy'); 

    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    }

    const image_observer = new IntersectionObserver((entries, observer) => {
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const img = entry.target
            if (entry.isIntersecting && img.dataset.src) {
                img.src = img.dataset.src
                img.removeAttribute('data-src')
            }
        }
    }, options);

    for (let i = 0; i < images.length; i++) {
        image_observer.observe(images[i]);
    }
}

const update_current_item = () => {

    const current_item = get_current_item();
    const name = current_item.children[0].innerHTML;

    // clone the old element
    const old_element = current_item
    const new_element = old_element.cloneNode(true);

    // replace it to remove all listeners
    old_element.parentNode.replaceChild(new_element, old_element);

    if (!name) {
        console.log("invalid name", name);
        return;
    }

    new_element.addEventListener("click", () => {
        const all_collections_text = Array.from(collection_list.children);
        all_collections_text.forEach(e => e.classList.remove("selected"));
        new_element.classList.add("selected");
        remove_container();
        render_tab(create_container(name), collections.get(name));
        change_input_value(name);
        current_name = name;
    });
};

export const setup_manager = () => {

    collection_list.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const template = document.createElement('template');

    template.innerHTML = `
    <div class="collection-item">
        <p class="collection-name"></p>
        <i class="bi bi-trash-fill" id="remove_collection"></i>
    </div>
    `;

    for (let [k, v] of collections) {

        const new_collection = template.content.cloneNode(true).firstElementChild;
        const collection_name = new_collection.querySelector(".collection-name");
        const remove_collection = new_collection.querySelector("#remove_collection");

        remove_collection.addEventListener("click", async () => {

            const collection = remove_collection.previousElementSibling;

            if (!collection) {
                console.log("collection not found", collection);
                return;
            }

            const collection_name = collection.textContent;

            if (!collection_name) {
                create_alert("Please select a collection", { type: "warning" })
                return
            }

            const confirm = await create_custom_message({
                type: message_types.MENU,
                title: `delete ${collection_name}?`,
                items: ["yes", "no"]
            });

            if (confirm == "yes") {
                collections.delete(collection_name);   
                document.querySelector(".collection-container").remove(); 
                setup_manager(); 
                create_alert(`${collection_name} has been deleted`); 
            }
        });

        collection_name.innerText = k;
        new_collection.addEventListener("click", () => {

            const collection_text = document.getElementById("collection_text");

            if (collection_text) {
                collection_text.remove();
            }      

            const all_collections_text = Array.from(collection_list.children);

            remove_container();
            render_tab(create_container(k), v);
            change_input_value(k);

            all_collections_text.forEach(e => e.classList.remove("selected"));
            new_collection.classList.add("selected");
            current_name = k;
        });

        fragment.appendChild(new_collection)
    }

    collection_list.innerHTML = "";
    collection_list.appendChild(fragment);

    requestAnimationFrame(() => {
        lazy_load();
    });
}

window.addEventListener("scroll", e => lazy_load());

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

        const container = document.querySelector(".collection-container");

        if (container) {
            container.remove();
        }

        setup_manager();
    }
};