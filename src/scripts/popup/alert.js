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

            console.log(important, info);

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
            }
        });
    }
};