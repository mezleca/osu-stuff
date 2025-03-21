import { create_custom_popup, create_alert, message_types } from "../popup/popup.js";
import { osu_login } from "./other/login.js";
import { initialize } from "../manager/manager.js";
import { all_tabs, blink } from "../tabs.js";
import { OsuReader } from "./reader/reader.js";
import { delete_from_db, get_all_from_database, save_to_db } from "./other/indexed_db.js";
import { debounce, fs, path } from "./global.js";

export const core = {
    reader: new OsuReader(),
    config: new Map(),
    mirrors: new Map(),
    og_path: window.nodeAPI.env.og_path, // app folder
    login: null, // login object that contains the access_token
    perm: true, // boolean to check on other parts if we have perm to write on osu folder 
};

const tooltips_text = {
    "osu_id": "Your OAuth app ID.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the ID below</a>",
    "osu_secret": "Your Oauth app Secret.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the client secret below</a>"
}

const config_options = {
    osu_id: "osu id",
    osu_secret: "osu secret",
    osu_path: "osu path",
    osu_songs_path: "songs path",
};

const default_mirrors = [
    { name: "nerynian", url: "https://api.nerinyan.moe/d/" },
    { name: "direct", url: "https://osu.direct/api/d/" },
];

const osu_db_file = "osu!.db";
const collection_db_file = "collection.db";

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

const initialize_tooltips = () => {
    document.querySelectorAll(".tooltip").forEach((tooltip) => {
        tooltip.addEventListener("click", () => {
            const text = tooltips_text[tooltip.id];
            create_alert(text, { html: true, seconds: 5 });
        });
    });
};

const set_loading_status = (status) => {

    const status_div = document.querySelector(".loading-status");

    if (status_div) {       
        status_div.innerText = status
    }
};

export const load_osu_files = async (osu_path) => {

    const db_file = path.resolve(osu_path, osu_db_file);
    const collection_file = path.resolve(osu_path, collection_db_file);

    if (!fs.existsSync(db_file)) {
        create_alert("failed to find osu.db file\nmake sure the osu path is valid", { type: "error" });
        return;
    }

    if (!fs.existsSync(collection_file)) {
        core.reader.collections = { version: 20240820, length: 0, beatmaps: [] };
        await core.reader.write_collections_data(collection_file);
        console.log("[Config] created a new collections.db file in", file_path);
    }

    const osu_data = fs.readFileSync(db_file);
    const collection_data = fs.readFileSync(collection_file);

    core.reader.buffer = null;
    core.reader.osu = {};
    core.reader.collections = {};

    set_loading_status("reading osu files...");

    core.reader.set_buffer(collection_data, true);
    await core.reader.get_collections_data();

    core.reader.set_buffer(osu_data, true);
    await core.reader.get_osu_data();

    core.reader.buffer = null;
};

const check_folder_permissions = async (folder) => {

    console.log("[Config] verifying folder access", folder);

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
        console.log("[Config] folder perm error:", err);
        return false;
    }
};

const initialize_osu_config = async () => {

    const osu_id = core.config.get("osu_id");
    const osu_secret = core.config.get("osu_secret");
    const osu_path = core.config.get("osu_path");
    const songs_path = core.config.get("osu_songs_path");

    if (osu_id && osu_secret) {

        core.login = await osu_login(osu_id, osu_secret);

        if (!core.login) {
            create_alert("failed to login", { type: "error" });
            return;
        }
    }

    if (!fs.existsSync(osu_path) || !fs.existsSync(songs_path)) {
        create_alert("failed to get osu/songs directory\nPlease make sure the directory is correct", { type: "error" });   
        return;
    }

    const osu_perms = await check_folder_permissions(osu_path);
    const songs_perms = await check_folder_permissions(songs_path);

    if (!osu_perms || !songs_perms) {
        create_alert("failed to read osufolder\nmake sure you have read and write perms on the drive", { type: "error" })
        core.perm = false;
    }

    await load_osu_files(osu_path);
    create_alert("config updated!", { type: "success" });
};

const validate_and_setup_config = async () => {

    let is_valid = true;

    document.querySelectorAll("#config_fields").forEach((field) => {
        const input = field.querySelector("input");

        if (!input.value) {
            create_alert(`missing value for ${input.id}`, { type: "error" });
            is_valid = false;
        }
    });

    if (is_valid) {
        await initialize_osu_config();
        await initialize();
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

    if (config_data) {
        core.config = config_data;
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

    const osu_base_path = await window.electron.osu_default_path();
    const songs_base_path = path.resolve(osu_base_path, "Songs");

    // try to get osu_path & osu_songs path
    if (!core.config.get("osu_path") && fs.existsSync(osu_base_path)) {
        await save_config("osu_path", osu_base_path);
    }

    if (!core.config.get("osu_songs_path") && fs.existsSync(songs_base_path)) {
        await save_config("osu_songs_path", songs_base_path);
    }

    // blink it!
    if (!core.config.get("osu_path") || !core.config.get("osu_songs_path")) {
        blink(config_menu);
    }

    // create and initialize config elements
    for (const [key, label] of Object.entries(config_options)) {

        const is_secret = key == "osu_id" || key == "osu_secret";
        const is_readonly = !is_secret;
        const value = core.config.get(key) || "";

        const field = create_element(`
            <div class="input-container" id="config_fields">
                <label for="${key}">
                    ${label}
                    ${tooltips_text[key] ? `<div class="tooltip" id="${key}">(?)</div>` : ""}
                </label>
                <input 
                    class="${is_readonly ? "config_input" : "file_input"}" 
                    type="${is_secret ? "password" : "text"}" 
                    name="${key}" id="${key}" 
                    value="${value}" 
                    ${is_readonly ? "readonly" : ""}>
            </div>
        `);

        const input = field.querySelector("input");

        if (is_secret) {
            input.addEventListener("input", debounce(async () => {
                if (input.value) { 
                    await save_config(key, input.value);
                }
            }, 300));
        }

        if (is_readonly) {

            input.addEventListener("click", async () => {

                const dialog = await window.electron.create_dialog();

                if (!dialog.canceled) {
                    await save_config(key, dialog.filePaths[0]);
                    input.value = dialog.filePaths[0];
                }
            });
        }

        fields.push(field);
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
    const mirror_add_button = create_element(`<button class="mirror-remove-container">Adicionar</button>`);

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

    initialize_tooltips();

    if (core.config.size == 0) {
        create_alert("config not found<br>can you take a look at config tab pleease :)");
        return;
    }

    if (!fs.existsSync(core.config.get("osu_path")) || !fs.existsSync(core.config.get("osu_songs_path"))) {
        create_alert("failed to get osu path!", { type: "alert" });
        return;
    }

    const osu_perms = await check_folder_permissions(core.config.get("osu_path"));
    const songs_perms = await check_folder_permissions(core.config.get("osu_songs_path"));

    if (!osu_perms || !songs_perms) {
        create_alert("failed to read osufolder\nmake sure you have read and write perms on the drive", { type: "error" })
        core.perm = false;
    }

    await load_osu_files(core.config.get("osu_path"));
    await initialize();
};
