const BUTTON_KEYS: Record<number, string> = {
    [0]: "mouse1",
    [1]: "mouse3",
    [2]: "mouse2",
    [3]: "mouse4",
    [4]: "mouse5"
};

export const INPUT_BLOCK_GLOBAL_SHORTCUTS = "data-input-block-global-shortcuts";

const GLOBAL_SCOPE = "global";

type InputEvent = KeyboardEvent | MouseEvent;
type InputCallback = (event: InputEvent) => boolean | void;

interface InputHandler {
    id: number;
    scope: string;
    callback: InputCallback;
}

interface InputHandlerOptions {
    scope?: string;
}

const normalize_key = (key: string): string => {
    if (key == " ") {
        return "space";
    }

    return key.toLowerCase().trim();
};

const normalize_keys = (keys: string[]): string => {
    const normalized: string[] = [];

    for (const key of keys) {
        normalized.push(normalize_key(key));
    }

    return normalized.sort().join("+");
};

const get_event_key = (event: InputEvent, mouse: boolean): string => {
    if (mouse) {
        return BUTTON_KEYS[(event as MouseEvent).button] ?? "";
    }

    return normalize_key((event as KeyboardEvent).key);
};

const is_blocked_by_dom = (event: Event): boolean => {
    for (const target of event.composedPath()) {
        if (!(target instanceof Element)) {
            continue;
        }

        return target.closest(`[${INPUT_BLOCK_GLOBAL_SHORTCUTS}]`) != null;
    }

    return false;
};

class InputManager {
    private keys = new Set<string>();
    private handlers = new Map<string, InputHandler[]>();
    private active_scopes = new Set<string>();
    private next_id = 0;

    add(event: InputEvent, mouse: boolean = false): void {
        const key = get_event_key(event, mouse);

        if (key == "") {
            console.warn("[input] unknown button", event);
            return;
        }

        if (this.keys.has(key)) {
            return;
        }

        this.keys.add(key);

        if (event.defaultPrevented || is_blocked_by_dom(event)) {
            return;
        }

        const handlers = this.handlers.get(normalize_keys(Array.from(this.keys)));

        if (!handlers) {
            return;
        }

        for (let index = handlers.length - 1; index >= 0; index--) {
            const handler = handlers[index];

            if (!this.is_scope_active(handler.scope)) {
                continue;
            }

            if (!handler.callback(event)) {
                continue;
            }

            event.preventDefault();
            return;
        }
    }

    remove(event: InputEvent, mouse: boolean = false): void {
        this.keys.delete(get_event_key(event, mouse));
    }

    on(keys: string, callback: InputCallback, options: InputHandlerOptions = {}): number {
        if (keys.trim() == "") {
            console.error("[input] expected non-empty keys");
            return -1;
        }

        const normalized_keys = normalize_keys(keys.split("+"));
        const id = this.next_id++;
        const handler = {
            id,
            scope: options.scope ?? GLOBAL_SCOPE,
            callback
        };
        const handlers = this.handlers.get(normalized_keys);

        if (handlers) {
            handlers.push(handler);
        } else {
            this.handlers.set(normalized_keys, [handler]);
        }

        return id;
    }

    unregister(id: number): void {
        for (const [keys, handlers] of this.handlers.entries()) {
            const index = handlers.findIndex((handler) => handler.id == id);

            if (index == -1) {
                continue;
            }

            handlers.splice(index, 1);

            if (handlers.length == 0) {
                this.handlers.delete(keys);
            }

            return;
        }
    }

    activate_scope(scope: string): () => void {
        if (scope.trim() == "") {
            console.error("[input] expected non-empty scope");
            return () => {};
        }

        if (scope == GLOBAL_SCOPE) {
            return () => {};
        }

        this.active_scopes.add(scope);
        let active = true;

        return () => {
            if (!active) {
                return;
            }

            active = false;
            this.active_scopes.delete(scope);
        };
    }

    reset(): void {
        this.keys.clear();
    }

    private is_scope_active(scope: string): boolean {
        return scope == GLOBAL_SCOPE || this.active_scopes.has(scope);
    }
}

export const input = new InputManager();

window.addEventListener("keydown", (event) => input.add(event));
window.addEventListener("mousedown", (event) => input.add(event, true));
window.addEventListener("keyup", (event) => input.remove(event));
window.addEventListener("mouseup", (event) => input.remove(event, true));
window.addEventListener("blur", () => input.reset());
