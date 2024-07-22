import { config } from "../stuff/utils/config/config.js";
import { reader } from "../stuff/collector.js";
import { add_alert, add_get_extra_info } from "../popup/alert.js";

/*                                      TODO LIST:
        - [ ] Instead of appending every single map from every single colelection
              only append the maps from the current selected collection
              so it will use less memory and maybe will perform better?
        - [ ] All the functions needed to (rename / delete / import) collections.
        - [ ] 
*/

const collections = new Map();

const collection_list = document.querySelector(".collection-list");
const main_content = document.querySelector(".main-content");

const btn_add = document.querySelector(".btn-add");
const btn_remove = document.querySelector(".btn-delete");

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

/*

    -- collection example
    <div class="collection-item selected" id="collection_id">Collection 1</div>

    -- map example
     <div class="map-item" id="map_id">
        <div class="map-content">Artist - Title 1</div>
     </div>
*/

const create_containers = (name) => {

    const container = document.createElement("div");
    
    container.classList.add("collection-container");
    container.id = `cl-${name}`;

    main_content.appendChild(container);

    return container;
};

const append_beatmaps = (beatmaps, name) => {

    const container = create_containers(name);

    for (let i = 0; i < beatmaps.length; i++) {

        const beatmap = beatmaps[i];

        const map_item = document.createElement("div");
        const map_content = document.createElement("div");

        const has_beatmap = Boolean(beatmap.artist_name);
        const text = has_beatmap ? `${beatmap.artist_name} - ${beatmap.song_title} [${beatmap.difficulty}]` : "Unknown (Probaly not downloaded)"

        map_item.id = beatmap.md5;

        map_item.className = "map-item";
        map_content.className = "map-content";
        map_content.innerText = text;

        map_item.appendChild(map_content);
        container.appendChild(map_item);
    }
};

// TODO: popup asking the user the osu collector url  
btn_add.addEventListener("click", () => {
    
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

const setup_manager = () => {

    collections.forEach((v, k) => {

        const new_collection = document.createElement("div");
        new_collection.className = "collection-item";
        new_collection.innerText = k;

        new_collection.addEventListener("click", (ev) => {     
            
            const all_collections_text = Array.from(collection_list.children);
            const all_collections_container = document.querySelectorAll(".collection-container");

            all_collections_container.forEach((v) => {

                const currrent_id = ev.target.innerHTML;
                const it_id = v.id.split("cl-")[1];

                if (currrent_id != it_id) {
                    return;
                }

                all_collections_container.forEach((e) => e.classList.remove("cl-selected"));
                v.classList.toggle("cl-selected");
            });

            all_collections_text.map((e) => e.classList.remove("selected"));

            new_collection.classList.toggle("selected");
        });

        collection_list.appendChild(new_collection);

        append_beatmaps(v, k);
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