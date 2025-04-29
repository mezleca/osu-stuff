import { CONTEXT_FADE_MS, safe_id, safe_text, create_element, cursor } from "../../utils/global.js";

const generate_context = (options, style, close) => {

    const base = create_element(`
        <div class="context-container">
            <div id="context-menu" class="context-menu"></div>
        </div>`
    , style);

    const context_menu = base.querySelector("#context-menu");

    // loop through items options
    for (let i = 0; i < options.length; i++) {

        const option = options[i];
        const item_element = create_element(`<div class="menu-item">${safe_text(option.value)}</div>`, style);

        if (option.type == "submenu") {

            const safe_key = safe_id(option.value.replace(/\s+/g, '-'));
            const sub_container = create_element(`<div id="submenu-${safe_key}" class="submenu"></div>`, style);

            item_element.classList.add("has-submenu");
            item_element.setAttribute("data-submenu", `submenu-${safe_key}`);

            // loop through submenu options
            for (let j = 0; j < option.values.length; j++) {

                const sub_option = option.values[j];
                const sub_element = create_element(`<div class="menu-item">${safe_text(sub_option.value)}</div>`, style);

                if (sub_option.callback) {
                    sub_element.addEventListener("click", () => {
                        sub_option.callback(sub_element);
                        if (close) close();              
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
                    if (close) close();
                });
            }
            context_menu.appendChild(item_element);
        }
    }

    return base;
};

// @TODO: jsconfig
/**
 * @typedef {Partial<CSSStyleDeclaration>} StyleObj
 * @typedef {Record<string, StyleObj>} StyleMap
*/

/**
 * @param {Object} [options]
 * @param {string} [options.id]
 * @param {HTMLElement|null} [options.target]
 * @param {object} [options.fixed]
 * @param {StyleMap} [options.style]
*/
export const create_context = (options = { id: crypto.randomUUID(), target: null, fixed: { left: false, top:  false }, style: {} }) => {

    if (!options?.id) {
        console.log("[CONTEXT MENU] missing id");
        return;
    }

    const self = {
        id: options.id,
        target: options?.target,
        is_visible: false,
        show: null,
        close: null,
        update: null,
        element: null,
        options: null,
        close_timeout: null,
    };

    const show_menu = (menu, update_pos) => {

        // rmove existing context
        const existing = document.querySelector(`.context-container`);

        // @TODO: sometimes this will close the context menu (if we created a new one before the ending animation finish)
        if (existing && existing.children[0].classList.contains("disabled")) {
            existing.remove();
        }

        if (!options?.fixed) {
            options.fixed = { top: false, left: false };
        }

        // set a id to find the context later
        if (!document.body.contains(self.element)) {
            self.element.setAttribute('data-id', self.id);
            document.body.appendChild(self.element);
        }

        menu.style.display = "block";
        self.element.style.display = "block";
        self.options.classList.remove("disabled");
    
        if (update_pos) {

            const menu_rect = menu.getBoundingClientRect();
            const window_width = window.innerWidth;
            const window_height = window.innerHeight;
            
            if (!options.fixed.left) {

                menu.style.left = cursor.x + "px";

                if (cursor.y + menu_rect.width > window_width) {
                    const ammount = (window_width - menu_rect.width);
                    menu.style.left = ammount + "px";
                }
    
                if (menu_rect.left < 0) {
                    menu.style.left = "0px";
                }
            }

            if (!options.fixed.top) {

                menu.style.top = cursor.y + "px";

                if (cursor.y + menu_rect.height > window_height) {
                    menu.style.top = (window_height - menu_rect.height) + "px";
                }
    
                if (menu_rect.top < 0) {
                    menu.style.top = "0px";
                }             
            }
        }
    };

    const close_menu = () => {
        
        if (!self.is_visible) {
            return;
        }
        
        if (!document.body.contains(self.element)) {
            return;
        }
        
        if (self.options.classList.contains("disabled")) {
            return;
        }

        close_submenus();

        self.options.classList.add("disabled");

        const interval = setInterval(() => {
            if (document.body.contains(self.element)) self.element.remove();
            clearInterval(interval);
        }, 150);
        
        self.is_visible = false;
    };

    const show = (clicked) => {

        // to prevent multiple contexts
        if (self.is_visible) {
            close_menu();
        }

        // to prevent closing
        self.clicked = clicked;
        
        show_menu(self.options, true);
        self.is_visible = true;
    };

    const close = () => {
        close_menu();
    };

    const close_submenus = () => {
        if (self.element && document.body.contains(self.element)) {
            const subs = [...self.element.querySelectorAll(".submenu")]
            for (let i = 0; i < subs.length; i++) {
                subs[i].style.display = "none"
            }
        }
    };

    const setup_submenu_listeners = () => {

        for (let i = 0; i < self.options.children.length; i++) {

            const option = self.options.children[i];

            if (option.classList.contains("has-submenu")) {

                const data = option.getAttribute("data-submenu");
                const submenu = self.element.querySelector(`#${data}`);

                option.addEventListener("mouseover", () => {

                    close_submenus();
                    
                    const rect = option.getBoundingClientRect();

                    submenu.style.display = "block";
                    submenu.style.top = rect.top + "px";
                    submenu.style.left = rect.right + "px";

                    const submenu_rect = submenu.getBoundingClientRect();
                    const sub_height = rect.top + submenu_rect.height;

                    if (sub_height > window.innerHeight) {
                        const diff = sub_height - window.innerHeight;
                        submenu.style.top = (sub_height - diff - submenu_rect.height) + "px";
                    }
                });
            }
        }
    };

    const update = (new_options) => {
        
        const visible = self.is_visible;
        
        if (visible) {
            close_menu();
        }
        
        self.element = generate_context(new_options, options.style, close_menu);
        self.options = self.element.querySelector(".context-menu");
        
        setup_submenu_listeners();
        
        if (visible) {
            show_menu(self.options, true);
            self.is_visible = true;
        }
    };

    const is_in_context = (mouse_x, mouse_y) => {

        if (!document.body.contains(self.element)) {
            return false;
        }
        
        const context_rect = self.options.getBoundingClientRect();
        
        if (mouse_x >= context_rect.left - 10 && mouse_x <= context_rect.right + 10 && 
            mouse_y >= context_rect.top - 10 &&
            mouse_y <= context_rect.bottom + 10) {
            return true;
        }
        
        const visible_submenus = self.element.querySelectorAll(".submenu[style*='display: block']");

        for (let i = 0; i < visible_submenus.length; i++) {

            const submenu_rect = visible_submenus[i].getBoundingClientRect();

            if (mouse_x >= submenu_rect.left - 10 && mouse_x <= submenu_rect.right + 10 &&
                mouse_y >= submenu_rect.top - 10 &&
                mouse_y <= submenu_rect.bottom + 10) {
                return true;
            }
        }
        
        return false;
    };

    document.addEventListener("mousemove", () => {

        if (self.is_visible && !is_in_context(cursor.x, cursor.y)) {

            if (self.close_timeout) {
                clearTimeout(self.close_timeout);
            }
            
            self.close_timeout = setTimeout(() => {
                close_menu();
                self.close_timeout = null;
            }, CONTEXT_FADE_MS);
        } 
        
        if (self.close_timeout && is_in_context(cursor.x, cursor.y)) {
            clearTimeout(self.close_timeout);
            self.close_timeout = null;
        }
    });

    // automatic show / close
    if (options.target) {
        options.target.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            show();
        });
    }

    document.addEventListener("click", () => {
        if (self.is_visible && !self.clicked) close_menu();
    });

    // initialize context menu
    update(options.values || { values: [] });

    // update self object
    self.close = close;
    self.show = show;
    self.update = update;

    return self;
};