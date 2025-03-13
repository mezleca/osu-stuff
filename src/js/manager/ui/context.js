const callbacks = new Map();

const create_element = (data) => {
    return new DOMParser().parseFromString(data, "text/html").body.firstElementChild;
};

const generate_context = (options) => {

    const base = create_element(`
        <div class="context-container">
            <div id="context-menu" class="context-menu"></div>
        </div>`
    );

    const context_menu = base.querySelector("#context-menu");

    // loop through items options
    for (let i = 0; i < options.values.length; i++) {

        const option = options.values[i];
        const item_element = create_element(`<div class="menu-item">${option.value}</div>`);

        if (option.type == "submenu") {

            const safe_key = option.value.replace(/\s+/g, '-');
            const sub_container = create_element(`<div id="submenu-${safe_key}" class="submenu"></div>`);

            item_element.classList.add("has-submenu");
            item_element.setAttribute("data-submenu", `submenu-${safe_key}`);

            // loop through submenu options
            for (let i = 0; i < option.values.length; i++) {

                const sub_option = option.values[i];
                const sub_element = create_element(`<div class="menu-item">${sub_option.value}</div>`);

                if (sub_option.callback) {
                    sub_element.addEventListener("click", () => {
                        sub_option.callback();
                    });
                }
                
                sub_container.appendChild(sub_element);
            }

            base.appendChild(sub_container);
            context_menu.appendChild(item_element);
        } else {

            if (option.callback) {
                item_element.addEventListener("click", () => {
                    option.callback();
                });
            }

            context_menu.appendChild(item_element);
        }
    }

    return base;
};

export const create_context_menu = (options) => {

    if (!options?.id) {
        console.log("[CONTEXT MENU] missing id");
        return;
    }

    if (!options?.target) {
        console.log("[CONTEXT MENU] mssing target");
        return;
    }

    const context_element = generate_context(options);
    const context_options = context_element.children[0];

    let is_visible = false, x, y;

    const show_menu = (menu, update_pos) => {

        if (!document.body.contains(context_element)) {
            document.body.appendChild(context_element);
        }

        if (update_pos) {
            menu.style.left = x + "px";
            menu.style.top = y + "px";
        }

        context_element.style.display = "block";
        menu.style.display = "block";
    };

    const close_menu = () => {
        context_element.style.display = "none";
        if (document.body.contains(context_element)) {
            document.body.removeChild(context_element);
        }
    };

    const close_submenus = () => {
        const subs = context_element.querySelectorAll(".submenu");
        subs.forEach((sub) => sub.style.display = "none");
    };

    document.addEventListener("mousemove", (e) => {
        x = e.clientX;
        y = e.clientY;
    });

    options.target.addEventListener("contextmenu", (e) => {

        // prevent default context
        e.preventDefault();

        if (!is_visible) {
            show_menu(context_options, true);
            is_visible = true;
        } else {
            close_menu();
            is_visible = false;
        }
    });

    // setup options
    for (let i = 0; i < context_options.children.length; i++) {

        const option = context_options.children[i];

        if (option.classList.contains("has-submenu")) {

            const data = option.getAttribute("data-submenu");
            const submenu = context_element.querySelector(`#${data}`);

            option.addEventListener("mouseover", () => {
                const rect = option.getBoundingClientRect();
                submenu.style.left = rect.right + "px";
                submenu.style.top = rect.top + "px";
                close_submenus();
                submenu.style.display = "block";
            });
        }
    }

    document.addEventListener("click", () => {
        close_menu();
        close_submenus();
        is_visible = false;
    });
};
