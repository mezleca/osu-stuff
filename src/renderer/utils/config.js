import { osu_login } from "./other/fetch.js";
import { all_tabs, blink } from "../tabs.js";
import { fs, path } from "./global.js";
import { create_custom_popup, create_alert, popup_type, create_checkbox_box } from "../popup/popup.js";
import { initialize, lazer_mode, core } from "../manager/manager.js";
import { indexed } from "./other/indexed_db.js";
import { create_dialog, get_og_path, get_osu_base_path } from "./other/process.js";
import { downloader } from "./downloader/client.js";

const tooltips_text = {
    "osu_id": "Your OAuth app ID.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the ID below</a>",
    "osu_secret": "Your Oauth app Secret.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the client secret below</a>",
    "lazer_mode": "To switch between osu!stable and lazer",
}

const osu_db_file = "osu!.db";
const collection_db_file = "collection.db";

const config_options = [
    { type: "password", text: "osu_id",      secret: true,        required: true  },
    { type: "password", text: "osu_secret",  secret: true,        required: true  },
    { type: "file",     text: "export_path", secret: true,        required: true  },
    { type: "file",     text: "lazer_path",                       required: false },
    { type: "file",     text: "stable_path",                      required: false },
    { type: "file",     text: "stable_songs_path",                required: false },
    { type: "checkbox", text: "get_images_from_web",              required: false },
    { type: "checkbox", text: "lazer_mode", callback: lazer_mode, required: false }
];

const default_mirrors = [
    { name: "nerynian", url: "https://api.nerinyan.moe/d/" },
    { name: "direct", url: "https://osu.direct/api/d/" },
];

export const is_lazer_mode = () => {
    return core.config.get("lazer_mode") == true;
};

export const save_config = async (key, value) => {

    const success = await indexed.save("config", key, value);

    if (!success) {
        console.error("failed to save config");
        return;
    }

    core.config.set(key, value);
};

const create_element = (html_string) => {
    return new DOMParser().parseFromString(html_string, "text/html").body.firstElementChild;
};

const set_loading_status = (status) => {

    const status_div = document.querySelector(".loading-status");

    if (status_div) {       
        status_div.textContent = status;
    }
};

export const load_osu_files = async (stable_path) => {
    
    const lazer_mode = is_lazer_mode();

    if (lazer_mode) {
        await core.reader.get_collections_data();
        await core.reader.get_osu_data();
        return;
    }

    const db_file = path.resolve(stable_path, osu_db_file);
    const collection_file = path.resolve(stable_path, collection_db_file);

    if (!fs.existsSync(db_file)) {
        create_alert("failed to find osu.db file\nmake sure the osu path is valid", { type: "error" });
        return;
    }

    if (!fs.existsSync(collection_file)) {
        core.reader.collections = { version: 20240820, length: 0, beatmaps: [] };
        await core.reader.write_collections_data();
    }

    set_loading_status("reading osu files...");

    const { cl, db } = await fs.get_osu_files();

    core.reader.buffer = null;
    core.reader.osu = {};
    core.reader.collections = {};

    await core.reader.get_collections_data(cl);
    await core.reader.get_osu_data(db);

    core.reader.buffer = null;
};

const check_folder_permissions = async (folder) => {
    console.log("[config] checking folder access", folder);
    return await window.extra.check_folder_permissions(folder);
};

const get_access_token = async () => {

    const osu_id = core.config.get("osu_id");
    const osu_secret = core.config.get("osu_secret");

    if (osu_id && osu_secret) {

        core.login = await osu_login(osu_id, osu_secret);

        // update downloader token
        if (core.login?.access_token) {
            downloader.update_token(core.login.access_token);
        }
    }
};

const initialize_osu_config = async () => {

    const stable_path = core.config.get("stable_path");
    const songs_path = core.config.get("stable_songs_path");

    if (!fs.existsSync(stable_path) || !fs.existsSync(songs_path)) {
        create_alert("failed to get osu/songs directory<br>make sure the directory is correct", { type: "error", html: true });   
        return;
    }

    await get_access_token();

    const osu_perms = await check_folder_permissions(stable_path);
    const songs_perms = await check_folder_permissions(songs_path);

    if (!osu_perms || !songs_perms) {
        create_alert("failed to read osufolder<br>make sure you have read and write perms on the drive", { type: "error", html: true })
    }
};

const validate_and_setup_config = async () => {

    const fields = [...document.querySelectorAll("#config_fields")];
    const required = config_options
        .filter(opt => opt.required)
        .map(opt => opt.text);

    for (let i = 0; i < fields.length; i++) {

        const field = fields[i];
        const input = field.querySelector("input");

        // if its required and not configured, show error
        if (input.type != "checkbox" && required.includes(input.id) && !input.value) {
            create_alert(`missing value for ${input.id}`, { type: "error" });
            return;
        }

        // save the value in case its not saved
        indexed.save("config", input.id, input.value);
    } 

    if (is_lazer_mode()) {
        await initialize({ force: true });
    } else {
        await initialize_osu_config();
        await initialize({ force: true });
    }

    create_alert("your config is valid!", { type: "success" });
    get_access_token();
};

const manage_mirrors = async (tab, add_button) => {

    tab.innerHTML = "<h1>mirrors list</h1>";
    const mirror_data = await indexed.all("mirrors");

    if (mirror_data.size == 0) {
        for (const mirror of default_mirrors) {
            await indexed.save("mirrors", mirror.name, mirror.url);
            mirror_data.set(mirror.name, mirror.url);
        }
    }

    mirror_data.forEach((url, name) => {

        const element = create_element(`
            <div class="mirror-box">
                <div class="mirror-info">
                    <h1>${name}</h1>
                    <p>${url}</p>
                </div>
                <div id="remove_mirror" style="align-self: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16">
                        <path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/>
                    </svg>
                </div>
                
            </div>
        `);

        const remove_btn = element.querySelector("#remove_mirror");
        remove_btn.addEventListener("click", async () => {
            await indexed.delete("mirrors", name);
            await manage_mirrors(tab, add_button);
        });
        
        tab.appendChild(element);
    });

    tab.appendChild(add_button);
    core.mirrors = mirror_data;
};

export const initialize_config = async () => {

    set_loading_status("checking config...");

    const config_data = await indexed.all("config");

    // load saved config
    if (config_data) {
        core.config = config_data;
    }

    // get app folder
    if (core.og_path == "") {
        core.og_path = get_og_path();
    }

    const config_tab = document.getElementById("config_tab");
    const config_menu = all_tabs[1];
    const fields = [];

    // check if the app folder exists
    if (!fs.existsSync(core.og_path)) {
        fs.mkdirSync(core.og_path, { recursive: true });
    }

    await get_access_token();

    // if we dont have a export path, create one in the app config thing
    if (!core.config.get("export_path")) {

        const export_path = path.resolve(core.og_path, "exports");

        if (!fs.existsSync(export_path)) {
            fs.mkdirSync(export_path, { recursive: true });
        }

        core.config.set("export_path", export_path);
    }

    const osu_base_path = await get_osu_base_path();
    const songs_base_path = path.resolve(osu_base_path, "Songs");

    // try to get stable_path & osu_songs path
    if (!core.config.get("stable_path") && fs.existsSync(osu_base_path)) {
        await save_config("stable_path", osu_base_path);
    }

    if (!core.config.get("stable_songs_path") && fs.existsSync(songs_base_path)) {
        await save_config("stable_songs_path", songs_base_path);
    }

    // blink it!
    if (!core.config.get("stable_path") || !core.config.get("stable_songs_path")) {
        blink(config_menu);
    }

    for (const option of config_options) {

        const value = core.config.get(option.text) || "";
        const text = option.text.replaceAll("_", " ");
        const is_file = option.type == "file";
        const is_checkbox = option.type == "checkbox";

        const input_element = is_checkbox ? create_checkbox_box(crypto.randomUUID(), text, value) : create_element(`
            <input 
                class="${is_file ? "config_input" : "file_input"}" 
                type="${is_file ? "text" : option.type}" 
                name="${option.text}" id="${option.text}" 
                value=${value}
            >
        `);

        const option_container = create_element(`
            <div class="config-option ${is_checkbox ? "row": ""}" id="config_fields"></div>
        `);

        if (is_checkbox) {
            option_container.appendChild(input_element);
        } else {
            const label_element = create_element(`
                <label for="${option.text}">
                    ${text}
                    ${tooltips_text[option.text] ? `<div class="tooltip" id="${option.text}">(?)</div>` : ""}
                </label>
            `);
            option_container.appendChild(label_element);
            option_container.appendChild(input_element);
        }

        if (is_file || is_checkbox) {

            input_element.addEventListener("click", async (event) => {

                const element = event.target;

                if (is_file) {

                    const options = { title: text, properties: ["openDirectory"] };

                    // @TOFIX: this only works on windows...
                    if (value != "") {
                        options.defaultPath = value;
                    }

                    const dialog = await create_dialog(options);

                    if (!dialog.canceled) {
                        await save_config(option.text, dialog.filePaths[0]);
                        element.value = dialog.filePaths[0];
                    }
                } 
                else {

                    if (option?.callback) {
                        option.callback(element, option.text);
                    } else {
                        save_config(option.text, element.checked);
                    }
                }
            });
        } else {
            input_element.addEventListener("input", () => {
                save_config(option.text, input_element.value);
            });
        }

        fields.push(option_container);
    }

    config_tab.innerHTML = `
        <div class="cool-container config_container">
            <div class="config-fields">
                <h1>config</h1>
                <div class="button-container">
                    <button class="check_config" style="width: 100%">check config</button>
                </div>
            </div>
            <div class="mirror-list">
                <h1>mirrors</h1>
            </div>
        </div>
    `;

    const check_button = config_tab.querySelector(".config-fields > .button-container");
    const mirror_tab = config_tab.querySelector(".mirror-list");
    const mirror_add_button = create_element(`<button class="mirror-remove-container">new mirror</button>`);

    await manage_mirrors(mirror_tab, mirror_add_button);

    mirror_add_button.addEventListener("click", async () => {

        if (core.mirrors.size >= 4) {
            create_alert("no more than 4 mirrors my guy", { type: "alert" });
            return;
        }

        const prompt = await create_custom_popup({
            type: popup_type.CUSTOM_MENU,
            submit: "add mirror",
            title: "mirror info",
            elements: [
                { key: "name", element: { input: { label: "mirror name" } } },
                { key: "url", element: { input: { label: "mirror url" } } },
            ],
        });

        // cancelled
        if (!prompt) {
            return;
        }

        if (!prompt.name || !prompt.url) {
            create_alert("invalid mirror", { type: "error" });
            return;
        }

        if (core.mirrors.get(prompt.name)) {
            create_alert("mirror already exists", { type: "alert" });
            return;
        }

        await indexed.save("mirrors", prompt.name, prompt.url);
        await manage_mirrors(mirror_tab, mirror_add_button);
    });

    fields.forEach((field) => check_button.insertAdjacentElement("beforebegin", field));
    check_button.addEventListener("click", validate_and_setup_config);

    // initialize tooltips
    document.querySelectorAll(".tooltip").forEach((tooltip) => {
        tooltip.addEventListener("click", () => {
            const text = tooltips_text[tooltip.id];
            create_alert(text, { html: true, seconds: 5 });
        });
    });

    if (core.config.size == 0) {
        create_alert("config not found<br>can you take a look at config tab pleease :)", { type: "warning", html: true });
        return;
    }

    if (!fs.existsSync(core.config.get("stable_path")) || !fs.existsSync(core.config.get("stable_songs_path"))) {
        create_alert("failed to get osu path!", { type: "alert" });
        return;
    }

    const osu_perms = await check_folder_permissions(core.config.get("stable_path"));
    const songs_perms = await check_folder_permissions(core.config.get("stable_songs_path"));

    if (!osu_perms || !songs_perms) {
        create_alert("failed to read osufolder\nmake sure you have read and write perms on the drive", { type: "error" })
    }

    await load_osu_files(core.config.get("stable_path"));
    await initialize();
};
