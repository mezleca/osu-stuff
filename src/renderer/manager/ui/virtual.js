import { create_element } from "../../utils/global.js";

export const virtual_lists = new Map();

const get_element_size = (element) => {

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

    return rect;
};

const update_size = (target, value) => {
    target.style.height = `${value}px`;
};

const clamp = (val, min, max) => {
    return val > max ? max : val < min ? min : val;
}

const MAX_RENDER_AMOUNT = 16;
const PADDING = 6;

// @TODO: this is very very simple shit
// code is not optmized enough
// also dont support dynamic height elements (before and after adding it)
const render_items = (id, force) => {

    const elements = [];
    const virtual_list = virtual_lists.get(id);

    // dont show if its hidden or invalid
    if (!virtual_list || virtual_list?.hidden) {
        return;
    }

    const item_total_height = virtual_list.base_size.height + PADDING;

    // check if our total height is still valid
    if (item_total_height * virtual_list.length != virtual_list.total_height) {
        const new_total = item_total_height * virtual_list.length;
        update_size(virtual_list.virtual_height, new_total);
        virtual_list.total_height = new_total;
    }

    const scroll_top = virtual_list.list.scrollTop;
    const base_index = Math.floor(scroll_top / item_total_height);
    const max_visible = scroll_top + virtual_list.list.getBoundingClientRect().height;
    const max_amount = clamp(base_index + MAX_RENDER_AMOUNT, base_index, virtual_list.length);

    const render = () => {

        for (let i = base_index; i < max_amount; i++) {

            const element = virtual_list.create(i);
            const pos = i * item_total_height; 

            // save start
            if (i == base_index) {
                virtual_list.start_pos = pos;
                virtual_list.first_visible_index = i;
            }
    
            // save last item position
            if ((max_amount - i) - 1 == 0) {
                virtual_list.last_pos = pos;
                virtual_list.last_visible_index = i;
            }
    
            element.style.top = pos + "px";
            elements.push(element);
        }

        if (elements.length > 0) {
            virtual_list.container.replaceChildren(...elements);
        }
    };

    if (force || !virtual_list.last_pos) {
        render();
        return;
    }

    if (virtual_list.last_pos - max_visible <= 0 || scroll_top < virtual_list.start_pos) {
        render();
        return;
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
        initialize: () => {

            if (virtual_list.initialized) {
                return virtual_list;
            }
            
            const base_size = get_element_size(options.create(0));
            virtual_list.base_size = base_size;
            
            const item_total_height = base_size.height + PADDING;
            const total_height = item_total_height * virtual_list.length - PADDING;
            virtual_list.total_height = total_height;
            
            options.target.style.position = "relative";
            list_target.style.position = "absolute";
            list_target.style.width = "100%";
            
            update_size(virtual_height, total_height);
            
            list_target.appendChild(virtual_height);
            list_target.appendChild(virtual_container);
            
            options.target.appendChild(list_target);
            list_target.addEventListener("scroll", () => render_items(options.id));
          
            virtual_lists.set(options.id, virtual_list);
            virtual_list.initialized = true;
            render_items(options.id);
            
            return virtual_list;
        },
        
        refresh: (reset) => {

            const vl = virtual_lists.get(options.id);

            if (!vl || vl.hidden || !vl.initialized) {
                return virtual_list;
            }
            
            const first_visible = reset ? 0 : vl.first_visible_index || 0;       
            const item_height = vl.base_size.height + PADDING;  
            const new_total = item_height * vl.length - PADDING;

            update_size(vl.virtual_height, new_total);

            vl.total_height = new_total;         
            vl.list.scrollTop = first_visible * item_height;
            
            render_items(options.id, true);
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
            
            virtual_list.refresh();
            return virtual_list;
        },
        
        update: () => {
            if (!virtual_list.initialized) {
                return virtual_list;
            }
            
            render_items(options.id);
            return virtual_list;
        }
    };

    return virtual_list;
};