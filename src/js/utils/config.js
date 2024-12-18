import { create_alert, create_custom_message } from "../popup/popup.js";
import { osu_login } from "./other/login.js";
import { debounce, initialize } from "../manager/manager.js";
import { all_tabs, blink } from "../tabs.js";
import { OsuReader } from "../reader/reader.js";
import { get_all_from_database, save_to_db } from "./other/indexed_db.js";

const fs = window.nodeAPI.fs;
const path = window.nodeAPI.path;

export const core = {
    reader: new OsuReader(),
    config: new Map(),
    files: new Map(),
    og_path: window.nodeAPI.env.og_path,
    login: null
};

const tooltips_text = {
    "osu_id": "Your OAuth app ID.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the ID below</a>",
    "osu_secret": "Your Oauth app Secret.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the client secret below</a>"
}

const config_options = {
    osu_id: "osu id",
    osu_secret: "osu secret",
    osu_path: "osu path",
    osu_songs_path: "songs path"
};

const update_config = async (key, value) => {
    console.log("saving", key);
    const success = await save_to_db("config", key, value);
    if (!success) {
        console.error("failed to save config");
    }
    core.config.set(key, value);
};

export const setup_tooltip = () => {

    const tooltips = document.querySelectorAll(".tooltip");

    for (const tooltip of tooltips) {
        tooltip.addEventListener("click", () => {
            const text = tooltips_text[tooltip.id];
            create_alert(text, { html: true, seconds: 5 });
        });
    }
}

export const update_status = (status) => {

    const status_div = document.querySelector(".loading-status");

    if (!status_div) {
        return;
    }

    status_div.innerText = status;
}

export const get_files = async (osu) => {

    const db_file = path.resolve(osu, "osu!.db");
    const cl_file = path.resolve(osu, "collection.db");

    if (!fs.existsSync(db_file)) {
        create_alert("failed to find osu.db file\nmake sure the osu path is valid", { type: "error" });
        return;
    }

    // if collections.db doesn't exist, create a new file
    if (!fs.existsSync(cl_file)) {

        core.reader.collections  = {
            version: 20240820, 
            length: 0, 
            beatmaps: []
        };
        
        const file_path = path.resolve(cl_file);
        await core.reader.write_collections_data(file_path);

        console.log("created a new collections.db file in", file_path);
    }

    const osu_file = fs.readFileSync(db_file);
    const collection_file = fs.readFileSync(cl_file);
    
    core.reader.buffer = null;
    core.reader.osu = {};
    core.reader.collections = {};

    update_status("reading osu files...");

    core.files.set("osu", osu_file);
    core.files.set("collection", collection_file);

    core.reader.set_buffer(collection_file, true);
    await core.reader.get_collections_data();

    core.reader.set_buffer(osu_file, true);
    await core.reader.get_osu_data();
}

const setup_config = async () => {

    const osu_id = core.config.get("osu_id");
    const osu_secret = core.config.get("osu_secret");  
    const osu_path = core.config.get("osu_path");
    const osu_songs = core.config.get("osu_songs_path");

    if (osu_id, osu_secret) {
        core.login = await osu_login(osu_id, osu_secret);
        if (!core.login) {
            create_alert("Failed to login", { type: "error" });
            return;
        }
    }

    if (!fs.existsSync(osu_path) || !fs.existsSync(osu_songs)) {
        create_alert("failed to get osu/songs directory\nPlease make sure the directory is correct", { type: "error" });   
        return;
    }

    await get_files(osu_path);
    create_alert("config is working!", { type: "success" });
};

const handle_config_check = async () => {

    let is_valid = true;

    document.querySelectorAll("#config_fields").forEach((field) => {
        const input = field.querySelector("input");
        if (!input.value) {
            create_alert(`missing value for ${input.id}`, { type: "error" });
            is_valid = false;
        }
    });

    if (!is_valid) {
        return;
    }

    await setup_config();
    await initialize();
}

const handle_mirrors = async (event) => {
    const method = await create_custom_message({
        type: message_types.CUSTOM_MENU,
        title: "method",
        elements: [{
            key: "name",
            element: { list: ["best performance", "first place", "favourites", "created maps", "all"] }
        }]
    });
};

const create_element_from_string = (html) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content.cloneNode(true).firstElementChild;
};

export const add_config_shit = async () => {

    update_status("checking config...");

    const config_data = await get_all_from_database("config");
    
    if (config_data) {
        core.config = config_data;
    }

    const empty_config = core.config.size;
    const config_tab = document.getElementById("config_tab");
    const config_menu = all_tabs[1];
    const label_content = [];

    if (!fs.existsSync(core.og_path)) {
        fs.mkdirSync(core.og_path, { recursive: true });
    }

    if (core.config.get("osu_id") && core.config.get("osu_secret")) {
        core.login = await osu_login(core.config.get("osu_id"), core.config.get("osu_secret"));
    }

    const osu_base_path = window.nodeAPI.env.osu_default_path;
    const songs_base_path = path.resolve(osu_base_path, "Songs");

    const osu_exist = fs.existsSync(osu_base_path);
    const songs_exist = fs.existsSync(songs_base_path);

    if (!core.config.get("osu_path") && osu_exist) {
        await update_config("osu_path", osu_base_path);
    }

    if (!core.config.get("osu_songs_path") && songs_exist) {
        await update_config("osu_songs_path", songs_base_path);
    }

    if (!core.config.get("osu_path") || !core.config.get("osu_songs_path")) {
        blink(config_menu);
    }

    for (const [k, v] of Object.entries(config_options)) {

        const should_hide = k == "osu_id" || k == "osu_secret";
        const is_readonly = !should_hide, is_dialog = !should_hide;
        const config_value = core.config.get(k);

        const container_element = create_element_from_string(`
            <div class="input-container" id="config_fields">
                <label for="${k}">
                    ${v}
                    ${tooltips_text[k] ? `<div class="tooltip" id="${k}">(?)</div>` : ''}
                </label>
                <input 
                    class="${is_dialog ? 'config_input' : 'file_input'}" 
                    type="${should_hide ? 'password' : 'text'}" 
                    name="${k}" id="${k}" 
                    value="${config_value || ''}" 
                    ${is_readonly ? 'readonly' : ''}>
            </div>
        `);

        const option = container_element.querySelector(".input-container > input");

        // update config
        if (should_hide) {
            option.addEventListener("input", debounce(async () => { 
                if (option.value) {
                    await update_config(k, option.value); 
                }        
            } , 300));
        }

        // open dialog
        if (is_dialog) {
            option.addEventListener("click", async () => {
                const dialog = await window.electron.create_dialog();
                if (!dialog.canceled) {
                    const folder_path = dialog.filePaths[0];
                    await update_config(option.name, folder_path);
                    option.value = folder_path;
                }
            });
        }

        label_content.push(container_element);
    }

    config_tab.innerHTML = `
        <div class="tab-shit" style="width: 45%; height: 100%;">
            <h1>config</h1>
            <div class="button-container">
                <button class="check_config">check config</button>
                <button class="mirrors">manage mirrors</button>
            </div>
        </div>
        <div class="tab-shit" style="width: 45%; height: 100%;">
            <h1>mirrors list</h1>
        </div>
    `;

    // append config fields before the check button
    const check_button = config_tab.querySelector(".tab-shit > .button-container");
    const mirrors_button = config_tab.querySelector(".mirrors");
    label_content.forEach(e => {
        check_button.insertAdjacentElement("beforebegin", e);
    });

    check_button.addEventListener("click", handle_config_check);
    mirrors_button.addEventListener("click", handle_mirrors);

    setup_tooltip();

    if (!empty_config) {
        create_alert("config not found<br>can you take a look at config tab pleease :)", { html: true });
        return;
    }

    if (!fs.existsSync(core.config.get("osu_path"))) {
        create_alert("osu path is invalid!", { type: "alert" });
        return;
    }

    if (!fs.existsSync(core.config.get("osu_songs_path"))) {
        create_alert("osu songs path is invalid!", { type: "alert" });
        return;
    }

    await get_files(core.config.get("osu_path"));
    await initialize();
};