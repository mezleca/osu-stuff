const path = require("path");
const fs = require("fs");
const shell = require("electron").shell;

import { beatmaps_schema } from "../reader/definitions.js";
import { config } from "../stuff/utils/config/config.js";
import { reader, setup_collector } from "../stuff/collector.js";
import { add_alert, add_get_extra_info } from "../popup/alert.js";

let current_name = "";

export const collections = new Map();
const placeholder_img = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

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

const render_tab = (tab, beatmaps) => {

    for (let i = 0; i < beatmaps.length; i++) {
        
        /** @type {beatmaps_schema} */
        const beatmap = beatmaps[i];

        const map_item = document.createElement("div");
        const map_content = document.createElement("div");
        const map_small_bg = document.createElement("img");
        const map_big_bg = document.createElement("img");
        const text_container = document.createElement("div");
        const title = document.createElement("p");
        const subtitle = document.createElement("p");
        const remove_c_btn = document.createElement("button");
        const remove_c_icon = document.createElement("i");

        const has_beatmap = Boolean(beatmap.artist_name);

        const title_text = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]` : "Unknown (Probaly not downloaded)";
        const mapper_text = has_beatmap ? `mapped by ${beatmap.creator_name}` : "mapped by Unknown";

        title.innerText = title_text;
        subtitle.innerText = mapper_text;

        map_item.dataset.title = title_text;
        map_item.dataset.mapper = beatmap.creator_name || "Unknown";

        const small_img_path = path.resolve(config.get("osu_path"), `Data`, `bt`, `${beatmap.beatmap_id}l.jpg`);

        if (has_beatmap) {

            if (fs.existsSync(small_img_path)) {
                map_small_bg.dataset.src = small_img_path;
            } else {
                map_small_bg.dataset.src = placeholder_img;
            }

        } else {
            map_small_bg.dataset.src = placeholder_img;
        }
        
        map_small_bg.className = "small-image lazy";
        map_big_bg.className = "bg-image";
        map_item.className = "mini-container";
        map_content.className = "content";
        text_container.className = "text-container";
        title.className = "title";
        subtitle.className = "subtitle";
        remove_c_btn.className = "remove-btn";
        remove_c_icon.className = "bi bi-trash-fill";
        
        map_item.id = beatmap.md5;
        remove_c_btn.id = `bn_${beatmap.beatmap_id}`;

        map_small_bg.addEventListener("click", () => {
            shell.openExternal(`https://osu.ppy.sh/b/${beatmap.difficulty_id}`);
        });

        text_container.appendChild(title);
        text_container.appendChild(subtitle);

        remove_c_btn.appendChild(remove_c_icon);

        map_content.appendChild(map_small_bg);
        map_content.appendChild(text_container);
        map_content.appendChild(remove_c_btn);

        map_item.appendChild(map_big_bg);
        map_item.appendChild(map_content);
        
        tab.appendChild(map_item);

        remove_c_btn.addEventListener("click", () => {   
            console.log("removing beatmap", beatmap.song_title, current_name, beatmap.md5);  
            remove_beatmap(beatmap.md5);
        });
    }

    lazyLoad();
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

btn_rename.addEventListener("click", () => {

    const input = document.getElementById("collection_input_name");

    // yep
    if (!collections.has(current_name)) {
        return;
    }

    // value dit not changed
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
    render_tab(create_container(input.value), collections.get(input.value));

    current_name = input.value;
});

search_box.addEventListener("input", () => {

    const name = search_box.value;
    const elements = document.querySelectorAll(".mini-container");

    if (!name) {
        elements.forEach((e) => e.classList.remove("disabled"));
    };

    elements.forEach((e) => {

        if (e.dataset.title.includes(name)) {
            return;
        }

        if (e.dataset.mapper.includes(name)) {
            return;
        }

        e.classList.add("disabled");
    });
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
    
    render_tab(create_container(collection.name), collections.get(collection.name));

    console.log(collections);
});

btn_update.addEventListener("click", async () => {

    const confirm = await add_get_extra_info([{ type: "confirmation", text: "Are you sure?\nIf you click yes your current collection file will be rewrited"}]);

    if (!confirm) {
        return;
    }

    const new_collection = {
        version: reader.collections.version,
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
    
    reader.collections = new_collection;

    // backup
    const backup_name = `collection_backup_${Date.now()}.db`;
    fs.renameSync(path.resolve(config.get("osu_path"), "collection.db"), path.resolve(config.get("osu_path"), backup_name));

    reader.write_collections_data(path.resolve(config.get("osu_path"), "collection.db"));

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

// yep i stole that code
function lazyLoad() {

    const images = document.querySelectorAll('img.lazy');
    const options = {
        root: null,
        rootMargin: '200px',
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

            } else {

                if (img.src && !img.dataset.src) {
                    img.dataset.src = img.src;
                    img.src = placeholder_img;
                }
            }
        });
    }, options);

    images.forEach(img => imageObserver.observe(img));
}

const setup_manager = () => {

    collection_list.innerHTML = "";

    collections.forEach((v, k) => {

        const new_collection = document.createElement("div");
        new_collection.className = "collection-item";
        new_collection.innerText = k;

        new_collection.addEventListener("click", () => {
            
            const collection_text = document.getElementById("collection_text");

            if (collection_text) {
                collection_text.remove();
            }
            
            const all_collections_text = Array.from(collection_list.children);

            remove_container();
            const container = create_container(k);

            render_tab(container, collections.get(k));

            change_input_value(k);

            all_collections_text.map((e) => e.classList.remove("selected"));
            new_collection.classList.toggle("selected");

            current_name = k;
        });

        collection_list.appendChild(new_collection);
    });
    
    lazyLoad();
};

export const initialize = async (extra) => {

    // get the current collection list
    const collections_array = await reader.get_collections_data();
    const osu_info = await reader.get_osu_data();

    // append the new extra collection
    if (extra) {

        collections_array.length++;
        collections_array.beatmaps.push(extra);

        const collection_text = document.getElementById("collection_text");

        if (collection_text) {
            collection_text.remove();
        }
    }

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

    setup_manager();
};