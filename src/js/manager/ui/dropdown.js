import { safe_id, create_element } from "../../utils/global.js";

export const create_dropdown = (options = { id: "a", name: "dropdown", values: ["abc", "fgh", "qre"]}) => {

    const container = create_element(`
        <div class="dropdown-container" id="${safe_id(options.id)}">
            <div class="dropdown-header">
                <span class="dropdown-label"></span>
            </div>
            <div class="dropdown-content"></div>
        </div>
    `);

    const self = {
        id: safe_id(options.id),
        name: options.name,
        selected: new Set(),
        element: container,
        create: (v) => { create(v) },
        set_callback: (callback) => { self.callback = callback }
    };

    const label = container.querySelector(".dropdown-label");
    const content = container.querySelector(".dropdown-content");
    const header = container.querySelector(".dropdown-header");
    const header_text = container.querySelector(".dropdown-label");

    label.textContent = options.name;

    // create and append all options
    const create = (values) => {

        // reset selected
        self.selected = new Set();

        const childrens = [];

        for (let i = -1; i < values.length; i++) {
            
            const value = values[i] || "all";

            // ignore "all" value since we already have one 
            if (childrens.length > 0 && value == "all") {
                continue;
            }

            const option = create_element(`
                <div class="dropdown-item">
                    <label></label>
                </div>`
            )

            // start it "all" value
            if (childrens.length == 0 && values.length > 1) {
                option.children[0].textContent = "all";
            } else {
                option.id = `option_${value}`;
                option.children[0].textContent = value;
            }

            // event listener for selecting new option
            option.addEventListener("click", () => {
                update(values, option);
            });
            
            childrens.push(option);
        }

        content.replaceChildren(...childrens);
    };

    // update on click
    const update = (values, target) => {
        
        const name = target.children[0].innerText;
        const all = content.children[0];
    
        if (name == "all") {

            const is_selected = all.classList.contains("dropdown-item-selected");

            if (is_selected) {
                self.selected = new Set();
            } else {
                self.selected = new Set(values);
            }

            for (let i = 0; i < content.children.length; i++) {

                const children = content.children[i];
                
                // if we click on all while is selected, deselect everything
                if (is_selected) {
                    children.classList.remove("dropdown-item-selected");
                } else { // otherwise, select everything
                    if (!children.classList.contains("dropdown-item-selected")) {
                        children.classList.add("dropdown-item-selected");
                    }
                }   
            }

        } else {

            const option = document.getElementById(`option_${name}`);
            const selected = option.classList.contains("dropdown-item-selected");

            if (selected) {

                // if we have "all" selected, deselect them
                if ((self.selected.size) == values.length) {
                    all.classList.remove("dropdown-item-selected");
                }

                option.classList.remove("dropdown-item-selected");
                self.selected.delete(name);
            } else {

                // check "all" if we selected everything except for "all"
                if ((self.selected.size) + 1 == values.length) {
                    all.classList.add("dropdown-item-selected");
                }

                option.classList.add("dropdown-item-selected");
                self.selected.add(name);
            } 
        }

        // update header text
        header_text.textContent = Array.from(self.selected).filter((v) => v != "all").join(", ") || options.name;

        // execute callback
        if (self.callback) {
            self.callback(self, name);
        }
    };

    // show values on click
    header.addEventListener("click", () => { content.classList.toggle("show") });

    // iniatialize dropdown with default values
    create(options.values);

    return self;
};
