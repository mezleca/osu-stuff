import { events } from "../tasks/events.js";

const alerts = new Map();
const max_popup_size = 6, padding = 5;

let popup_height = document.querySelector(".taskbar").getBoundingClientRect().height + padding;

const change_alert_opacity = (div, value) => {
    div.style.opacity = value / 255;
};

export const add_alert = async (...texts) => {

    let text = "";

    for (let i = 0; i < texts.length; i++) {
        text += texts[i] + " "; 
    }

    if (alerts.size > max_popup_size) {
        console.log("Too many popups");
        return;
    }

    const id = Date.now();

    const div = document.createElement("div");
    div.classList.add("alert-popup");
    div.id = id;
    div.style = `top: ${popup_height}px`;

    const alert_text = document.createElement("h2");
    alert_text.innerText = text;

    div.appendChild(alert_text);
    alerts.set(id, div);
    
    document.querySelector(".container").appendChild(div);

    popup_height += div.offsetHeight + padding;

    let deleted = false;

    div.addEventListener("click", () => { 
        remove_alert(div, id);
        deleted = true;
    });

    // sleep 2 seconds before the fading animation
    await new Promise(resolve => setTimeout(resolve, 2000));

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

            const important = info?.important ? info.important : false;

            if (info.type === 'confirmation' && info.text) {
                createConfirmationPopup(info.text, resolve, important);
            } 
            else if (info.type === 'list' && Array.isArray(info.value)) {
                createListPopup(info.value, resolve, important);
            } 
            else if (info.type == "input" && info.text) {
                createInputPopup(info.text, resolve, important);
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

const createInputPopup = (text, resolve, important) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = text;
    content.appendChild(header);

    const input = document.createElement("input");
    input.type = "text";
    content.appendChild(input);

    const submitButton = document.createElement("button");
    submitButton.innerText = "Submit";
    submitButton.addEventListener("click", () => {
        if (input.value) {
            resolve(input.value);
            document.body.removeChild(div);
        } else {
            alert("Please enter a value");
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

const createListPopup = (values, resolve, important) => {

    const div = document.createElement("div");
    div.classList.add("popup-container");

    const content = document.createElement("div");
    content.classList.add("popup-content");

    const header = document.createElement("h1");
    header.innerText = "Select an option:";
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
                    <div class="input-double-balls">
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
                    <div>
                        <input type="checkbox" id="exclude_collections" name="exclude_collections"></input>
                        <label for="exclude_collections">Ignore Beatmaps from Collections</label>
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
                add_alert("min sr and max sr cannot be both 0");
                return;
            }

            resolve({ min_sr: parseInt(min_sr.value), max_sr: parseInt(max_sr.value), status, exclude_collections });
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