import { safe_id, create_element } from "../../utils/global.js";

export const create_tag = (options = { id: crypto.randomUUID(), name: "tags", placeholder: "tag system", add_button: true, limit: 4 }) => {
    
    const html = create_element(`
        <div class="tag-container" id="${safe_id(options.id)}">
            <div class="tag-input-area">
                <input type="text" class="tag-input" id="tag-input">
                ${options.add_button ?
                    `<button class="tag-add-button" id="tag-add-button">
                        <i class="bi bi-plus-lg"></i>
                    </button>` 
                    : 
                    ""
                }        
            </div>
            <div class="tag-list" id="tag-list"></div>
        </div>
    `);

    const tag_filter = {
        id: safe_id(options.id),
        element: html,
        values: new Set()
    };

    const tag_list = html.querySelector(".tag-list");
    const input = html.querySelector(".tag-input");

    input.placeholder = options.placeholder;

    const create_tag_value = () => {

        const element = create_element(`
            <div class="tag-item">
                <span class="tag-item-content"></span>
            </div>
        `);

        const text = input.value;

        element.children[0].textContent = `× ${text}`;
        element.addEventListener("click", () => {
            element.style.opacity = "0";
            element.style.transform = "translateY(5px)";
            setTimeout(() => {
                tag_filter.values.delete(text);
                element.remove(); 
            }, 100);
        });

        return element;
    };

    const add_value = () => {

        const new_value = input.value;

        if (new_value == "") {
            return;
        }

        if (tag_filter.values.has(new_value)) {
            input.value = "";
            input.focus();
            return;
        }

        if (tag_filter.values.size >= options.limit) {
            create_alert(`reached the limit (${options.limit})`, { type: "warning" });
            return;
        }

        const element = create_tag_value();

        tag_filter.values.add(input.value);
        tag_list.appendChild(element);

        input.value = "";
        input.focus();
    };
    
    if (options.add_button) {
        html.querySelector(".tag-add-button").addEventListener("click", add_value);
    }

    input.addEventListener("keyup", (event) => { if (event.key == "Enter") add_value()});

    return tag_filter;
};
