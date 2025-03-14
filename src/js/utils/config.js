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
    files: new Map(),
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
    osu_songs_path: "songs path"
};

const update_config = async (key, value) => {
    const success = await save_to_db("config", key, value);
    if (!success) {
        console.error("failed to save config");
    }
    core.config.set(key, value);
};

export const create_element = (data) => {
    return new DOMParser().parseFromString(data, "text/html").body.firstElementChild;
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

const test_folder_permissions = async (folder) => {

    console.log("verifying folder access", folder);

    try {
        
        const test_file = path.join(folder, `test-${Date.now()}.tmp`);
        const test_file2 = path.join(folder, "renamed-test.tmp");

        // make sure everything works
        fs.writeFileSync(test_file, 'test');
        fs.readFileSync(test_file);
        fs.renameSync(test_file, test_file2);
        fs.unlinkSync(test_file2);

        // also try to modify a already existing file
        const file_test = fs.readdirSync(folder)[0];

        if (!file_test) {
            return true;
        }

        // check if it's a directory or a file
        const file_path = path.join(folder, file_test);
        const stats = fs.statSync(file_path);

        if ((stats.mode & 0o170000) === 0o040000) {
            const temp_dir_name = path.join(folder, "stufttest0101");
            fs.renameSync(file_path, temp_dir_name);
            fs.renameSync(temp_dir_name, file_path);
        } else {
            const temp_file_name = path.join(folder, test_file2);
            fs.renameSync(file_path, temp_file_name);
            fs.renameSync(temp_file_name, file_path);
        }
        return true;
    } catch (err) {
        console.log("folder perm error:", err);
        return false;
    }
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

    // check if both paths exists
    if (!fs.existsSync(osu_path) || !fs.existsSync(osu_songs)) {
        create_alert("failed to get osu/songs directory\nPlease make sure the directory is correct", { type: "error" });   
        return;
    }

    // check if the app has permission to read and write files
    const osu_perms = test_folder_permissions(osu_path);
    const songs_perms = test_folder_permissions(osu_songs);

    if (!osu_perms || !songs_perms) {
        create_alert("failed to read osufolder\nmake sure you have permission on the drive before using osu-stuff", { type: "error" })
        core.perm = false;
    }

    await get_files(osu_path);
    create_alert("config updated!", { type: "success" });
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

const default_mirrors = [
    { name: "nerynian", url: "https://api.nerinyan.moe/d/" },
    { name: "direct", url: "https://osu.direct/api/d/" },
    // { name: "catboy", url: "https://catboy.best/d/" },
];

const handle_mirrors = async (tab, mirror_add_btn) => {

    tab.innerHTML = "<h1>mirrors list</h1>";

    const mirror_data = await get_all_from_database("mirrors");

    if (mirror_data.size == 0) {
        for (let i = 0; i < default_mirrors.length; i++) {
            await save_to_db("mirrors", default_mirrors[i].name, default_mirrors[i].url);
            mirror_data.set(default_mirrors[i].name, default_mirrors[i].url);
        }
    }

    mirror_data.forEach((v, k) => {
        const element = create_element(`
            <div class="mirror-box">
                <div class="mirror-info">
                    <h1>${k}</h1>
                    <p>${v}</p>
                </div>
                <i class="bi bi-trash-fill" id="remove_mirror"></i>
            </div>`
        );
        const remove_btn = element.querySelector("#remove_mirror");
        remove_btn.addEventListener("click", async () => {
            await delete_from_db("mirrors", k);
            await handle_mirrors(tab, mirror_add_btn);
        });
        tab.appendChild(element);
    });

    tab.appendChild(mirror_add_btn);
    core.mirrors = mirror_data;
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

    const osu_base_path = await window.electron.osu_default_path();
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

        const container_element = create_element(`
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
                    await update_config(option.name, dialog.filePaths[0]);
                    option.value = dialog.filePaths[0];
                }
            });
        }

        label_content.push(container_element);
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

    // append config fields before the check button
    const check_button = config_tab.querySelector(".config-fields > .button-container");
    const mirror_tab = config_tab.querySelector(".mirror-list");

    const mirror_add_btn = create_element(`
        <button class="mirror-remove-container">add</button>
    `);

    // create mirrors list
    await handle_mirrors(mirror_tab, mirror_add_btn);

    mirror_add_btn.addEventListener("click", async () => {

        if (!core.mirrors.size >= 4) {
            create_alert("no more than 4 mirrors my guy", { type: "alert" });
            return;
        }

        const prompt = await create_custom_popup({
            type: message_types.CUSTOM_MENU,
            title: "mirror info",
            elements: [
                {
                    key: "name",
                    element: { input: "mirror name" }
                },
                {
                    key: "url",
                    element: { input: "mirror url" }
                },
            ]
        });

        if (!prompt.name || !prompt.url) {
            create_alert("invalid mirror", { type: "error" });
            return;
        }

        if (core.mirrors.get(prompt.name)) {
            create_alert("theres already a mirror with this name", { type: "alert" });
            return;
        }

        await save_to_db("mirrors", prompt.name, prompt.url);
        await handle_mirrors(mirror_tab, mirror_add_btn);
    });

    mirror_tab.appendChild(mirror_add_btn);
    
    label_content.forEach(e => { check_button.insertAdjacentElement("beforebegin", e) });
    check_button.addEventListener("click", handle_config_check);

    setup_tooltip();

    if (!empty_config) {
        create_alert("config not found<br>can you take a look at config tab pleease :)", { html: true });
        return;
    }

    if (!fs.existsSync(core.config.get("osu_path"))) {
        create_alert("failed to get osu path!", { type: "alert" });
        return;
    }

    if (!fs.existsSync(core.config.get("osu_songs_path"))) {
        create_alert("failed to get osu songs path!", { type: "alert" });
        return;
    }

    // check if the app has permission to read and write files
    const osu_perms = test_folder_permissions(core.config.get("osu_path"));
    const songs_perms = test_folder_permissions(core.config.get("osu_songs_path"));

    if (!osu_perms || !songs_perms) {
        create_alert("failed to read osufolder\nmake sure you have permission on the drive before using osu-stuff", { type: "error" })
        core.perm = false;
    }

    await get_files(core.config.get("osu_path"));
    await initialize();
};
