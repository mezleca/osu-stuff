const path = require("path")
const fs = require("fs")
const shell = require("electron").shell;

import { core, get_files } from "../utils/config.js"
import { setup_collector } from "../stuff/collector.js"
import { add_alert, add_get_extra_info } from "../popup/popup.js"
import { download_map } from "../utils/download_maps.js"
import { create_download_task } from "../tabs.js";

let current_name = "";
let need_to_save = false;

export const collections = new Map();

const collection_list = document.querySelector(".collection-list");
const main_content = document.querySelector(".main-content");
const input_collection_name = document.getElementById("collection_input_name");

const btn_add = document.querySelector(".btn-add");
const btn_update = document.getElementById("update_collections");
const search_box = document.getElementById("current_search");

const placeholder_image = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

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
            shell.openExternal(url);
        });
    }

    remove_btn.addEventListener("click", () => {
        remove_beatmap(beatmap.md5);
    });

    if (!has_beatmap) {

        download_btn.addEventListener("click", async () => {

            add_alert("searching beatmap...");

            const beatmap_data = await download_map(beatmap.md5);

            if (!beatmap_data) {
                add_alert("Beatmap not found :c", { type: "alert" });
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
                shell.openExternal(beatmap_data.url);
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

const debounce = (func, delay) => {

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

btn_add.addEventListener("click", async () => {

    if (need_to_save) {
        add_alert("please update before using this feature");
        return;
    }

    const collection_url = await add_get_extra_info([{ type: "input", text: "Collection url\n(Osu!Collector url)" }]);

    if (!collection_url) {
        return;
    }

    const info = await setup_collector(collection_url);

    if (!info) {
        return;
    }

    const { c_maps: maps, maps: yep_maps, collection } = info;

    if (collections.has(collection.name)) {
        add_alert("You already have a collection with this name");
        return;
    }

    await add_collection_manager(maps, collection);

    if (document.querySelector(".collection-container")) {
        document.querySelector(".collection-container").remove();
    }

    const download = await add_get_extra_info([{
        type: "confirmation",
        important: true,
        text: `download maps from ${collection.name}?`
    }]);

    if (download) {
        await create_download_task(collection.name, yep_maps);
    }
});

btn_update.addEventListener("click", async () => {

    const confirm = await add_get_extra_info([{ type: "confirmation", text: "are you sure?<br>if you click yes your collection file will be modified"}]);

    if (!confirm) {
        return
    }

    const new_collection = {
        version: core.reader.collections.version,
        length: collections.size,
        beatmaps: []
    };

    collections.forEach((v, k) => {

        const obj = { name: k, maps: [] };

        for (let i = 0 ; i < v.length; i++) {
            const map = v[i];
            obj.maps.push(map.md5);
        }

        new_collection.beatmaps.push(obj);
    });

    console.log("updated collection:", new_collection);

    core.reader.collections = new_collection;
    const backup_name = `collection_backup_${Date.now()}.db`;

    fs.renameSync(path.resolve(core.config.get("osu_path"), "collection.db"), path.resolve(core.config.get("osu_path"), backup_name));
    core.reader.write_collections_data(path.resolve(core.config.get("osu_path"), "collection.db"));
    add_alert("Done!");

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
        entries.forEach(entry => {
            const img = entry.target
            if (entry.isIntersecting && img.dataset.src) {
                img.src = img.dataset.src
                img.removeAttribute('data-src')
            }
        })
    }, options);

    images.forEach(img => image_observer.observe(img));
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

    collections.forEach((v, k) => {

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
                add_alert("Please select a collection", { type: "warning" })
                return
            }

            const confirm = await add_get_extra_info([{ type: "confirmation", text: `delete ${collection_name}?` }]);

            if (confirm) {
                collections.delete(collection_name);   
                document.querySelector(".collection-container").remove(); 
                setup_manager(); 
                add_alert(collection_name, "has been deleted"); 
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
    });

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