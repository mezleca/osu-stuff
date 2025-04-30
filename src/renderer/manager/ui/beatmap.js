import { core } from "../../app.js";
import { create_element, placeholder_image, star_ranges } from "../../utils/global.js";
import { downloader } from "../../utils/downloader/client.js";
import { Reader } from "../../utils/reader/reader.js";
import { open_in_browser } from "../../utils/other/process.js";
import { get_beatmap_sr } from "../tools/beatmaps.js";
import { get_selected_collection, remove_beatmap, show_update_button } from "../manager.js";
import { draggable_items_map, update_collection_count } from "./draggable.js";

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
    const { name } = get_selected_collection();

    if (!core.reader.collections.beatmaps.has(name)) {
        return;
    }

    const beatmap_id = updated_beatmap.beatmap_id;
    const collection = core.reader.collections.beatmaps.get(name);

    // remove diffs that have the save beatmap_id
    for (const [k, v] of core.reader.osu.beatmaps) {
        if (v.beatmap_id == beatmap_id && collection.maps.has(v.md5)) {
            remove_beatmap(v.md5);
        }
    }

    show_update_button();
};

const set_beatmap_image = async (bmap, element) => {

    // fething from web
    if (core.config.get("get_images_from_web")) {
        element.src = `https://assets.ppy.sh/beatmaps/${bmap.beatmap_id}/covers/cover.jpg`;
        return;
    }

    // or just getting straight of the songs folder
    core.reader.get_beatmap_image(bmap).then((src) => {

        if (!src) {
            element.src = `https://assets.ppy.sh/beatmaps/${bmap.beatmap_id}/covers/cover.jpg`;
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

    if (container.querySelector(".extra-info-container")) {
        return;
    }
    
    const extra = create_element(`
        <div class="extra-info-container">
            <div class="extra-info-content">
                <div class="stats-grid">
                </div>
            </div>
            <div class="close-container">
                <button class="close-btn">hide</button>
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
    const close = extra.querySelector(".close-btn");

    const ar = create_stat_item("ar", beatmap.approach_rate);
    const hp = create_stat_item("hp", beatmap.hp);
    const cs = create_stat_item("cs", beatmap.circle_size);
    const od = create_stat_item("od", beatmap.od);

    stats_grid.appendChild(ar);
    stats_grid.appendChild(cs);
    stats_grid.appendChild(hp);
    stats_grid.appendChild(od);

    close.addEventListener("click", () => {
        extra.remove();
    });

    return extra;
};

export const create_beatmap_card = (md5) => {

    // get beatmap info from osu db file
    let beatmap = core.reader.osu.beatmaps.get(md5) || {};

    const has_beatmap = Boolean(beatmap?.artist_name);
    const beatmap_container = create_element(`<div class="beatmap-card-container"></div>`)
    const beatmap_element = create_element(`
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
                        <svg id="play-button" viewBox="0 0 84 100" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                            <polygon points="10,0 10,100 90,50"/>
                        </svg>
                    </button>      
                    <button class="download-button">
                        <i class="bi bi-download"></i>
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

    const status = Reader.get_beatmap_status(beatmap.status) || "Unknown";
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

    const show_extra = (container, beatmap) => {

        const extra = create_extra_information(container, beatmap);

        if (!extra) {
            return;
        }

        beatmap_container.appendChild(extra);
    };

    set_beatmap_status(status);

    // to make sure
    if (!isNaN(beatmap_sr)) {
        update_sr(beatmap_sr);
    }

    title.textContent = beatmap?.song_title || "Unknown";
    subtitle.textContent = beatmap?.difficulty || "Unknown";

    // show more information on click
    beatmap_element.addEventListener("click", () => {

        if (!beatmap?.artist_name) {
            return;
        }

        show_extra(beatmap_container, beatmap);
    });

    // open in browser
    title.addEventListener("click", (e) => {

        e.stopPropagation();

        if (!beatmap?.url && !beatmap?.difficulty_id) {
            return;
        }

        open_in_browser(beatmap);
    });

    if (has_beatmap) {

        download_button.remove();
        set_beatmap_image(beatmap, beatmap_bg);

        const export_beatmap = () => {
            core.reader.export_beatmap(beatmap).then((success) => {
                if (success) {
                    core.progress.update(`exported ${beatmap.beatmap_id} to`, { type: "folder", url: core.config.get("export_path") });
                } else {
                    core.progress.update(`failed to export ${beatmap.beatmap_id}`);
                }
            });         
        };

        const { name } = get_selected_collection();
        const collection_keys = Array.from(core.reader.collections.beatmaps.keys())
            .filter((k) => k != name)
            .map((k) => { return { text: k, action: (el) => { move_to(el.target, md5) } }});

        // setup beatmap context menu
        window.ctxmenu.attach(beatmap_container, [
            { text: "open on browser", action: () => open_in_browser(beatmap) },
            { isDivider: true },
            { text: "export beatmap", action: () => export_beatmap() },
            { text: "move to", subMenu: collection_keys },
            { text: "remove beatmap", action: () => remove_beatmap(md5) },
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

            if (audio_core.id == beatmap.beatmap_id) {
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

                const preview_data = await fetch(`https://b.ppy.sh/preview/${beatmap.beatmap_id}.mp3`, {
                    headers: {
                        "Accept": "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5",
                        "Sec-GPC": "1",
                        "Sec-Fetch-Dest": "audio",
                    }
                });
                
                const audio_source = await preview_data.blob();

                audio_core.audio = new Audio(window.URL.createObjectURL(audio_source));
                audio_core.audio.volume = 0.5;
                audio_core.id = beatmap.beatmap_id;
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

                    beatmap = Object.assign(beatmap, {
                        artist_name: data.beatmapset.artist,
                        song_title: data.beatmapset.title,
                        difficulty: data.version,
                        md5: data.checksum,
                        mapper: data.beatmapset.creator,
                        difficulty_id: data.beatmapset_id,
                        beatmap_id: data.beatmapset.id,
                        url: data.url,
                        sr: data.difficulty_rating,
                        bpm: data.bpm,
                        tags: "",
                        od: data.accuracy,
                        approach_rate: data.ar,
                        circle_size: data.cs,
                        hp: data.drain, 
                        status: Reader.get_beatmap_status_code(data.status) || 0
                    });

                    const image_url = `https://assets.ppy.sh/beatmaps/${beatmap.beatmap_id}/covers/cover.jpg`;
    
                    set_beatmap_status(data.status);
                    update_sr(data.difficulty_rating);      
    
                    core.reader.osu.beatmaps.set(data.checksum, beatmap);
                    title.textContent = beatmap.song_title || "Unknown";
                    subtitle.textContent = beatmap.difficulty || "Unknown";
                    beatmap_bg.src = image_url;
                });

            } catch (error) {
                console.log(error);
                core.progress.update("failed to download beatmap...");
            }
        });
    }

    remove_button.addEventListener("click", (e) => {
        e.stopPropagation();
        remove_beatmap(md5);
    });

    beatmap_container.appendChild(beatmap_element)
    remove_button.id = `bn_${md5}`;

    return beatmap_container;
};
