import { core, update_beatmaps } from "../manager.js";
import { create_element, placeholder_image, star_ranges } from "../../utils/global.js";
import { downloader } from "../../utils/downloader/client.js";
import { Reader } from "../../utils/reader/reader.js";
import { open_in_browser, open_url } from "../../utils/other/process.js";
import { get_beatmap_sr } from "../tools/beatmaps.js";
import { get_selected_collection, remove_beatmap, show_update_button } from "../manager.js";
import { draggable_items_map, update_collection_count } from "./draggable.js";
import { ctxmenu } from "./context.js";
import { create_alert } from "../../popup/popup.js";

const audio_core = { audio: null, id: 0, target: null };

const move_to = (el, md5) => {

    // make sure to get the updated beatmap
    const collection_name = el.textContent;

    if (!core.reader.collections.beatmaps.has(collection_name)) {
        console.log("[move to] failed to find collection", el, md5);
        return;
    }

    const collection = core.reader.collections.beatmaps.get(collection_name);
    collection.maps = new Set([...collection.maps, md5]);

    // update collection count
    for (const [k, v] of draggable_items_map) {
        if (v.collection_id == collection_name) {
            update_collection_count(k, collection_name);
            break;
        }
    }

    // update sr and shit
    core.reader.update_collections();
    show_update_button();
};

const delete_set = (md5) => {

    // make sure to get the updated beatmap
    const updated_beatmap = core.reader.osu.beatmaps.get(md5);
    const { id, name } = get_selected_collection();

    if (!core.reader.collections.beatmaps.has(name)) {
        return;
    }

    const beatmapset_id = updated_beatmap.beatmapset_id;
    const collection = core.reader.collections.beatmaps.get(name);

    // remove diffs that have the save beatmapset_id
    for (const [k, v] of core.reader.osu.beatmaps) {
        if (v.beatmapset_id == beatmapset_id && collection.maps.has(v.md5)) {
            remove_beatmap(v.md5, false);
        }
    }

    // update filtered beatmaps, etc...
    update_beatmaps({ check: true, force: false }).then(() => {
        update_collection_count(id, name);
        show_update_button();
    });

    show_update_button();
};

const set_beatmap_image = async (bmap, element) => {

    // fething from web
    if (core.config.get("get_images_from_web") || !bmap?.downloaded) {
        element.src = `https://assets.ppy.sh/beatmaps/${bmap.beatmapset_id}/covers/cover.jpg`;
        return;
    }

    // or just getting straight of the songs folder
    core.reader.get_beatmap_image(bmap).then((src) => {

        if (!src) {
            element.src = `https://assets.ppy.sh/beatmaps/${bmap.beatmapset_id}/covers/cover.jpg`;
            return;
        }

        // use this on files from osu folder to make it more "centered"
        element.classList.add("bg-image-custom");
        element.src = `media://${encodeURIComponent(src)}`;
    });
};

const create_extra_information = (container, beatmap) => {

    if (!beatmap) {
        return;
    }

    // check if the container already exists
    if (container.querySelector(".extra-info-container")) {
        return;
    }

    // popup kind div that will close when clicking on it (outside)
    const main_div = create_element(`<div class="popup-container"></div>`);
    
    const extra = create_element(`
        <div class="extra-info-container">
            <div class="extra-info-header">
                <h1 class="extra-info-title">extra information</h1>
            </div>
            <div class="extra-info-content">
                <div class="stats-grid"></div>
                <div class="preview-container" style="style="display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; height: 100%;">
                    <button>load preview</button>         
                </div>
            </div>
        </div>    
    `);

    const create_stat_item = (name, value) => {

        const item = create_element(`
            <div class="stat-item">
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width: 0%"></div>
                </div>
                <span class="stat-label"></span>
                <span class="stat-value"></span>         
            </div>
        `);

        const stat_label = item.querySelector(".stat-label");
        const stat_value = item.querySelector(".stat-value");
        const stat_bar = item.querySelector(".stat-bar-fill");

        if (beatmap.srcolor) {
            stat_bar.classList.add(beatmap.srcolor);
        }

        stat_label.textContent = name.toUpperCase();
        stat_value.textContent = Number(value).toFixed(1);
        stat_bar.style.width = Math.round((value / 10) * 100) + "%"; 
        
        item.classList.add(name);
        return item;
    };

    const stats_grid = extra.querySelector(".stats-grid");
    const extra_info_title = extra.querySelector(".extra-info-title");
    const preview_container = extra.querySelector(".preview-container");
    const load_preview = preview_container.children[0];

    load_preview.addEventListener("click", (e) => {

        const preview_url = `https://viewer.osucad.com/b/${beatmap.beatmapset_id}/${beatmap.difficulty_id}`;
        const iframe = create_element(`
            <iframe src="${preview_url}" allowfullscreen autoplay width="300" height="300">
        `);
        const open_on_browser = create_element(`
            <h2 class="extra-info-preview" style="cursor: pointer; font-size: 1.2em;">open preview on browser</h2>
        `);

        open_on_browser.addEventListener("click", (e) => {
            e.stopPropagation();
            open_url(preview_url);
        });

        // add iframe to preview container
        preview_container.replaceChildren(open_on_browser, iframe);
    });

    // create stats
    const ar = create_stat_item("ar", beatmap.ar);
    const hp = create_stat_item("hp", beatmap.hp);
    const cs = create_stat_item("cs", beatmap.cs);
    const od = create_stat_item("od", beatmap.od);

    stats_grid.replaceChildren(ar, hp, cs, od);

    const style = window.getComputedStyle(document.querySelector(`.${beatmap.srcolor}`));
    const color = style.backgroundColor;

    if (color) {
        extra.style.border = `1px solid ${color}`;
    }

    extra_info_title.textContent = `${beatmap.title} [${beatmap.difficulty}]`;

    const close_container = () => {
        main_div.remove();
    };

    main_div.addEventListener("click", (e) => {
        if (e.target == main_div) {
            close_container();
        }
    });

    main_div.appendChild(extra);
    document.body.appendChild(main_div);
    return extra;
};

export const create_beatmap_card = (md5) => {

    // get beatmap info from osu db file
    const beatmap = core.reader.osu.beatmaps.get(md5) || {};
    const has_beatmap = !!beatmap?.artist;

    const beatmap_container = create_element(`<div class="beatmap-card-container"></div>`);
    const beatmap_element = create_element(`
        <div class="beatmap-card not-downloaded">
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
                        <svg id="play-button" viewBox="0 0 84 100" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                            <polygon points="10,0 10,100 90,50"/>
                        </svg>
                    </button>      
                    <button class="download-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-arrow-down-fill" viewBox="0 0 16 16">
                            <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1m-1 4v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 11.293V7.5a.5.5 0 0 1 1 0"/>
                        </svg>
                    </button>
                    <button class="remove-btn">
                        <svg viewBox="0 0 10 10" width="14px" height="14px" stroke="currentColor" stroke-width="2">
                            <path d="M1,1 9,9 M9,1 1,9" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `);
    
    // get important elements
    const title = beatmap_element.querySelector('.title');
    const subtitle = beatmap_element.querySelector('.subtitle');
    const download_button = beatmap_element.querySelector(".download-button");
    const beatmap_bg = beatmap_element.querySelector(".bg-image");
    const beatmap_status = beatmap_element.querySelector(".beatmap-card-status").children[0];
    const remove_button = beatmap_element.querySelector(".remove-btn");
    const preview_button = beatmap_element.querySelector(".preview-button");
    const star_rating = beatmap_element.querySelector(".star_fucking_rate");

    const status = Reader.get_beatmap_status(beatmap.status) || "unknown";
    const beatmap_sr = get_beatmap_sr(beatmap);

    beatmap_container.id = `bn_${md5}`;

    const set_beatmap_status = (status) => {
        beatmap_status.innerText = String(status).toUpperCase();
        beatmap_status.classList.add(String(status).toLowerCase());
    };

    const update_sr = (sr) => {

        const class_name = star_ranges.find(([min, max]) => sr >= min && sr <= max)[2];

        star_rating.innerText = `★ ${sr}`;
        star_rating.classList.add(class_name);
        
        // to use on beatmap info
        beatmap.srcolor = class_name;
        
        if (sr >= 7) {
            star_rating.style.color = "#ebcf34";
        }
    };

    set_beatmap_status(status);

    // to make sure
    if (!isNaN(beatmap_sr)) {
        update_sr(beatmap_sr);
    }

    title.textContent = beatmap?.title || "unknown";
    subtitle.textContent = beatmap?.difficulty || "unknown";

    // show more information on click
    beatmap_element.addEventListener("click", () => {

        if (!beatmap?.artist) {
            return;
        }

        create_extra_information(beatmap_container, beatmap);
    });

    // open in browser
    title.addEventListener("click", (e) => {

        e.stopPropagation();

        if (!beatmap?.url && !beatmap?.difficulty_id) {
            return;
        }

        open_in_browser(beatmap);
    });

    const set_as_downloaded = () => {
        download_button?.remove();
        beatmap_element.classList.remove("not-downloaded");
    };

    // remove download icon if we already have the map
    if (beatmap?.downloaded) {
        set_as_downloaded();
    } else { 
        download_button.addEventListener("click", async (e) => {

            e.stopPropagation();
            core.progress.update("searching beatmap...");

            try {

                downloader.single(md5).then((info) => {

                    if (!info.success) {
                        create_alert("failed to find beatmap :c", { type: "alert" });
                        return;
                    }

                    const data = info.data;

                    Object.assign(beatmap, {
                        artist: data.beatmapset.artist,
                        title: data.beatmapset.title,
                        difficulty: data.version,
                        md5: data.checksum,
                        mapper: data.beatmapset.creator,
                        difficulty_id: data.beatmapset_id,
                        beatmapset_id: data.beatmapset.id,
                        url: data.url,
                        sr: data.difficulty_rating,
                        bpm: data.bpm,
                        tags: "",
                        od: data.accuracy,
                        ar: data.ar,
                        cs: data.cs,
                        hp: data.drain,
                        downloaded: true,
                        status: Reader.get_beatmap_status_code(data.status) || 0
                    });
    
                    set_beatmap_status(data.status);
                    update_sr(data.difficulty_rating);      
    
                    core.reader.osu.beatmaps.set(data.checksum, beatmap);
                    title.textContent = beatmap.title || "unknown";
                    subtitle.textContent = beatmap.difficulty || "unknown";
                    beatmap_bg.src = `https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`;

                    set_as_downloaded();
                });

            } catch (error) {
                console.log(error);
                core.progress.update("failed to download beatmap...");
            }
        });
    }

    if (has_beatmap) {

        set_beatmap_image(beatmap, beatmap_bg);

        const export_beatmap = () => {
            core.reader.export_beatmap(beatmap).then((success) => {
                if (success) {
                    core.progress.update(`exported ${beatmap.beatmapset_id} to`, { type: "folder", url: core.config.get("export_path") });
                } else {
                    core.progress.update(`failed to export ${beatmap.beatmapset_id}`);
                }
            });         
        };

        const { name } = get_selected_collection();
        const collection_keys = Array.from(core.reader.collections.beatmaps.keys())
            .filter((k) => k != name)
            .map((k) => { return { text: k, action: (el) => { move_to(el.target, md5) } }});

        // setup beatmap context menu
        ctxmenu.attach(beatmap_container, [
            { text: "open on browser", action: () => open_in_browser(beatmap) },
            { isDivider: true },
            { text: "export beatmap", action: () => export_beatmap() },
            // @NOTE: theres a chance that the context menu submenu will be bigger than the screen
            // normal human beings will not have this issue, but if you have a lot of collections it might be a problem
            { text: "move to", subMenu: collection_keys },
            { text: "remove beatmap", action: () => remove_beatmap(md5, true) },
            { text: "remove beatmapset", action: () => delete_set(md5) }
        ]);

        const set_play = (target) => {
            target.innerHTML = `
                <svg viewBox="0 0 100 100" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <rect x="15" y="0" width="25" height="100"/>
                    <rect x="65" y="0" width="25" height="100"/>
                </svg>
            `;
        };

        const set_pause = (target) => {
            target.innerHTML = `
                <svg id="play-button" viewBox="0 0 84 100" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <polygon points="10,0 10,100 90,50"/>
                </svg>
            `;
        };

        preview_button.addEventListener("click", async (e) => {

            e.stopPropagation();
            
            const play = () => {
                set_play(audio_core.target);
                audio_core.audio.play();
            };

            const stop = () => {
                set_pause(audio_core.target);
                audio_core.audio.pause();
                audio_core.audio.currentTime = 0;
            };

            if (audio_core.id == beatmap.beatmapset_id) {
                if (audio_core.audio.paused) {            
                    audio_core.target = preview_button;    
                    return play();
                }
                return stop();
            }

            if (audio_core.audio) {
                stop();
            }

            try {

                const preview_data = await fetch(`https://b.ppy.sh/preview/${beatmap.beatmapset_id}.mp3`, {
                    headers: {
                        "Accept": "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5",
                        "Sec-GPC": "1",
                        "Sec-Fetch-Dest": "audio",
                    }
                });
                
                const audio_source = await preview_data.blob();

                audio_core.audio = new Audio(window.URL.createObjectURL(audio_source));
                audio_core.audio.volume = 0.5;
                audio_core.id = beatmap.beatmapset_id;
                audio_core.target = preview_button;
                audio_core.audio.addEventListener("ended", stop);
                
                play();
            } catch (error) {
                console.error("failed to load preview:", error);
            }
        });

    } else {
        preview_button.remove();
        beatmap_bg.src = placeholder_image; 
    }

    remove_button.addEventListener("click", (e) => {
        e.stopPropagation();
        remove_beatmap(md5, true);
    });

    beatmap_container.appendChild(beatmap_element);
    remove_button.id = `bn_${md5}`;

    return beatmap_container;
};
