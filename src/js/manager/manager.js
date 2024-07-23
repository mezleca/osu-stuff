const path = require("path");
const shell = require("electron").shell;

import { config } from "../stuff/utils/config/config.js";
import { reader } from "../stuff/collector.js";
import { add_alert, add_get_extra_info } from "../popup/alert.js";

let current_name = "";

const collections = new Map();

const collection_list = document.querySelector(".collection-list");
const main_content = document.querySelector(".main-content");

const btn_add    = document.querySelector(".btn-add");
const btn_remove = document.querySelector(".btn-delete");
const btn_rename = document.getElementById("rename_collection");
const btn_update = document.getElementById("update_collections");

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

const render_tab = (tab, beatmaps) => {

    console.log("Rendering",tab, beatmaps);

    for (let i = 0; i < beatmaps.length; i++) {
        
        const beatmap = beatmaps[i];

        const map_item = document.createElement("div");
        const map_content = document.createElement("div");
        const map_item_bg = document.createElement("div");
        const map_item_content = document.createElement("h1");
        const map_image = document.createElement("img");

        const has_beatmap = Boolean(beatmap.artist_name);
        const text = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]` : "Unknown (Probaly not downloaded)"

        map_item.id = beatmap.md5;

        const img_path = path.resolve(`${config.get("osu_path")}`, `Data`, `bt`, `${beatmap.beatmap_id}l.jpg`);

        if (has_beatmap) {
            map_image.dataset.src = img_path;
            map_image.className = "map-item-img lazy";
        }
        
        map_item.className = "map-item";
        map_item_content.className = "map-item-content";
        map_item_bg.className = "map-item-bg";

        map_content.className = "map-content";
        map_item_content.innerText = text;

        map_item_bg.appendChild(map_image);

        map_item.addEventListener("click", () => {
            shell.openExternal(`https://osu.ppy.sh/b/${beatmap.difficulty_id}`);
        });

        map_content.appendChild(map_item_content);
        map_content.appendChild(map_item_bg);
        map_item.appendChild(map_content);
        
        tab.appendChild(map_item);
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

// TODO: popup asking the user the osu collector url  
btn_add.addEventListener("click", () => {
    
});

btn_update.addEventListener("click", async () => {

    const confirm = await add_get_extra_info([{ type: "confirmation", text: "Are you sure?\nIf you click yes you current collection file will be rewrited"}]);

    if (!confirm) {
        return;
    }

    // TODO: the logic to rewrite the file

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

        add_alert(collection_name, "has been deleted");

        // TODO: delete the collection from the collections map and replace the collection file with the updated one.

    }
});

// yep i stole that code
function lazyLoad() {
    const lazyImages = document.querySelectorAll('img.lazy');
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    }, options);

    lazyImages.forEach(img => imageObserver.observe(img));
}

window.addEventListener('scroll', lazyLoad);
window.addEventListener('resize', lazyLoad);
window.addEventListener('orientationchange', lazyLoad);

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
            setTimeout(lazyLoad, 100);

            all_collections_text.map((e) => e.classList.remove("selected"));
            new_collection.classList.toggle("selected");

            current_name = k;
        });

        collection_list.appendChild(new_collection);
    });
};

export const initialize = async () => {

    // get the current collection list
    const collections_array = await reader.get_collections_data();
    const osu_info =  await reader.get_osu_data();

    const osu_beatmaps = new Map();
    osu_info.beatmaps.forEach(element => {
        osu_beatmaps.set(element.md5, element);
    });

    for (let i = 0; i < collections_array.beatmaps.length; i++) {
        
        const current_collection = collections_array.beatmaps[i];
        const { name, maps } = current_collection;

        const info = maps.map((map) => osu_beatmaps.get(map) || map);

        collections.set(name, info);
    };

    setup_manager();


};