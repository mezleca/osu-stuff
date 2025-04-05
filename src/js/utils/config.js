import { core } from "../app.js";
import { osu_login } from "./other/fetch.js";
import { all_tabs, blink } from "../tabs.js";
import { fs, path } from "./global.js";
import { create_custom_popup, create_alert, message_types } from "../popup/popup.js";
import { initialize, lazer_mode } from "../manager/manager.js";
import { delete_from_db, get_all_from_database, save_to_db } from "./other/indexed_db.js";
import { create_dialog, get_og_path, get_osu_base_path } from "./other/process.js";

const tooltips_text = {
    "osu_id": "Your OAuth app ID.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the ID below</a>",
    "osu_secret": "Your Oauth app Secret.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the client secret below</a>",
    "lazer_mode": "To switch between osu!stable and lazer",
}

const osu_db_file = "osu!.db";
const collection_db_file = "collection.db";

const config_options = [
    { type: "password", text: "osu_id",      secret: true        },
    { type: "password", text: "osu_secret",  secret: true        },
    { type: "file",     text: "export_path", secret: true        },
    { type: "file",     text: "lazer_path"                       },
    { type: "file",     text: "stable_path",                     },
    { type: "file",     text: "stable_songs_path"                },
    { type: "checkbox", text: "get_images_from_web"              },
    { type: "checkbox", text: "lazer_mode", callback: lazer_mode }
];

const default_mirrors = [
    { name: "nerynian", url: "https://api.nerinyan.moe/d/" },
    { name: "direct", url: "https://osu.direct/api/d/" },
];

export const is_lazer_mode = () => {
    return core.config.get("lazer_mode") == true;
};

export const save_config = async (key, value) => {

    const success = await save_to_db("config", key, value);

    if (!success) {
        console.error("failed to save config");
        return;
    }

    core.config.set(key, value);
};

export const create_element = (html_string) => {
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
        await core.reader.write_collections_data(collection_file);
        console.log("creating placeholder file");
    }

    const osu_data = fs.readFileSync(db_file);
    const collection_data = fs.readFileSync(collection_file);

    core.reader.buffer = null;
    core.reader.osu = {};
    core.reader.collections = {};

    set_loading_status("reading osu files...");

    await core.reader.get_collections_data(collection_data);
    await core.reader.get_osu_data(osu_data);

    core.reader.buffer = null;
};

const check_folder_permissions = async (folder) => {

    console.log("[config] checking folder access", folder);

    try {

        const test_file = path.join(folder, `test-${Date.now()}.tmp`);
        const test_file_renamed = path.join(folder, "renamed-test.tmp");

        fs.writeFileSync(test_file, "test");
        fs.readFileSync(test_file);
        fs.renameSync(test_file, test_file_renamed);
        fs.unlinkSync(test_file_renamed);

        const first_file = fs.readdirSync(folder)[0];

        if (first_file) {
            const file_path = path.join(folder, first_file);
            const stats = fs.statSync(file_path);
            const is_dir = (stats.mode & 0o170000) == 0o040000;
            const temp_name = path.join(folder, is_dir ? "stufttest0101" : "renamed-test.tmp");
            fs.renameSync(file_path, temp_name);
            fs.renameSync(temp_name, file_path);
        }

        return true;
    } catch (err) {
        console.log("[config] folder perm error:", err);
        return false;
    }
};

const initialize_osu_config = async () => {

    const osu_id = core.config.get("osu_id");
    const osu_secret = core.config.get("osu_secret");
    const stable_path = core.config.get("stable_path");
    const songs_path = core.config.get("stable_songs_path");

    if (osu_id && osu_secret) {

        core.login = await osu_login(osu_id, osu_secret);

        if (!core.login) {
            create_alert("failed to login", { type: "error" });
            return;
        }
    }

    if (!fs.existsSync(stable_path) || !fs.existsSync(songs_path)) {
        create_alert("failed to get osu/songs directory\nPlease make sure the directory is correct", { type: "error" });   
        return;
    }

    const osu_perms = await check_folder_permissions(stable_path);
    const songs_perms = await check_folder_permissions(songs_path);

    if (!osu_perms || !songs_perms) {
        create_alert("failed to read osufolder\nmake sure you have read and write perms on the drive", { type: "error" })
    }

    await load_osu_files(stable_path);
    create_alert("config updated!", { type: "success" });
};

const validate_and_setup_config = async () => {

    let valid = true;
    const lazer_mode = is_lazer_mode();

    document.querySelectorAll("#config_fields").forEach((field) => {

        const input = field.querySelector("input");

        if (input.type != "checkbox" && !input.value) {
            create_alert(`missing value for ${input.id}`, { type: "error" });
            valid = false;
        }
    });

    if (valid) {
        if (lazer_mode) {
            await initialize({ force: true });
        } else {
            await initialize_osu_config();
            await initialize({ force: true });
        }
    }
};

const manage_mirrors = async (tab, add_button) => {

    tab.innerHTML = "<h1>mirrors list</h1>";
    const mirror_data = await get_all_from_database("mirrors");

    if (mirror_data.size == 0) {
        for (const mirror of default_mirrors) {
            await save_to_db("mirrors", mirror.name, mirror.url);
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
                <i class="bi bi-trash-fill" id="remove_mirror"></i>
            </div>
        `);

        const remove_btn = element.querySelector("#remove_mirror");
        remove_btn.addEventListener("click", async () => {
            await delete_from_db("mirrors", name);
            await manage_mirrors(tab, add_button);
        });
        
        tab.appendChild(element);
    });

    tab.appendChild(add_button);
    core.mirrors = mirror_data;
};

export const initialize_config = async () => {

    set_loading_status("checking config...");

    const config_data = await get_all_from_database("config");

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

    // get the access_token
    if (core.config.get("osu_id") && core.config.get("osu_secret")) {
        core.login = await osu_login(core.config.get("osu_id"), core.config.get("osu_secret"));
    }

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

        const label_element = create_element(`
            <label for="${option.text}">
                ${text}
                ${tooltips_text[option.text] ? `<div class="tooltip" id="${option.text}">(?)</div>` : ""}
            </label>
        `);

        const input_element = create_element(`
            <input 
                class="${is_file ? "config_input" : "file_input"}" 
                type="${is_file ? "text" : option.type}" 
                name="${option.text}" id="${option.text}" 
                ${is_checkbox && value ? `checked` : `value=${value}`} 
                ${is_file ? "readonly" : ""}
            >
        `);

        const option_container = create_element(`
            <div class="config-option ${is_checkbox ? "row": ""}" id="config_fields"></div>
        `);

        if (is_checkbox) {
            option_container.appendChild(input_element);
            option_container.appendChild(label_element);
        } else {
            option_container.appendChild(label_element);
            option_container.appendChild(input_element);
        }

        const input = option_container.querySelector("input");    

        if (is_file) {

            input.addEventListener("click", async () => {

                const options = { title: text, properties: ["openDirectory"] };

                // @TOFIX: this only works on windows...
                if (value != "") {
                    options.defaultPath = value;
                }

                const dialog = await create_dialog(options);

                if (!dialog.canceled) {
                    console.log("[config] saving file:", dialog.filePaths[0]);
                    await save_config(option.text, dialog.filePaths[0]);
                    input.value = dialog.filePaths[0];
                }
            });
        }

        if (is_checkbox) {

            input.addEventListener("click", () => {
                if (option?.callback) {
                    option.callback(input, option.text);
                } else {
                    save_config(option.text, input.checked);
                }
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
            type: message_types.CUSTOM_MENU,
            title: "mirror info",
            elements: [
                { key: "name", element: { input: "mirror name" } },
                { key: "url", element: { input: "mirror url" } },
            ],
        });

        if (!prompt.name || !prompt.url) {
            create_alert("invalid mirror", { type: "error" });
            return;
        }
        if (core.mirrors.get(prompt.name)) {
            create_alert("mirror already exists", { type: "alert" });
            return;
        }

        await save_to_db("mirrors", prompt.name, prompt.url);
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
