
const fs = require("fs");
const path = require("path");

import { OsuReader } from "../../../reader/reader.js";
import { add_alert } from "../../../popup/alert.js";
import { check_login } from "../other/login.js";
import { initialize } from "../../../manager/manager.js";

export const config  = new Map();
export const reader  = new OsuReader();
export const files   = new Map();
export const og_path = path.resolve(process.env.APPDATA, "..", "Local", "osu_stuff");
export let login     = null;

const tooltips = {
    "osu_id": "Your OAuth app ID.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the ID below</a>",
    "osu_secret": "Your Oauth app Secret.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the client secret below</a>",
    "osu_path": "Your osu! folder.<br>For example: C:\\osu!",
    "osu_songs_path": "Your osu! songs folder.<br>For example: C:\\osu!\\Songs\\",
}

export const setup_tooltip = () => {

    const all_tooltips = document.querySelectorAll(".tooltip");
    
    for (let i = 0; i < all_tooltips.length; i++) {
        all_tooltips[i].addEventListener("click", (e) => {
            const text = tooltips[e.target.id];
            add_alert(text, true, { append_html: true, seconds: 5 });
        });
    }
}

export const osu_login = async (id, secret) => {

    const auth_login = await check_login(id, secret);

    if (!auth_login || !auth_login.access_token) {
        add_alert("Failed to login", { type: "error" });
        console.log("Failed to login");
        return null;
    }

    login = auth_login;

    return auth_login;
}

export const update_status = (status) => {

    const status_div = document.querySelector(".loading-status");

    if (!status_div) {
        return;
    }

    status_div.innerText = status;
}

export const get_files = async (osu) => {

    console.log("Getting files");

    const osu_file = fs.readFileSync(path.resolve(osu, "osu!.db"));
    const collection_file = fs.readFileSync(path.resolve(osu, "collection.db"));

    if (!osu_file || !collection_file) {
        add_alert("Failed to get osu.db/collections.db file\nMake sure the osu path is correct", { type: "error" });
        return;
    }
    
    reader.osu = {};
    reader.collections = {};

    update_status("Reading collection file...");

    files.set("osu", osu_file);
    files.set("collection", collection_file);
    
    reader.set_type("collection");
    reader.set_buffer(collection_file, true);
    await reader.get_collections_data();

    update_status("Reading osu.db file...");

    reader.set_type("osu")
    reader.set_buffer(osu_file, true);
    await reader.get_osu_data();

    // update manager
    await initialize();
}

export const add_config_shit = async () => {

    update_status("Checking config...");

    const config_path = path.resolve(og_path, "config.json");

    if (!fs.existsSync(og_path)) {
        fs.mkdirSync(og_path);
    }

    const options = fs.existsSync(config_path) ? JSON.parse(fs.readFileSync(config_path, "utf-8")) : { osu_id: "", osu_secret: "", osu_path: "", osu_songs_path: "" };
    const can_login = Boolean(options.osu_id && options.osu_secret);

    if (!fs.existsSync(config_path)) {
        fs.writeFileSync(config_path, JSON.stringify(options));
    }

    if (can_login) {
        await osu_login(options.osu_id, options.osu_secret);   
    }

    const osu = path.resolve(process.env.APPDATA, "..", "Local", "osu!");
    const songs = path.resolve(process.env.APPDATA, "..", "Local", "osu!", "Songs");

    const osu_exist = fs.existsSync(osu)
    const songs_exist = fs.existsSync(songs);

    options.osu_path = osu_exist ? osu : null;
    options.songs_path = songs_exist ? songs : null;
                                                            
    if (!options.osu_path || !options.songs_path) {
        add_alert("failed to get the osu directory automatically", { type: "error" });
    }

    const labels = ["osu_id", "osu_secret", "osu_path", "osu_songs_path"];
    const label_content = [];

    for (let i = 0; i < labels.length; i++) {
        
        const label_name = labels[i];

        config.set(label_name, options[label_name]);

        label_content.push(
            `
            <div class="input-container" id="config_fields">
                <label for="${label_name}">
                    ${label_name}
                    <div class="tooltip" id="${label_name}">(?)</div>
                </label>
                <input type="${label_name == "osu_id" || label_name == "osu_secret" ? "password" : "text"}" name="${label_name}" id="${label_name}" value="${options[label_name]}">        
            </div>
            `
        )
    }

    const html = 
    `
    <div class="tab-shit">
        <h1>Config</h1>
        ${label_content.join("")}
        <button class="update_config">update</button>
    </div>
    `

    document.getElementById("config_tab").insertAdjacentHTML("afterbegin", html);

    // make sure both paths exist
    if (!fs.existsSync(options.osu_path) || !fs.existsSync(options.songs_path)) {
        console.log("Failed to get osu/songs directory\nPlease make sure the directory is correct");
        add_alert("Failed to get osu/songs directory\nPlease make sure the directory is correct", { type: "error" });       
        return;
    }

    await get_files(options.osu_path);

    document.querySelector(".update_config").addEventListener("click", async () => {

        const config_fields = document.querySelectorAll("#config_fields");

        config_fields.forEach((field) => {
            
            const fields = Array.from(field.children);

            const input_value = fields[1].value;
            const label_name = fields[1].id;
            
            if (input_value == "") {
                add_alert("Missing value for " + label_name, { type: "error" });
                return; 
            }

            config.set(label_name, input_value);
            options[label_name] = input_value;
        });

        const login = await osu_login(options.osu_id, options.osu_secret);
        
        if (!login) {
            add_alert("Failed to login", { type: "error" });
            return;
        }

        // make sure both paths exist
        if (!fs.existsSync(options.osu_path) || !fs.existsSync(options.osu_songs_path)) {
            add_alert("Failed to get osu/songs directory\nPlease make sure the directory is correct", { type: "error" });       
            return;
        }

        await get_files(config.get("osu_path"));

        fs.writeFileSync(config_path, JSON.stringify(options, null, 4));

        add_alert("config updated", { type: "success" });
    });

    setup_tooltip();

    console.log("config loaded");
};