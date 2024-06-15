
const fs = require("fs");
const path = require("path");

const Dlabels = [];

import { add_alert } from "../../popup/alert.js";
import { files } from "../collector.js";
import { check_login } from "./login.js";

export const config = new Map();
export const og_path = path.resolve(process.env.APPDATA, "..", "Local", "osu_stuff");

export let login = null;

const tooltips = {
    "osu_id": "Your Oauth app id.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and get paste the id</a>",
    "osu_secret": "Your Oauth app Secret.<br>Create a new OAuth Application <a class='tooltp' href='https://osu.ppy.sh/home/account/edit#new-oauth-application'>here</a> and get paste the Client secret</a>",
    "osu_path": "Path to your osu! folder.<br>For example: C:\\osu!",
    "osu_songs_path": "Path to your osu! songs folder.<br>For example: C:\\osu\\Songs\\",
}

export const add_config_shit = async () => {

    // TODO: rewrite this horrendous code

    const config_path = path.resolve(process.env.APPDATA, "..", "Local", "osu_stuff", "config.json");
    
    if (!fs.existsSync(og_path)) {
        console.log(og_path);
        fs.mkdirSync(og_path);
    }

    const options = fs.existsSync(config_path) ? JSON.parse(fs.readFileSync(config_path, "utf-8")) : { osu_id: "", osu_secret: "", osu_path: "", osu_songs_path: "" };

    if (!fs.existsSync(config_path)) {
        fs.writeFileSync(config_path, JSON.stringify(options));
    }

    if (options.osu_id && options.osu_secret) {
        try {
            login = await check_login(options.osu_id, options.osu_secret);
            if (login == null) {
                add_alert("invalid osu_id / secret");
            }
        } catch(e) {
            console.log(e);
            add_alert("invalid osu_id / secret");
        }   
    }

    const config_tab = document.createElement("div");
    const h1 = document.createElement("h1");

    h1.innerText = "Config";

    config_tab.classList.add("tab-shit");
    document.getElementById("config_tab").appendChild(h1);
    
    const labels = ["osu_id", "osu_secret", "osu_path", "osu_songs_path"];

    const osu = path.resolve(process.env.APPDATA, "..", "Local", "osu!");
    const songs = path.resolve(process.env.APPDATA, "..", "Local", "osu!", "Songs");

    const osu_path = fs.existsSync(osu)
    const songs_path = fs.existsSync(songs);
                                                            
    if (!osu_path && !options.osu_path) {
        add_alert("failed to get osu_path automatically");
    }

    if (osu_path && !options.osu_path) { 
        options.osu_path = osu 
    }

    if (!songs_path && !options.osu_songs_path) {
        add_alert("failed to get osu_songs_path automatically");
    }

    if (songs_path && !options.osu_songs_path) { 
        options.osu_songs_path = songs
    }

    for (let i = 0; i < labels.length; i++) {
        
        const label_name = labels[i];

        if (options[label_name]) {
            config.set(label_name, options[label_name]);
        }

        const label = document.createElement("label");
        label.setAttribute("for", label_name);
        label.innerText = label_name;

        const input = document.createElement("input");
        input.setAttribute("name", label_name);

        const toolbox = document.createElement("div");
        
        toolbox.classList.add("tooltip");
        toolbox.id = label_name;
        toolbox.innerText = "(?)";

        label.appendChild(toolbox);

        input.type = label_name == "osu_id" || label_name == "osu_secret" ? "password" : "text";
        input.value = options[label_name];

        Dlabels.push({ label: label, input: input });

        config_tab.appendChild(label);
        config_tab.appendChild(input);
    }

    const update_btn = document.createElement("button");
    update_btn.classList.add("update_config");
    update_btn.innerText = "update";

    config_tab.appendChild(update_btn);

    update_btn.addEventListener("click", async () => {

        for (let i = 0; i < Dlabels.length; i++) {

            const input_value = Dlabels[i].input.value;
            const label_name = Dlabels[i].label.innerText;
            
            if (input_value == "") {
                add_alert("Missing value for " + label_name);
                return; 
            }

            config.set(label_name, input_value);
            options[label_name] = input_value;
        }

        // check if the login shit is valid
        login = await check_login(options.osu_id, options.osu_secret);

        if (login == null) {
            add_alert("invalid osu_id / secret");
            return;
        }

        if (config.get("osu_path") && config.get("osu_songs_path")) {

            const osu_file = fs.readFileSync(path.resolve(config.get("osu_path"), "osu!.db"));
            const collection_file = fs.readFileSync(path.resolve(config.get("osu_path"), "collection.db"));

            if (!osu_file || !collection_file) {
                add_alert("Failed to get osu.db/collections.db file\nMake sure the osu path is correct");
                return;
            }
    
            files.set("osu", osu_file);
            files.set("collection", collection_file);         
        } 
        else {
            add_alert("Failed to get osu directory\nMake sure the path is correct");
        }

        fs.writeFileSync(config_path, JSON.stringify(options, null, 4));

        add_alert("config updated");
    });

    // get files
    if (options.osu_path && options.osu_songs_path) {

        const osu_file = fs.readFileSync(path.resolve(options.osu_path, "osu!.db"));
        const collection_file = fs.readFileSync(path.resolve(options.osu_path, "collection.db"));

        if (!osu_file || !collection_file) {
            add_alert("Failed to get osu.db/collections.db file\nMake sure the osu path is correct");
            return;
        }

        files.set("osu", osu_file);
        files.set("collection", collection_file);
    }

    document.getElementById("config_tab").appendChild(config_tab);

    const all_tooltips = document.querySelectorAll(".tooltip");
    
    for (let i = 0; i < all_tooltips.length; i++) {
        all_tooltips[i].addEventListener("click", (e) => {
            const text = tooltips[e.target.id];
            add_alert(text, true);
        });
    }
};