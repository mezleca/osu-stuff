const shell = require("electron").shell;

import { events } from "../tasks/events.js";

const alerts = new Map();
const max_popup_size = 6, padding = 5;

let popup_height = document.querySelector(".taskbar").getBoundingClientRect().height + padding;

const change_alert_opacity = (div, value) => {
    div.style.opacity = value / 255;
};

export const add_alert = async (...texts) => {

    const options = {
        type: "default",
        append_html: false,
        test: false,
        color: "rgb(36, 153, 242)",
        border: "2px solid rgb(0, 103, 181)",
        text: "",
        seconds: 3  
    };

    for (let i = 0; i < texts.length; i++) {

        if (typeof texts[i] == "object") {
            options.type = texts[i].type || "default";
            options.append_html = texts[i].append_html || false;
            options.test = texts[i].test || false;
            options.seconds = texts[i].seconds || 3;
            continue;
        }

        if (typeof texts[i] == "string" || typeof texts[i] == "number") {
            options.text += texts[i] + " "; 
        }
    }

    if (alerts.size > max_popup_size) {
        console.log("Too many popups");
        return;
    }

    const id = Date.now();

    const div = document.createElement("div");

    const alert_icon = document.createElement("i");
    const alert_text = document.createElement("h2");
    const alert_close = document.createElement("i");

    div.classList.add("alert-popup");

    div.id = id;
    div.style = `top: ${popup_height}px`;

    switch (options.type) {
        case "error":

            alert_icon.classList.add("bi");
            alert_icon.classList.add("bi-x-circle-fill");

            options.color = "rgb(242, 36, 36)";
            options.border = "2px solid rgb(181, 0, 0)";

            break;
        case "success":

            alert_icon.classList.add("bi");
            alert_icon.classList.add("bi-check-circle-fill");

            options.color = "rgb(36, 153, 242)";
            options.border = "2px solid rgb(0, 103, 181)";

            break;
        case "warning":
            
            alert_icon.classList.add("bi");
            alert_icon.classList.add("bi-exclamation-triangle-fill");

            options.color = "rgb(227, 227, 79)";
            options.border = "2px solid rgb(255, 255, 31)";

            break;
        case "info":

            break;
        case "default":
            alert_icon.classList.add("bi");
            alert_icon.classList.add("bi-exclamation-circle");
            break;
        default:
            alert_icon.classList.add("bi");
            alert_icon.classList.add("bi-exclamation-circle");
            break;
    }

    div.style.backgroundColor = options.color;
    div.style.border = options.border;

    alert_icon.classList.add("alert-icon");

    alert_close.classList.add("bi");
    alert_close.classList.add("bi-x");
    alert_close.classList.add("alert-close");

    if (options.append_html) {
        alert_text.innerHTML = options.text;
    } else {
        alert_text.innerText = options.text;
    }
        
    div.appendChild(alert_icon);
    div.appendChild(alert_text);
    div.appendChild(alert_close);

    alerts.set(id, div);
    
    document.querySelector(".container").appendChild(div);

    popup_height += div.offsetHeight + padding;

    let deleted = false;

    alert_close.addEventListener("click", () => { 
        remove_alert(div, id);
        deleted = true;
    });

    if (options.append_html) {
        const all = div.querySelectorAll('a[href^="http"]');

        for (let i = 0; i < all.length; i++) {
            all[i].addEventListener("click", (e) => {
                e.preventDefault();
                shell.openExternal(e.target.href)       
            });
        }
    }

    if (options.test) {
        return;
    }

    // sleep 2 seconds before the fading animation
    await new Promise(resolve => setTimeout(resolve, options.seconds * 1000));

    let opacity = 255;

    const interval = setInterval(() => {

        if (deleted) {
            clearInterval(interval);
        }
        
        change_alert_opacity(div, opacity);

        opacity -= 2;

        if (opacity <= 0) {
            clearInterval(interval);
            remove_alert(div, id);
        }

    }, 10);
};

export const remove_alert = (div, id) => {
    
    if (!id || !div) {
        console.log("Invalid id/div", id, div);
        return;
    }

    popup_height -= div.offsetHeight + padding;

    alerts.delete(id);

    document.querySelector(".container").removeChild(div);
};

export const add_get_extra_info = (infoArray) => {

    return new Promise((resolve, reject) => {

        if (!Array.isArray(infoArray)) {
            reject("Invalid input: infoArray should be an array");
            return;
        }

        infoArray.forEach(info => {

            const important  = info?.important ? info.important : false,
                  column     = info?.column ? info.column : false,
                  input_type = info?.input_type ? info.input_type : false,
                  title      = info?.title ? info.title : false;

            if (info.type === 'confirmation' && info.text) {
                createConfirmationPopup(info.text, resolve, important);
            } 
            else if (info.type === 'list' && Array.isArray(info.value)) {
                createListPopup(info.value, resolve, important, column, title);
            } 
            else if (info.type == "input" && info.text) {
                createInputPopup(info.text, resolve, important, input_type);
            }
            else if (info.type == "file" && info.text) {
                createFilePopup(info.text, resolve, important);
            }
            else {
                console.log(infoArray);
                reject("Invalid object in array");
            }
        });
    });
};

const createConfirmationPopup = (text, resolve, important) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = text;
    content.appendChild(header);

    const yesButton = document.createElement("button");
    yesButton.innerText = "Yes";

    yesButton.addEventListener("click", () => {
        resolve("Yes");
        document.body.removeChild(div);
    });

    const noButton = document.createElement("button");
    noButton.innerText = "No";

    noButton.addEventListener("click", () => {
        resolve("No");
        document.body.removeChild(div);
    });

    content.appendChild(yesButton);
    content.appendChild(noButton);

    div.appendChild(content);

    document.body.appendChild(div);

    if (!important) {
        div.addEventListener("click", (event) => {
            if (event.target === div) {
                document.body.removeChild(div);
                resolve(null);
            }
        });
    }
};

const createInputPopup = (text, resolve, important, type) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = text;
    content.appendChild(header);

    const input = document.createElement("input");
    input.type = type ? type : "text";
    content.appendChild(input);

    const submitButton = document.createElement("button");
    submitButton.innerText = "Submit";
    submitButton.addEventListener("click", () => {

        if (!input.value) {
            alert("Please enter a value");
            return;
        }

        resolve(input.value);
        document.body.removeChild(div);   
    });

    content.appendChild(submitButton);
    div.appendChild(content);
    document.body.appendChild(div);

    if (important) {
        return;
    }

    div.addEventListener("click", (event) => {
        if (event.target === div) {
            document.body.removeChild(div);
            resolve(null);
        }
    });
};

const createFilePopup = (text, resolve, important) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = text;
    content.appendChild(header);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept =".json";
    content.appendChild(fileInput);

    const submitButton = document.createElement("button");
    submitButton.innerText = "Submit";
    submitButton.addEventListener("click", () => {
        if (fileInput.files.length > 0) {
            resolve(fileInput.files[0]);
            document.body.removeChild(div);
        } else {
            alert("Please select a file");
        }
    });

    content.appendChild(submitButton);
    div.appendChild(content);
    document.body.appendChild(div);

    if (important) {
        return;
    }

    div.addEventListener("click", (event) => {
        if (event.target === div) {
            document.body.removeChild(div);
            resolve(null);
        }
    });
};

const createListPopup = (values, resolve, important, column, title) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    if (column) {
        content.classList.add("popup-content-flex");
    }

    const header = document.createElement("h1");
    header.innerText = title ? title : "Select an option:";
    content.appendChild(header);

    values.forEach(value => {
        const button = document.createElement("button");
        button.innerText = value;
        button.addEventListener("click", () => {
            resolve(value);
            document.body.removeChild(div);
        });
        content.appendChild(button);
    });

    div.appendChild(content);
    document.body.appendChild(div);

    if (!important) {
        div.addEventListener("click", (event) => {
            if (event.target === div) {
                document.body.removeChild(div);
                resolve(null);
            }
        });
    }
};

export const createCustomList = (status, id) => {

    return new Promise((resolve, reject) => {

        const html = 
        `
            <div class="popup-container">
                <div class="popup-content-flex" style="flex-direction: column;">
                    <h1>Options</h1>
                    <div class="input-double-balls" style="display: none;">
                        <div class="slider-thing"></div>
                        <input type="range" name="ball0" id="min_sr" min="0" max="30" value="0">
                        <input type="range" name="ball1" id="max_sr" min="0" max="30" value="10">
                        <p class="slider1">min: 0</p>
                        <p class="slider2">max: 10</p>
                    </div>
                    <label for="status">Status</label>
                    <select name="status" id="status">
                        ${status.map(status => `<option value="${status}">${status}</option>`)}
                    </select>
                    <div style="display: flex; width: 100%; align-items: center; flex-direction: column; justify-content: center; margin: 0;">
                        <div class="checkbox-container">
                            <input type="checkbox" id="piru" name="piru"></input>
                            <label for="piru" style="margin: 0; margin-left: 2px;">Enable star rating check</label>
                        </div>    

                        <div class="checkbox-container">
                            <input type="checkbox" id="exclude_collections" name="exclude_collections"></input>
                            <label for="exclude_collections">Ignore Beatmaps from Collections</label>
                        </div>  

                    </div>
                    <button id="custom_list_submit">Submit</button>
                </div>
            </div>
        `;

        document.querySelector(".container").insertAdjacentHTML("beforebegin", html);

        const min_sr = document.getElementById('min_sr');
        const max_sr = document.getElementById('max_sr');

        const slider1 = document.querySelector('.slider1');
        const slider2 = document.querySelector('.slider2');

        slider1.innerText = `min: ${min_sr.value}`;
        slider2.innerText = `max: ${max_sr.value}`;

        const enable_sr = document.getElementById('piru');
        
        let sr_enabled = false;

        enable_sr.addEventListener('change', () => {

            sr_enabled = enable_sr.checked;

            if (enable_sr.checked) {
                document.querySelector(".input-double-balls").style.display = "flex";
            } else {
                document.querySelector(".input-double-balls").style.display = "none";
            }
        });

        min_sr.addEventListener('input', () => {

            if (parseInt(min_sr.value) > parseInt(max_sr.value)) {
                min_sr.value = max_sr.value;
            }

            slider1.innerText = `min: ${min_sr.value}`;
        });

        max_sr.addEventListener('input', () => {

            if (parseInt(max_sr.value) < parseInt(min_sr.value)) {
                max_sr.value = min_sr.value;
            }

            slider2.innerText = `max: ${max_sr.value}`;
        });

        document.getElementById("custom_list_submit").addEventListener("click", () => {

            const div = document.querySelector(".popup-container");

            const status = document.getElementById("status").value;
            const exclude_collections = document.getElementById("exclude_collections").checked;

            if (min_sr.value == "0" && max_sr.value == "0") {
                add_alert("min sr and max sr cannot be both 0", { type: "warning" });
                return;
            }

            resolve({ min_sr: parseInt(min_sr.value), max_sr: parseInt(max_sr.value), status, exclude_collections, sr_enabled });
            document.body.removeChild(div);
        });

        const div = document.querySelector(".popup-container");
        div.addEventListener("click", (event) => {
            if (event.target === div) {
                document.body.removeChild(div);
                events.emit("progress-end", id);
                reject("Cancelled");
            }
        });
    });
};