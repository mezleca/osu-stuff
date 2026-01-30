import { writable, type Writable } from "svelte/store";

interface INotification {
    id: string;
    type: "info" | "error" | "success" | "warning";
    text: string;
    persist: boolean;
    duration: number;
}

type NotificationInput = string | Partial<INotification>;

export const notifications_store: Writable<INotification[]> = writable([]);

const timeouts = new Map<string, NodeJS.Timeout>();

const DEFAULT_NOTIFICATION: Omit<INotification, "id" | "text"> = Object.freeze({
    type: "info",
    persist: false,
    duration: 5000
});

const start_timeout = (id: string, duration: number): void => {
    const timeout = setTimeout(() => remove_notification(id), duration);
    timeouts.set(id, timeout);
};

export const show_notification = (data: NotificationInput): void => {
    const notification: INotification = {
        ...DEFAULT_NOTIFICATION,
        id: crypto.randomUUID(),
        text: ""
    };

    if (typeof data === "string") {
        notification.text = data;
    } else {
        Object.assign(notification, data);
    }

    notifications_store.update((all) => [notification, ...all]);

    if (!notification.persist) {
        start_timeout(notification.id, notification.duration);
    }
};

export const edit_notification = (id: string, data: Partial<INotification>): void => {
    notifications_store.update((all) => {
        return all.map((n) => {
            if (n.id !== id) return n;

            const updated = { ...n, ...data };

            if ("duration" in data || "persist" in data) {
                const existing_timeout = timeouts.get(id);

                if (existing_timeout) {
                    clearTimeout(existing_timeout);
                    timeouts.delete(id);
                }

                if (!updated.persist) {
                    start_timeout(updated.id, updated.duration);
                }
            }

            return updated;
        });
    });
};

export const finish_notification = (id: string, data?: Partial<INotification>): void => {
    notifications_store.update((all) => {
        return all.map((n) => {
            if (n.id != id || !n.persist) return n;
            if (data) Object.assign(n, data);
            start_timeout(n.id, n.duration);
            return { ...n, persist: false };
        });
    });
};

export const remove_notification = (id: string): void => {
    notifications_store.update((all) => all.filter((n) => n.id !== id));

    const existing_timeout = timeouts.get(id);
    if (existing_timeout) {
        clearTimeout(existing_timeout);
    }

    timeouts.delete(id);
};
