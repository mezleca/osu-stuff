import { writable } from "svelte/store";

// notifications
export const notifications_store = writable([]);

const DEFAULT_NOTIFICATION = Object.freeze({
    type: "info",
    persist: false,
    duration: 5000
});

const start_timeout = (id, duration) => {
    setTimeout(() => remove_notification(id), duration);
};

/** @param {{ id: string, type: string, duration: number, text: string}} data */
export const show_notification = (data) => {
    const notification = { ...DEFAULT_NOTIFICATION, id: crypto.randomUUID() };

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
        start_timeout(notification.id, notification.duration);
    }
};

export const edit_notification = (id, data) => {
    notifications_store.update((all) => {
        return all.map((n) => {
            return n.id === id ? { ...n, ...data } : n;
        });
    });
};

// remove persist and start the timeout
export const finish_notification = (id) => {
    notifications_store.update((all) => {
        return all.map((n) => {
            if (n.id !== id || !n.persist) return n;
            start_timeout(n.id, n.duration);
            return { ...n, persist: false };
        });
    });
};

// remove notification without caring about timeout / persist
export const remove_notification = (id) => {
    notifications_store.update((all) => all.filter((n) => n.id != id));
};
