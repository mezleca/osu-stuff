
const fs = require("fs");
const path = require("path");

import { OsuReader } from "../reader/reader.js";
import { add_alert } from "../popup/popup.js";
import { check_login } from "./other/login.js";
import { initialize } from "../manager/manager.js";
import { all_tabs, blink } from "../tabs.js";

export const core = {
    config: new Map(),
    reader: new OsuReader(),
    files: new Map(),
    og_path: path.resolve(process.env.APPDATA, "..", "Local", "osu_stuff"),
    login: null
};

const tooltips = {
    "osu_id": "Your OAuth app ID.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the ID below</a>",
    "osu_secret": "Your Oauth app Secret.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and paste the client secret below</a>"
}

const config_path = path.resolve(core.og_path, "config.json");
const labels = ["osu_id", "osu_secret", "osu_path", "osu_songs_path"];

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

    core.login = auth_login;

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

    const db_file = path.resolve(osu, "osu!.db");
    const cl_file = path.resolve(osu, "collection.db");

    // check if osu.db is missing
    if (!fs.existsSync(db_file)) {
        console.log("osu.db file not found");
        return;
    }

    // if collections.db is missing just create a new file
    // yeah im gonna create write then clean the collections obj and read again cuz why not
    if (!fs.existsSync(cl_file)) {

        core.reader.collections  = {
            version: 20240820, 
            length: 0, 
            beatmaps: []
        };
        
        const file_path = path.resolve(osu, "collection.db");
        await core.reader.write_collections_data(file_path);

        console.log("created a new collections.db file in", file_path);
    }

    const osu_file = fs.readFileSync(path.resolve(osu, "osu!.db"));
    const collection_file = fs.readFileSync(path.resolve(osu, "collection.db"));

    if (!osu_file || !collection_file) {
        add_alert("failed to get osu.db/collections.db file\nMake sure the osu path is correct", { type: "error" });
        return;
    }
    
    core.reader.buffer = null;
    core.reader.osu = {};
    core.reader.collections = {};

    update_status("reading collection file...");

    core.files.set("osu", osu_file);
    core.files.set("collection", collection_file);
    
    core.reader.set_type("collection");
    core.reader.set_buffer(collection_file, true);
    await core.reader.get_collections_data();

    update_status("reading osu.db file...");

    core.reader.set_type("osu")
    core.reader.set_buffer(osu_file, true);
    await core.reader.get_osu_data();
}

const handle_config_update = async (options) => {

    const config_fields = document.querySelectorAll("#config_fields");

    config_fields.forEach((field) => {
        
        const fields = Array.from(field.children);

        const input_value = fields[1].value;
        const label_name = fields[1].id;
        
        if (input_value == "") {
            add_alert("Missing value for " + label_name, { type: "error" });
            return; 
        }

        core.config.set(label_name, input_value);
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

    await get_files(core.config.get("osu_path"));
    fs.writeFileSync(config_path, JSON.stringify(options, null, 4));
    add_alert("config updated", { type: "success" });
}

export const add_config_shit = async () => {

    update_status("checking config...");

    const config_tab = document.getElementById("config_tab");
    const config_menu = all_tabs[1];
    const label_content = [];

    if (!fs.existsSync(core.og_path)) {
        fs.mkdirSync(core.og_path);
    }

    let options = { osu_id: "", osu_secret: "", osu_path: "", osu_songs_path: "" };

    // if the config exist, assign it
    if (fs.existsSync(config_path)) {
        try {

            const file = fs.readFileSync(config_path, "utf-8");
            const config_obj = JSON.parse(file);

            options.osu_id = config_obj.osu_id;
            options.osu_secret = config_obj.osu_secret;
            options.osu_path = config_obj.osu_path;
            options.osu_songs_path = config_obj.osu_songs_path;

        } catch(err) {
            add_alert("failed to parse config");
        }   
    }

    // create a new config if theres no config file
    if (!fs.existsSync(config_path)) {
        fs.writeFileSync(config_path, JSON.stringify(options));
    }

    // if the config file has the id and secret parameter, try to login
    if (Boolean(options.osu_id && options.osu_secret)) {
        await osu_login(options.osu_id, options.osu_secret);   
    }

    const osu = path.resolve(process.env.APPDATA, "..", "Local", "osu!");
    const songs = path.resolve(process.env.APPDATA, "..", "Local", "osu!", "Songs");

    const osu_exist = fs.existsSync(osu)
    const songs_exist = fs.existsSync(songs);

    if (!options.osu_path && osu_exist) {
        options.osu_path = osu_exist ? osu : null;
    }

    if (!options.osu_songs_path && songs_exist) {
        options.osu_songs_path = songs_exist ? songs : null;
    }

    if (!options.osu_path || !options.osu_songs_path) {
        blink(config_menu);
    }
                                                
    for (let i = 0; i < labels.length; i++) {
        
        const label_name = labels[i];
        core.config.set(label_name, options[label_name]);

        label_content.push(
            `
            <div class="input-container" id="config_fields">
                <label for="${label_name}">
                    ${label_name}
                    ${tooltips[label_name] ? `<div class="tooltip" id="${label_name}">(?)</div>` : '' }
                </label>
                <input type="${label_name == "osu_id" || label_name == "osu_secret" ? "password" : "text"}" name="${label_name}" id="${label_name}" value="${options[label_name] || ""}">        
            </div>
            `
        );
    }

    const html = 
        `
        <div class="tab-shit">
            <h1>config</h1>
            ${label_content.join("")}
            <button class="update_config">update</button>
        </div>
        `

    config_tab.insertAdjacentHTML("afterbegin", html);
    const config_btn = document.querySelector(".update_config");

    config_btn.addEventListener("click", () => {
        handle_config_update(options);
    });

    // check if osu path is invalid
    if (!fs.existsSync(options.osu_path)) {
        add_alert("osu path is invalid!", { type: "alert" , blink: config_menu });
        return;
    }

    // another check
    if (!fs.existsSync(options.osu_songs_path)) {
        add_alert("osu songs path is invalid!", { type: "alert" , blink: config_menu });
        return;
    }

    // get osu.db / collections.db file and initialize manager
    await get_files(options.osu_path);
    console.log("updating manager");
    await initialize();

    setup_tooltip();
    console.log("config loaded");
};