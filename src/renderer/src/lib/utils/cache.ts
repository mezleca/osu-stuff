const CACHE_CHECK_INTERVAL = 1000;
const CACHE_IDLE_THRESHOLD = 2000;

export class CacheManager<T> {
    private cache: Map<string | number, T> = new Map();
    private last_access: number = Date.now();
    private max_size: number;
    private dispose_handler?: (item: T) => void;
    // @ts-ignore
    private interval: NodeJS.Timeout;

    constructor(size: number, on_dispose?: (item: T) => void) {
        this.max_size = size;
        this.dispose_handler = on_dispose;
        this.interval = setInterval(() => this.cleanup(), CACHE_CHECK_INTERVAL);
    }

    get(id: string | number): T | undefined {
        this.last_access = Date.now();
        const item = this.cache.get(id);

        if (item) {
            // move to end (MRU) without triggering dispose
            this.cache.delete(id);
            this.cache.set(id, item);
        }

        return item;
    }

    set(id: string | number, item: T) {
        this.last_access = Date.now();

        if (this.cache.has(id)) {
            const old_item = this.cache.get(id);
            // only dispose if we are replacing with a DIFFERENT item
            if (old_item !== item && this.dispose_handler && old_item) {
                this.dispose_handler(old_item);
            }
            this.cache.delete(id);
        }

        this.cache.set(id, item);
    }

    has(id: string | number): boolean {
        return this.cache.has(id);
    }

    delete(id: string | number) {
        if (this.cache.has(id)) {
            const item = this.cache.get(id);
            if (this.dispose_handler && item) {
                this.dispose_handler(item);
            }
            return this.cache.delete(id);
        }
        return false;
    }

    clear() {
        if (this.dispose_handler) {
            for (const item of this.cache.values()) {
                this.dispose_handler(item);
            }
        }
        this.cache.clear();
    }

    private cleanup() {
        if (Date.now() - this.last_access < CACHE_IDLE_THRESHOLD) {
            return;
        }

        if (this.cache.size <= this.max_size) {
            return;
        }

        const keys = this.cache.keys();
        while (this.cache.size > this.max_size) {
            const key = keys.next().value;
            const item = this.cache.get(key);

            if (this.dispose_handler && item) {
                this.dispose_handler(item);
            }

            this.cache.delete(key);
        }
    }
}
