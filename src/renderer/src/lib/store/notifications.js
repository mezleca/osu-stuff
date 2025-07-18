import { writable } from "svelte/store";

// notifications
export const notifications_store = writable([]);

/** @param {{ id: string, type: string, timeout: number, text: string}} data */
export const show_notification = (data) => {
    const defaults = {
        id: crypto.randomUUID(),
        type: "info",
        timeout: 5000
    };

    const notification = { ...defaults };

    // use default object for text only data
    if (typeof data == "string") {
        defaults.text = data;
    } else {
        Object.assign(notification, data);
    }

    // add and remove after the timeout
    notifications_store.update((all) => [notification, ...all]);
    setTimeout(() => remove_notification(notification.id), notification.timeout);
};

export const remove_notification = (id) => {
    notifications_store.update((all) => all.filter((n) => n.id != id));
};
