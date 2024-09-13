const path = require("path");
const fs = require("fs");
const shell = require("electron").shell;

import { core, get_files } from "../utils/config.js";
import { setup_collector } from "../stuff/collector.js";
import { add_alert, add_get_extra_info } from "../popup/popup.js";
import { download_map } from "../utils/download_maps.js";

let current_name = "";

export const collections = new Map();
const search_index = new Map();

const collection_list = document.querySelector(".collection-list");
const main_content = document.querySelector(".main-content");

const btn_add    = document.querySelector(".btn-add");
const btn_remove = document.querySelector(".btn-delete");
const btn_rename = document.getElementById("rename_collection");
const btn_update = document.getElementById("update_collections");

const search_box = document.getElementById("current_search");

const change_input_value = (name) => {
    const input = document.getElementById("collection_input_name");
    input.value = name;
};

const get_collection_name = () => {

    const all_elements = Array.from(collection_list.children);

    for (let i = 0; i < all_elements.length; i++) {

        const element = all_elements[i];

        if (element.classList.contains("selected")) {
            return element.innerHTML;
        }
    }

    return "";
};

const remove_beatmap = (hash) => {

    /** @type {Array} */
    const beatmaps = collections.get(current_name);
    
    for (let i = 0; i < beatmaps.length; i++) {

        const beatmap = beatmaps[i];

        if (beatmap.md5 == hash) {
            beatmaps.splice(i, 1);
        }
    };

    document.getElementById(hash).remove();
};

const render_tab = async (tab, beatmaps) => {

    const fragment = document.createDocumentFragment();

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
    `;

    const render = (start, end) => {

        return new Promise(resolve => {

            requestAnimationFrame(() => {

                for (let i = start; i < end && i < beatmaps.length; i++) {

                    const beatmap = beatmaps[i];
                    const item = template.content.cloneNode(true).firstElementChild;

                    map_item(item, beatmap);
                    fragment.appendChild(item);
                }

                resolve();
            });
        });
    };

    for (let i = 0; i < beatmaps.length; i += 15) {

        await render(i, i + 15);

        if (i === 0) {
            tab.appendChild(fragment.cloneNode(true));
        }
    }

    tab.appendChild(fragment);
    requestAnimationFrame(lazyLoad);
};

const render_2 = async (tab, beatmaps, size = 15) => {

    const fragment = document.createDocumentFragment();
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
    `;

    const render = (start, end) => {

        return new Promise(resolve => {

            requestAnimationFrame(() => {

                for (let i = start; i < end && i < beatmaps.length; i++) {

                    const beatmap = beatmaps[i];
                    const item = template.content.cloneNode(true).firstElementChild;

                    map_item(item, beatmap);
                    fragment.appendChild(item);
                }
                resolve();
            });
        });
    };

    for (let i = 0; i < beatmaps.length; i += size) {
        
        await render(i, i + size);

        if (i === 0) {
            tab.appendChild(fragment.cloneNode(true));
        }
    }

    tab.appendChild(fragment);
    requestAnimationFrame(lazyLoad);
};

const map_item = (map_item, beatmap) => {

    const has_beatmap = Boolean(beatmap.artist_name);
    const has_bg = Boolean(beatmap.bg);

    map_item.dataset.title = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]` : "Unknown (not downloaded)";
    map_item.dataset.mapper = beatmap.creator_name || "Unknown";
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
        console.log("removing beatmap", beatmap.song_title, current_name, beatmap.md5);
        remove_beatmap(beatmap.md5);
    });

    if (!has_beatmap) {

        download_btn.addEventListener("click", async () => {

            const beatmap_data = await download_map(beatmap.md5);

            if (!beatmap_data) {
                add_alert("beatmap not found :c", { type: "alert" });
                return;
            }

            update_ui(beatmap, beatmap_data, map_item);
            add_alert("finished downloading beatmap");
        });
    } else {
        download_btn.remove();
    }
};

const update_ui = (beatmap, beatmap_data, map_item) => {

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

    const title = map_item.querySelector('.title');
    const subtitle = map_item.querySelector('.subtitle');
    const small_bg = map_item.querySelector('.small-image');
    const download_btn = map_item.querySelector('.download-button');

    title.innerText = `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]`;
    subtitle.innerText = `mapped by ${beatmap.creator_name}`;
    small_bg.src = beatmap.bg;
    download_btn.remove();

    small_bg.addEventListener("click", () => {
        shell.openExternal(beatmap_data.url);
    });
};

const remove_container = () => {

    const container = document.querySelector(".collection-container");

    if (!main_content.hasChildNodes() || !container) {
        return;
    }

    main_content.removeChild(container);
};

const create_container = (name) => {

    const container = document.createElement("div");
    
    container.classList.add("collection-container");
    container.id = `cl-${name}`;

    main_content.appendChild(container);

    return container;
};

btn_rename.addEventListener("click", async () => {

    const input = document.getElementById("collection_input_name");

    // yep
    if (!collections.has(current_name)) {
        return;
    }

    // value didn't change
    if (input.value == current_name) {
        return;
    }

    const collection_already_exists = collections.get(input.value);

    if (collection_already_exists) {
        add_alert("This collection already exists");
        return;
    }

    const old_value = collections.get(current_name);

    // remove the old key and add the new one
    collections.delete(current_name);
    collections.set(input.value, old_value);

    // update everything
    setup_manager();

    // remove the current container and re-render the new tab
    document.querySelector(".collection-container").remove();
    await render_tab(create_container(input.value), collections.get(input.value));
    build_search_index();

    current_name = input.value;
});

function build_search_index() {
    
    const elements = document.querySelectorAll(".mini-container");

    elements.forEach((element) => {
        const searchString = (element.dataset.title + " " + element.dataset.mapper).toLowerCase();
        search_index.set(element, searchString);
    });
}

function debounce(func, delay) {

    let timeout;

    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// TODO: fix really bad lag after searching something and clearing the query
const search = debounce(async (query) => {

    const elements = Array.from(search_index.keys());
    const beatmaps = collections.get(current_name);
    const collection_container = document.querySelector(".collection-container");

    if (!collection_container) {
        console.log("[ERROR] collection container not found");
        return;
    }

    if (query == "") {
        elements.forEach((element) => element.remove());
        render_2(collection_container, beatmaps);
        build_search_index();   
        return;
    }

    const filtered = beatmaps.filter((beatmap) => {

        const title = beatmap.song_title;
        const artist = beatmap.artist_name;
        const mapper = beatmap.creator_name;
        const tags = beatmap.tags;

        if (!title) {
            return;
        }

        return title.toLowerCase().includes(query.toLowerCase())  || 
               artist.toLowerCase().includes(query.toLowerCase()) || 
               mapper.toLowerCase().includes(query.toLowerCase()) || 
               tags.toLowerCase().includes(query.toLowerCase());
    });

    elements.forEach((element) => element.remove());

    await render_2(collection_container, filtered);
    build_search_index();
}, 1000); 

search_box.addEventListener("input", (event) => {
    search(event.target.value);
});
  
btn_add.addEventListener("click", async () => {
    
    // TODO: Option to create a new collection from a set os ids (txt file or something)

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
        return { md5: v };
    }));

    // update everything
    await initialize({ name: collection.name, maps: maps });
    setup_manager();

    // remove the current container and re-render the new tab
    if (document.querySelector(".collection-container")) {
        document.querySelector(".collection-container").remove();
    }
    
    await render_tab(create_container(collection.name), collections.get(collection.name));
    build_search_index();
});

btn_update.addEventListener("click", async () => {

    const confirm = await add_get_extra_info([{ type: "confirmation", text: "Are you sure?\nIf you click yes your current collection file will be rewrited"}]);

    if (!confirm) {
        return;
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
    
    core.reader.collections = new_collection;

    // backup
    const backup_name = `collection_backup_${Date.now()}.db`;
    fs.renameSync(path.resolve(core.config.get("osu_path"), "collection.db"), path.resolve(core.config.get("osu_path"), backup_name));

    core.reader.write_collections_data(path.resolve(core.config.get("osu_path"), "collection.db"));

    add_alert("Done!");
});

btn_remove.addEventListener("click", async () => {

    const collection_name = get_collection_name();

    if (!collection_name) {
        add_alert("Please select a collection", { type: "warning" });
        return;
    }

    const confirm = await add_get_extra_info([{ type: "confirmation", text: `Delete ${collection_name}?` }]);

    if (confirm) {
        
        collections.delete(collection_name);   
        
        // remove the current container and re-render the new tab
        document.querySelector(".collection-container").remove();

        // update everything
        setup_manager();

        add_alert(collection_name, "has been deleted");
    }
});

function lazyLoad() {

    const images = document.querySelectorAll('img.lazy');
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            const img = entry.target;
            if (entry.isIntersecting) {
               
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
            }
        });
    }, options);
    images.forEach(img => imageObserver.observe(img));
};

const setup_manager = async () => {

    collection_list.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const template = document.createElement('template');
    template.innerHTML = '<div class="collection-item"></div>';

    collections.forEach(async (v, k) => {

        const newCollection = template.content.cloneNode(true).firstElementChild;
        newCollection.textContent = k;

        newCollection.addEventListener("click", async () => {

            const collection_text = document.getElementById("collection_text");

            if (collection_text) {
                collection_text.remove();
            }      

            const all_collections_text = Array.from(collection_list.children);

            remove_container();
            await render_tab(create_container(k), v);
            build_search_index();
            change_input_value(k);

            all_collections_text.forEach(e => e.classList.remove("selected"));
            newCollection.classList.add("selected");

            current_name = k;
        });
        
        fragment.appendChild(newCollection);
    });

    collection_list.innerHTML = "";
    collection_list.appendChild(fragment);

    requestAnimationFrame(() => {
        lazyLoad();
    });
};

window.addEventListener("scroll", e => lazyLoad());

// TODO: fix beatmaps no being updated after downloading from missing_beatmaps
export const initialize = async (options) => {

    const no_update = options?.no_update ? options.no_update : false; // no read
    const force = options?.force ? options.force : false; // read from the original file again

    // only initialize if the buffer is valid
    if (!core.reader.buffer) {
        return;
    }

    if (force) {
        await get_files(core.config.get("osu_path"));
    }
    
    // get the current collection list 
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

    // check if the old container is still appended
    const container = document.querySelector(".collection-container");

    if (container) {
        container.remove();
    }

    await setup_manager();

    console.log("manager has been initialized");
};