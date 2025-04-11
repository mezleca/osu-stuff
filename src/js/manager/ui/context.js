import { CONTEXT_FADE_MS, safe_id, safe_text, create_element } from "../../utils/global.js";

const generate_context = (options) => {

    const base = create_element(`
        <div class="context-container">
            <div id="context-menu" class="context-menu"></div>
        </div>`
    );

    const context_menu = base.querySelector("#context-menu");

    // loop through items options
    for (let i = 0; i < options.length; i++) {

        const option = options[i];
        const item_element = create_element(`<div class="menu-item">${safe_text(option.value)}</div>`);

        if (option.type == "submenu") {

            const safe_key = safe_id(option.value.replace(/\s+/g, '-'));
            const sub_container = create_element(`<div id="submenu-${safe_key}" class="submenu"></div>`);

            item_element.classList.add("has-submenu");
            item_element.setAttribute("data-submenu", `submenu-${safe_key}`);

            // loop through submenu options
            for (let j = 0; j < option.values.length; j++) {

                const sub_option = option.values[j];
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

export const create_context = (options) => {

    if (!options?.id) {
        console.log("[CONTEXT MENU] missing id");
        return;
    }

    const self = {
        x: 0,
        y: 0,
        id: options.id,
        target: options?.target,
        is_visible: false,
        show: null,
        close: null,
        update: null,
        element: null,
        options: null,
        close_timeout: null
    };

    const show_menu = (menu, update_pos) => {

        // ignore invalid positions
        if (update_pos && (!self.x || !self.y)) {
            return;
        }

        // rmove existing context
        const existing = document.querySelector(`.context-container[data-id="${self.id}"]`);

        if (existing) {
            existing.remove();
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

            menu.style.left = self.x + "px";
            menu.style.top = self.y + "px";

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

    const show = () => {

        // to prevent multiple contexts
        if (self.is_visible) {
            close_menu();
        }
        
        show_menu(self.options, true);
        self.is_visible = true;
    };

    const close = () => {
        close_menu();
    };

    const close_submenus = () => {
        if (self.element && document.body.contains(self.element)) {
            const subs = self.element.querySelectorAll(".submenu");
            subs.forEach((sub) => sub.style.display = "none");
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
        
        self.element = generate_context(new_options);
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

    document.addEventListener("mousemove", (e) => {

        self.x = e.clientX;
        self.y = e.clientY;

        if (self.is_visible && !is_in_context(self.x, self.y)) {

            if (self.close_timeout) {
                clearTimeout(self.close_timeout);
            }
            
            self.close_timeout = setTimeout(() => {
                close_menu();
                self.close_timeout = null;
            }, CONTEXT_FADE_MS);
        } 
        
        if (self.close_timeout && is_in_context(self.x, self.y)) {
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
        if (self.is_visible) close_menu();
    });

    // initialize context menu
    update(options.values || { values: [] });

    // update self object
    self.close = close;
    self.show = show;
    self.update = update;

    return self;
};
