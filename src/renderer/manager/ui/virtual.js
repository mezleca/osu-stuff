import { create_element, debounce } from "../../utils/global.js";

export const virtual_lists = new Map();
const element_size_cache = new Map();

const get_element_size = (element, id, force_recalc = false) => {

    if (!force_recalc && element_size_cache.has(id)) {
        return element_size_cache.get(id);
    }

    const new_el = element.cloneNode(true);
    
    // mhm
    Object.assign(new_el.style, {
        visibility: 'hidden',
        position: 'absolute',
        top: '-9999px',
        width: 'auto',
        height: 'auto',
        maxWidth: 'none',
        maxHeight: 'none',
    });

    document.body.appendChild(new_el);
    const rect = new_el.getBoundingClientRect();
    new_el.remove();
    
    element_size_cache.set(id, rect);
    
    return rect;
};

const update_size = (target, value) => {
    target.style.height = `${value}px`;
};

const PADDING = 6;
const BUFFER_SIZE = 6;

const render = (id, extra) => {

    const virtual_list = virtual_lists.get(id);

    if (!virtual_list || virtual_list.render_scheduled) {
        return;
    }
    
    virtual_list.render_scheduled = true;
    requestAnimationFrame(() => {
        render_items(id, extra);
        virtual_list.render_scheduled = false;
    });
};

// @TODO: dynamic size
// also this code is a mess
const render_items = (id, extra = { force: false, check: false }) => {

    const virtual_list = virtual_lists.get(id);

    // dont show if its hidden or invalid
    if (!virtual_list || virtual_list?.hidden) {
        console.log("[virtual] not doing shit cuz hidden");
        return;
    }

    const item_total_height = virtual_list.base_size.height + PADDING;

    // if we have empty elements, remove them
    if (virtual_list.length == 0) {
        virtual_list.cleanup();
        return;
    }
    
    // check if our total height is still valid
    if (item_total_height * virtual_list.length != virtual_list.total_height) {
        const new_total = item_total_height * virtual_list.length;
        update_size(virtual_list.virtual_height, new_total);
        virtual_list.total_height = new_total;
    }

    const scroll_top = virtual_list.list.scrollTop;
    const visible_height = virtual_list.list.getBoundingClientRect().height;
    
    const base_index = Math.max(0, Math.floor(scroll_top / item_total_height) - BUFFER_SIZE);
    const items_in_view = Math.ceil(visible_height / item_total_height) + BUFFER_SIZE * 2;
    const max_amount = Math.min(base_index + items_in_view, virtual_list.length);
    
    if (!extra?.force && !extra?.check && virtual_list.last_rendered) {

        const { first_index, last_index } = virtual_list.last_rendered;

        if (base_index >= first_index && max_amount <= last_index) {
            return;
        }
    }
    
    if (extra?.force) {
        virtual_list.element_pool.clear();
        virtual_list.container.innerHTML = "";
    }

    const elements = [];

    for (let i = base_index; i < max_amount; i++) {

        let content = virtual_list.element_pool.get(i) || {};

        if (content && extra?.check) {

            const new_item_content = virtual_list.create(i);

            if (new_item_content.id != content.id) {
                content.element = new_item_content.element();
            }
        }

        // if this item is not created, create it!!!
        if (!content?.element) {
            const new_item_content = virtual_list.create(i);
            content = { element: new_item_content.element(), id: new_item_content.id };
            virtual_list.element_pool.set(i, content);
        }
        
        const pos = i * item_total_height;
        content.element.style.top = `${pos}px`;
        
        // save first item position
        if (i == base_index) {
            virtual_list.first_visible_index = i;
            virtual_list.start_pos = pos;
        }

        // save last item position
        if (i == max_amount - 1) {
            virtual_list.last_visible_index = i;
            virtual_list.last_pos = pos;
        }

        elements.push(content.element);
    }

    if (elements.length > 0) {
        virtual_list.container.replaceChildren(...elements);
        virtual_list.last_rendered = {
            first_index: base_index,
            last_index: max_amount - 1
        };
    }
};

export const create_virtual_list = (options = { id: 0, elements: [], target: null, create: (i) => { }, get: () => { } }) => {

    const virtual_height = create_element(`<div class="virtual-height" id="${options.id}"></div>`);
    const list_target = create_element(`<div class="virtual-list" id="${options.id}"></div>`);
    const virtual_container = create_element(`<div class="virtual-container"></div>`);
    
    const virtual_list = {
        initialized: false,
        id: options.id,
        target: options.target,
        list: list_target,
        container: virtual_container,
        virtual_height,
        hidden: false,
        first_visible_index: 0,
        last_visible_index: 0,
        length: 0,
        create: options.create,
        element_pool: new Map(),
        render_scheduled: false,
        
        initialize: () => {

            if (virtual_list.initialized) {
                return virtual_list;
            }
            
            const base_size = get_element_size(options.create(0).element(), options.id);
            virtual_list.base_size = base_size;
            
            const item_total_height = base_size.height + PADDING;
            const total_height = item_total_height * virtual_list.length;
            virtual_list.total_height = total_height;
            
            options.target.style.position = "relative";

            list_target.style.position = "absolute";
            list_target.style.width = "100%";
            list_target.style.overflow = "auto";
            
            update_size(virtual_height, total_height);
            
            list_target.appendChild(virtual_height);
            list_target.appendChild(virtual_container);
            
            options.target.appendChild(list_target);
            list_target.addEventListener("scroll", debounce(() => render(options.id), 30));
            
            window.addEventListener("resize", () => render(options.id, true));
            
            virtual_lists.set(options.id, virtual_list);
            virtual_list.initialized = true;
            
            render(options.id, { force: true });
            return virtual_list;
        },
        
        refresh: (extra) => {

            const vl = virtual_lists.get(options.id);
            
            if (!vl || vl.hidden || !vl.initialized) {
                return virtual_list;
            }
            
            const first_visible = extra.force ? 0 : vl.first_visible_index || 0;       
            const item_height = vl.base_size.height + PADDING;  
            const new_total = item_height * vl.length;

            update_size(vl.virtual_height, new_total);
            
            if (extra.force) {
                vl.total_height = new_total;         
                vl.list.scrollTop = first_visible * item_height;
                delete vl.last_rendered;
            }
            
            render(options.id, extra);
            return virtual_list;
        },
        
        cleanup: () => {

            if (!virtual_list.initialized) {
                return virtual_list;
            }
            
            element_size_cache.delete(options.id);
            virtual_list.element_pool.clear();
            virtual_list.container.replaceChildren();
            virtual_list.last_rendered;
            list_target.removeEventListener("scroll", debounce(() => render(options.id, {}), 20));
            
            return virtual_list;
        },
        
        hide: () => {

            if (!virtual_list.initialized) {
                return virtual_list;
            }
            
            virtual_list.hidden = true;
            virtual_list.list.style.display = "none";
            return virtual_list;
        },
        
        show: () => {

            if (!virtual_list.initialized) {
                virtual_list.initialize();
                return virtual_list;
            }
            
            virtual_list.hidden = false;
            virtual_list.list.style.display = "";
            
            return virtual_list;
        },
        
        update: () => {
            if (!virtual_list.initialized) {
                return virtual_list;
            }
            
            render(options.id, {});
            return virtual_list;
        }
    };

    return virtual_list;
};