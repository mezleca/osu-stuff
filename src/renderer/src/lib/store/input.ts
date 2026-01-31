const BUTTON_TO_STRING: Record<number, string> = {
    [0]: "mouse1",
    [1]: "mouse3",
    [2]: "mouse2",
    [3]: "mouse4",
    [4]: "mouse5"
};

const rename_key = (key: string) => {
    if (key == " ") return "space";
    return key;
};

type HandlerCallback = () => void;

interface Handler {
    id: number;
    callback: HandlerCallback;
}

class InputManager {
    keys: Set<string>;
    handlers: Map<string, Handler[]>;
    last_clicked_element: EventTarget | null;
    next_id: number;

    constructor() {
        this.keys = new Set();
        this.handlers = new Map();
        this.last_clicked_element = null;
        this.next_id = 0;
    }

    add(event: KeyboardEvent | MouseEvent, mouse?: boolean): void {
        const pressed_key = mouse ? BUTTON_TO_STRING[(event as MouseEvent).button] : rename_key((event as KeyboardEvent).key.toLowerCase());

        if (!pressed_key) {
            return;
        }

        // if the key is already pressed, ignore
        if (this.keys.has(pressed_key)) {
            return;
        }

        this.keys.add(pressed_key);

        if (mouse) {
            this.last_clicked_element = event.target;
        }

        // sort so we dont have order issues
        const current_comb = this._normalize_keys(Array.from(this.keys));
        const handlers = this.handlers.get(current_comb);

        if (handlers) {
            for (const handler of handlers) {
                handler.callback();
            }
        }
    }

    remove(event: KeyboardEvent | MouseEvent, mouse?: boolean): void {
        const released_key = mouse ? BUTTON_TO_STRING[(event as MouseEvent).button] : rename_key((event as KeyboardEvent).key.toLowerCase());

        if (this.keys.has(released_key)) {
            this.keys.delete(released_key);
        }
    }

    is_pressed(keys: string): boolean {
        const normalized = this._normalize_keys(keys.split("+"));
        const current = this._normalize_keys(Array.from(this.keys));
        return normalized == current;
    }

    on(keys: string, callback: HandlerCallback): number {
        if (typeof keys != "string") {
            console.log("[input] expected string on keys paramater");
            return -1;
        }

        // sort so we dont have order issues
        const normalized_keys = this._normalize_keys(keys.split("+"));
        const handler_id = this.next_id++;
        const existing = this.handlers.get(normalized_keys);

        if (existing) {
            existing.push({ id: handler_id, callback });
        } else {
            this.handlers.set(normalized_keys, [{ id: handler_id, callback }]);
        }

        return handler_id;
    }

    unregister(handler_id: number): void {
        for (const [keys, handlers] of this.handlers.entries()) {
            const index = handlers.findIndex((h) => h.id == handler_id);
            if (index != -1) {
                handlers.splice(index, 1);
                if (handlers.length == 0) {
                    this.handlers.delete(keys);
                }
                return;
            }
        }
    }

    reset(): void {
        this.keys.clear();
        this.last_clicked_element = null;
    }

    _normalize_keys(keys: string[]): string {
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
