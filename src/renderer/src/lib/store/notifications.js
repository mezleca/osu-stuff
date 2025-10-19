import { writable } from "svelte/store";

// notifications
export const notifications_store = writable([]);

const DEFAULT_NOTIFICATION = Object.freeze({
    id: crypto.randomUUID(),
    type: "info",
    persist: false,
    duration: 5000
});

const start_timeout = (id, duration) => {
    setTimeout(() => remove_notification(id), duration);
};

/** @param {{ id: string, type: string, duration: number, text: string}} data */
export const show_notification = (data) => {
    const notification = Object.assign({ ...DEFAULT_NOTIFICATION }, data);

    // use default object for text only data
    if (typeof data == "string") {
        notification.text = data;
    } else {
        Object.assign(notification, data);
    }

    // add notification to store
    notifications_store.update((all) => [notification, ...all]);

    // only show timeout if we're not persisting
    if (!notification.persist) {
        start_timeout(notification.id);
    }
};

export const edit_notification = (id, data) => {
    notifications_store.update((all) => {
        return all.map((n) => {
            if (n.id != id) return n;
            return Object.assign(n, data);
        });
    });
};

// remove persist and start the timeout
export const finish_notification = (id) => {
    notifications_store.update((all) => {
        return all.map((n) => {
            if (n.id != id || !n.persist) return n;
            n.persist = false;
            start_timeout(n.id, n.duration);
            return n;
        });
    });
};

// remove notification without caring about timeout / persist
export const remove_notification = (id) => {
    notifications_store.update((all) => all.filter((n) => n.id != id));
};
