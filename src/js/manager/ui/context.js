import { CONTEXT_FADE_MS, debounce, safe_id, safe_text } from "../../utils/global.js";

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
        const item_element = create_element(`<div class="menu-item">${safe_text(option.value)}</div>`);

        if (option.type == "submenu") {

            const safe_key = safe_id(option.value.replace(/\s+/g, '-'));
            const sub_container = create_element(`<div id="submenu-${safe_key}" class="submenu"></div>`);

            item_element.classList.add("has-submenu");
            item_element.setAttribute("data-submenu", `submenu-${safe_key}`);

            // loop through submenu options
            for (let i = 0; i < option.values.length; i++) {

                const sub_option = option.values[i];
                const sub_element = create_element(`<div class="menu-item">${safe_text(sub_option.value)}</div>`);

                if (sub_option.callback) {
                    sub_element.addEventListener("click", () => {
                        sub_option.callback(sub_element);
                    });
                }
                
                sub_container.appendChild(sub_element);
            }

            base.appendChild(sub_container);
            context_menu.appendChild(item_element);
        } else {

            if (option.callback) {
                item_element.addEventListener("click", () => {
                    option.callback(item_element);
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

    let is_visible = false, x, y, close_timeout;

    const show_menu = (menu, update_pos) => {

        // ignore invalid positions
        if (update_pos && (!x || !y)) {
            return;
        }

        if (!document.body.contains(context_element)) {
            document.body.appendChild(context_element);
        }

        context_element.style.display = "block";
        menu.style.display = "block";

        context_options.classList.remove("disabled");
    
        if (update_pos) {

            menu.style.left = x + "px";
            menu.style.top = y + "px";

            const menu_rect = menu.getBoundingClientRect();
            const window_width = window.innerWidth;
            const window_height = window.innerHeight;
    
            if (menu_rect.right > window_width) {
                menu.style.left = (window_width - menu_rect.width) + "px";
            }

            if (menu_rect.left < 0) {
                menu.style.left = "0px";
            }
    
            if (menu_rect.bottom > window_height) {
                menu.style.top = (window_height - menu_rect.height) + "px";
            }

            if (menu_rect.top < 0) {
                menu.style.top = "0px";
            }
        }
    };

    const close_menu = () => {
        
        if (!document.body.contains(context_element)) {
            return;
        }
        
        if (context_element.classList.contains("disabled")) {
            return;
        }

        context_options.classList.add("disabled");

        const interval = setInterval(() => {
            context_element.remove();
            clearInterval(interval);
        }, 150);
    };

    const close_submenus = () => {
        const subs = context_element.querySelectorAll(".submenu");
        subs.forEach((sub) => sub.style.display = "none");
    };

    const is_in_context = (mouse_x, mouse_y) => {

        const context_rect = context_options.getBoundingClientRect();
        
        if (mouse_x >= context_rect.left - 10 && mouse_x <= context_rect.right + 10 && 
            mouse_y >= context_rect.top - 10 &&
            mouse_y <= context_rect.bottom + 10) {
            return true;
        }
        
        const visible_submenus = context_element.querySelectorAll(".submenu[style*='display: block']");

        for (let i = 0; i < visible_submenus.length; i++) {

            const submenu_rect = visible_submenus[i].getBoundingClientRect();

            if (mouse_x >= submenu_rect.left - 10 &&mouse_x <= submenu_rect.right + 10 &&
                mouse_y >= submenu_rect.top - 10 &&
                mouse_y <= submenu_rect.bottom + 10) {
                return true;
            }
        }
        
        return false;
    };

    document.addEventListener("mousemove", (e) => {

        x = e.clientX;
        y = e.clientY;

        if (is_visible && !is_in_context(x, y)) {

            if (close_timeout) {
                clearTimeout(close_timeout);
            }
            
            close_timeout = setTimeout(() => {
                close_menu();
                close_submenus();
                is_visible = false;
                close_timeout = null;
            }, CONTEXT_FADE_MS);
        } 
        
        if (close_timeout && is_in_context(x, y)) {
            clearTimeout(close_timeout);
            close_timeout = null;
        }
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

                close_submenus();
                
                const rect = option.getBoundingClientRect();

                submenu.style.display = "block";
                submenu.style.top = rect.top + "px";
                submenu.style.left = rect.right + "px";

                const submenu_rect = submenu.getBoundingClientRect();
                const sub_height = rect.top + submenu_rect.height;
   
                // make sure the context is rendered on screen
                if (sub_height > window.innerHeight) {
                    const diff = sub_height - window.innerHeight;
                    submenu.style.top = (sub_height - diff - submenu_rect.height) + "px";
                }
            });
        }
    }

    document.addEventListener("click", () => {
        close_menu();
        close_submenus();
        is_visible = false;
    });
};
