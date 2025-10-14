const button_to_string = {
    [0]: "mouse1",
    [1]: "mouse3",
    [2]: "mouse2",
    [3]: "mouse4",
    [4]: "mouse5"
};

class InputManager {
    constructor() {
        this.keys = new Set();
        this.handlers = new Map();
        this.last_clicked_element = null;
    }

    /** @param {KeyboardEvent} event */
    add(event, mouse) {
        const pressed_key = mouse ? button_to_string[event.button] : event.key.toLowerCase();

        if (!pressed_key) {
            return;
        }

        this.keys.add(pressed_key);

        if (mouse) {
            this.last_clicked_element = event.target;
        }

        // sort so we dont have order issues
        const current_comb = this._normalize_keys(Array.from(this.keys));
        const callback = this.handlers.get(current_comb);

        if (callback) callback();
    }

    /** @param {KeyboardEvent} event */
    remove(event, mouse) {
        const released_key = mouse ? button_to_string[event.button] : event.key.toLowerCase();
        if (this.keys.has(released_key)) {
            this.keys.delete(released_key);
        }
    }

    is_pressed(keys) {
        const normalized = this._normalize_keys(keys.split("+"));
        const current = this._normalize_keys(Array.from(this.keys));
        return normalized == current;
    }

    on(keys, callback) {
        if (typeof keys != "string") {
            console.log("[input] expected string on keys paramater");
            return;
        }

        // sort so we dont have order issues
        const normalized_keys = this._normalize_keys(keys.split("+"));
        this.handlers.set(normalized_keys, callback);
    }

    unregister(...combinations) {
        for (const keys of combinations) {
            // sort so we dont have order issues
            const normalized_keys = this._normalize_keys(keys.split("+"));
            this.handlers.delete(normalized_keys);
        }
    }

    reset() {
        this.keys.clear();
        this.last_clicked_element = null;
    }

    _normalize_keys(keys) {
        return keys
            .map((k) => k.toLowerCase().trim())
            .sort()
            .join("+");
    }
}

export const input = new InputManager();

window.addEventListener("keydown", (e) => input.add(e));
window.addEventListener("mousedown", (e) => input.add(e, true));
window.addEventListener("keyup", (e) => input.remove(e));
window.addEventListener("mouseup", (e) => input.remove(e, true));
window.addEventListener("blur", () => input.reset());
