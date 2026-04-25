type DebouncedFunction<T extends (...args: any[]) => any> = {
    (...args: Parameters<T>): void;
    cancel: () => void;
    flush: () => void;
    pending: () => boolean;
};

type ThrottledFunction<T extends (...args: any[]) => any> = {
    (...args: Parameters<T>): void;
    cancel: () => void;
    flush: () => void;
    pending: () => boolean;
};

export const debounce = <T extends (...args: any[]) => any>(func: T, timeout = 100): DebouncedFunction<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last_args: Parameters<T> | null = null;

    const debounced = (...args: Parameters<T>) => {
        last_args = args;

        if (timer !== null) {
            clearTimeout(timer);
        }

        timer = setTimeout(() => {
            func(...args);
            timer = null;
            last_args = null;
        }, timeout);
    };

    debounced.cancel = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
            last_args = null;
        }
    };

    debounced.flush = () => {
        if (timer !== null && last_args !== null) {
            clearTimeout(timer);
            func(...last_args);
            timer = null;
            last_args = null;
        }
    };

    debounced.pending = () => timer !== null;

    return debounced;
};

export const throttle = <T extends (...args: any[]) => any>(func: T, timeout = 100): ThrottledFunction<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last_args: Parameters<T> | null = null;
    let last_call_time = 0;

    const throttled = (...args: Parameters<T>) => {
        const now = Date.now();
        const time_since_last_call = now - last_call_time;

        last_args = args;

        if (time_since_last_call >= timeout) {
            last_call_time = now;
            func(...args);
            last_args = null;
            return;
        }

        if (timer === null) {
            timer = setTimeout(() => {
                last_call_time = Date.now();

                if (last_args !== null) {
                    func(...last_args);
                }

                timer = null;
                last_args = null;
            }, timeout - time_since_last_call);
        }
    };

    throttled.cancel = () => {
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = null;
        last_args = null;
    };

    throttled.flush = () => {
        if (timer !== null && last_args !== null) {
            clearTimeout(timer);
            last_call_time = Date.now();
            func(...last_args);
            timer = null;
            last_args = null;
        }
    };

    throttled.pending = () => timer !== null;

    return throttled;
};
