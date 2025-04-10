
import { safe_text, create_element } from "../../utils/global.js";

export const create_progress = (options = {}) => {
    
    const default_options = {
        message: "loading...",
        auto_close: false,
        close_delay: 2000,
        hide_delay: 3000,
        show_on_create: false
    };

    const settings = { ...default_options, ...options };
    let close_timeout = null;
    let hide_timeout = null;
    let is_visible = settings.show_on_create;

    const container = create_element(`
        <div class="progress ${!is_visible ? "hidden" : ""}">
            <div class="progress-text">${safe_text(settings.message)}</div>
        </div>
    `);

    const progress_text = container.querySelector(".progress-text");
    
    document.body.appendChild(container);
    
    if (settings.auto_close) {
        close_timeout = setTimeout(remove, settings.close_delay);
    }
    
    const reset_hide_timeout = () => {

        if (hide_timeout) {
            clearTimeout(hide_timeout);
        }
        
        hide_timeout = setTimeout(() => {
            if (is_visible) {
                hide();
            }
        }, settings.hide_delay);
    };
    
    const show = () => {

        if (!is_visible) {
            container.classList.remove("hidden");
            is_visible = true;
        }
        
        reset_hide_timeout();
    };
    
    const hide = () => {
        if (is_visible) {
            container.classList.add("hidden");
            is_visible = false;
        }
    };
    
    const update = (message) => {
        console.log("[progress]", message);
        progress_text.textContent = safe_text(message);
        show();
    };
    
    const remove = () => {

        if (close_timeout) {
            clearTimeout(close_timeout);
        }
        
        if (hide_timeout) {
            clearTimeout(hide_timeout);
        }
        
        container.classList.add("fade-out");
        
        setTimeout(() => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        }, 300);
    };
    
    if (is_visible) {
        reset_hide_timeout();
    }
    
    return {
        update,
        remove,
        show,
        hide
    };
};
