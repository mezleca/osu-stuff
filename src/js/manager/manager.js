const path = require("path")
const fs = require("fs")
const shell = require("electron").shell;

import { core, get_files } from "../utils/config.js"
import { setup_collector } from "../stuff/collector.js"
import { add_alert, add_get_extra_info } from "../popup/popup.js"
import { download_map } from "../utils/download_maps.js"

let current_name = "";

export const collections = new Map();

const collection_list = document.querySelector(".collection-list");
const main_content = document.querySelector(".main-content");

const btn_add = document.querySelector(".btn-add");
const btn_remove = document.querySelector(".btn-delete");
const btn_rename = document.getElementById("rename_collection");
const btn_update = document.getElementById("update_collections");

const search_box = document.getElementById("current_search");

const change_input_value = (name) => {
    const input = document.getElementById("collection_input_name");
    input.value = name;
}

const get_collection_name = () => {

    const all_elements = Array.from(collection_list.children);

    for (let i = 0; i < all_elements.length; i++) {

        const element = all_elements[i];

        if (element.classList.contains("selected")) {
            return element.innerHTML;
        }
    }
    return "";
}

const remove_beatmap = (hash) => {

    const beatmaps = collections.get(current_name);

    for (let i = 0; i < beatmaps.length; i++) {

        const beatmap = beatmaps[i];

        if (beatmap.md5 == hash) {
            beatmaps.splice(i, 1)
        }
    }

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
    const has_bg = Boolean(beatmap.bg);

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

    const small_img_path = path.resolve(core.config.get("osu_path"), `Data`, `bt`, `${beatmap.beatmap_id}l.jpg`);
    const beatmap_image_url = `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/list@2x.jpg`;

    small_bg.dataset.src = has_bg ? beatmap.bg : (fs.existsSync(small_img_path) ? small_img_path : beatmap_image_url);
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

            add_alert("Searching beatmap...");

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

btn_rename.addEventListener("click", () => {

    const input = document.getElementById("collection_input_name");

    if (!collections.has(current_name) || input.value == current_name) {
        return;
    }

    if (collections.get(input.value)) {
        add_alert("This collection already exists");
        return;
    }

    const old_value = collections.get(current_name);

    collections.delete(current_name);
    collections.set(input.value, old_value);

    setup_manager();

    document.querySelector(".collection-container").remove();

    render_tab(create_container(input.value), collections.get(input.value));
    current_name = input.value;
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

btn_add.addEventListener("click", async () => {

    const collection_url = await add_get_extra_info([{ type: "input", text: "Collection url\n(Osu!Collector url)" }]);

    if (!collection_url) {
        return;
    }

    const info = await setup_collector(collection_url);

    if (!info) {
        return;
    }

    const { c_maps: maps, collection } = info;

    if (collections.has(collection.name)) {
        add_alert("You already have a collection with this name");
        return;
    }

    collections.set(collection.name, maps.map((v) => {
        return { md5: v }
    }));
    
    await initialize({ name: collection.name, maps: maps });
    setup_manager();

    if (document.querySelector(".collection-container")) {
        document.querySelector(".collection-container").remove();
    }

    render_tab(create_container(collection.name), collections.get(collection.name));
})

btn_update.addEventListener("click", async () => {

    const confirm = await add_get_extra_info([{ type: "confirmation", text: "Are you sure?\nIf you click yes your current collection file will be rewrited"}]);

    if (!confirm) {
        return
    }

    const new_collection = {
        version: core.reader.collections.version,
        length: collections.size,
        beatmaps: []
    };

    collections.forEach((v, k) => {
        const obj = { name: k, maps: [] }
        for (let i = 0 ; i < v.length; i++) {
            const map = v[i]
            obj.maps.push(map.md5)
        }
        new_collection.beatmaps.push(obj)
    });

    core.reader.collections = new_collection;
    const backup_name = `collection_backup_${Date.now()}.db`;

    fs.renameSync(path.resolve(core.config.get("osu_path"), "collection.db"), path.resolve(core.config.get("osu_path"), backup_name));
    core.reader.write_collections_data(path.resolve(core.config.get("osu_path"), "collection.db"));
    add_alert("Done!");
})

btn_remove.addEventListener("click", async () => {

    const collection_name = get_collection_name();

    if (!collection_name) {
        add_alert("Please select a collection", { type: "warning" })
        return
    }

    const confirm = await add_get_extra_info([{ type: "confirmation", text: `Delete ${collection_name}?` }]);

    if (confirm) {
        collections.delete(collection_name);   
        document.querySelector(".collection-container").remove(); 
        setup_manager(); 
        add_alert(collection_name, "has been deleted"); 
    }
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

const setup_manager = () => {

    collection_list.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const template = document.createElement('template');

    template.innerHTML = '<div class="collection-item"></div>';

    collections.forEach((v, k) => {

        const new_collection = template.content.cloneNode(true).firstElementChild;
        new_collection.textContent = k;

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

    const collections_array = core.reader.collections;
    const osu_info = core.reader.osu;

    for (const current_collection of collections_array.beatmaps) {

        let { name, maps } = current_collection;

        let info = maps.map((map) => {

            if (!map) {
                return;
            }

            return osu_info.beatmaps.get(map) || { md5: map };
        });

        collections.set(name, info);
    }

    if (no_update) {
        return;
    }

    const container = document.querySelector(".collection-container");

    if (container) {
        container.remove();
    }

    setup_manager();
}