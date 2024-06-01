const fs = require("fs");
const path = require("path");

const { auth } = require("osu-api-extended");

const all_tabs = [...document.querySelectorAll(".tab-button")];
const all_content = [...document.querySelectorAll(".tab-pane")];
const Dlabels = [];

import { events } from "./tasks/events.js";
import { add_alert } from "./popup/alert.js";
import { files } from "./stuff/collector.js";

export const config = new Map();
export let login = null;
export const current_tasks = new Map();

export const check_login = async (id, secret) => {

    try {  

        const auth_login = await auth.login(id, secret, ['public']);

        if (auth_login.access_token) { 
            return auth_login;  
        }

        add_alert("Invalid osu_id / osu_secret!");

        return null;

    } catch (err) {
        console.log(err);
        add_alert("Invalid osu_id / osu_secret!");
        return null;
    }
};

const add_config_shit = async () => {

    const config_path = path.resolve(process.env.APPDATA, "..", "Local", "osu_stuff", "config.json");
    const og_path = path.resolve(process.env.APPDATA, "..", "Local", "osu_stuff");
    
    if (!fs.existsSync(og_path)) {
        console.log(og_path);
        fs.mkdirSync(og_path);
    }

    const options = fs.existsSync(config_path) ? JSON.parse(fs.readFileSync(config_path, "utf-8")) : { osu_id: "", osu_secret: "", osu_path: "", osu_songs_path: "" };

    if (!fs.existsSync(config_path)) {
        fs.writeFileSync(config_path, JSON.stringify(options));
    }

    if (options.osu_id && options.osu_secret) {

        login = await check_login(options.osu_id, options.osu_secret);

        if (login == null) {
            add_alert("invalid osu_id / secret");
        }
    }

    const config_tab = document.createElement("div");
    const h1 = document.createElement("h1");

    h1.innerText = "Config";

    config_tab.classList.add("tab-shit");
    document.getElementById("config_tab").appendChild(h1);
    
    const labels = ["osu_id", "osu_secret", "osu_path", "osu_songs_path"];

    // try to get osu path automatically

    const osu = path.resolve(process.env.APPDATA, "..", "Local", "osu!");
    const songs = path.resolve(process.env.APPDATA, "..", "Local", "osu!", "Songs");

    const osu_path = fs.existsSync(osu)
    const songs_path = fs.existsSync(songs);
                                                                
    console.log(osu_path, songs_path, osu, songs);

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
            return;
        }

        if (config.get("osu_path") && config.get("osu_songs_path")) {

            const osu_file = fs.readFileSync(path.resolve(config.get("osu_path"), "osu!.db"));
            const collection_file = fs.readFileSync(path.resolve(config.get("osu_path"), "collection.db"));

            if (!osu_file || !collection_file) {
                add_alert("Failed to get osu.db/collections.db file\nMake sure the osu path is correct");
                return;
            }
    
            if (!files.get("osu")) {
                files.set("osu", osu_file);
            }

            if (!files.get("collection")) {
                files.set("collection", collection_file);
            }
                
        } 
        else {
            add_alert("Failed to get osu directory\nMake sure the path is correct");
        }

        fs.writeFileSync(config_path, JSON.stringify(options, null, 4));
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
};

add_config_shit();

all_tabs.map((tab, i) => {
    
    tab.addEventListener("click", (e) => {
        
        const user_is_stupid = tab.className == "active";

        if (user_is_stupid) {
            return;
        }

        all_tabs.forEach((t) => { t.classList.remove("active") });
        all_content.forEach((t) => { t.classList.remove("active") });

        tab.classList.add("active");
        all_content[i].classList.add("active");
    });
});

export const add_task = (data, type) => {

    const id = data.id;

    if (!id) {
        add_alert("Missing id");
        return;
    }

    if (current_tasks.has(id)) {
        add_alert("theres already a download for this task");
        return;
    }
    
    const tab = document.createElement("div");
    const h1 = document.createElement("h1");
    const h2 = document.createElement("h2");
    const bar = document.createElement("div");

    tab.classList.add("tab-shit");
    tab.classList.add("download-shit");

    tab.id = id;
    bar.style = "height: 1.5em; background-color: rgb(50, 120, 200); width: 0%; max-width: 100%;";

    h1.innerText = id;
    h2.innerText = "waiting to start";

    tab.appendChild(h1);
    tab.appendChild(h2);
    tab.appendChild(bar);

    const dtab = document.getElementById("download_tab");

    current_tasks.set(id, { started: false, tab: dtab, Fdiv: tab, bar: bar, text: h2 });

    // TODO: enable progress stuff when the task actually start.
    dtab.appendChild(tab);

    events.emit("task-start", { id: id, type: type, ...data});
};