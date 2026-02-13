import { get, writable, type Writable } from "svelte/store";

interface INotification {
    id: string;
    type: "info" | "error" | "success" | "warning" | "confirm";
    text: string;
    persist: boolean;
    duration: number;
    on_click?: () => void | Promise<void>;
    on_before_close?: () => void;
    actions?: INotificationAction[];
}

interface INotificationAction {
    id: string;
    label: string;
    on_click?: () => void | Promise<void>;
    close_on_click?: boolean;
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
    let notification_to_remove: INotification | undefined;
    notifications_store.update((all) => {
        notification_to_remove = all.find((n) => n.id == id);
        return all;
    });

    if (notification_to_remove?.on_before_close) {
        try {
            notification_to_remove.on_before_close();
        } catch (err) {
            console.error("[notifications] on_before_close failed:", err);
        }
    }

    notifications_store.update((all) => all.filter((n) => n.id !== id));

    const existing_timeout = timeouts.get(id);
    if (existing_timeout) {
        clearTimeout(existing_timeout);
    }

    timeouts.delete(id);
};

export const click_notification = async (id: string): Promise<void> => {
    let on_click: (() => void | Promise<void>) | undefined = undefined;

    notifications_store.update((all) => {
        const notification = all.find((n) => n.id == id);
        on_click = notification?.on_click;
        return all;
    });

    if (on_click) {
        try {
            await on_click();
        } catch (err) {
            console.error("[notifications] on_click failed:", err);
        }
    }

    remove_notification(id);
};

export const click_notification_action = async (notification_id: string, action_id: string): Promise<void> => {
    let action: INotificationAction | undefined;

    notifications_store.update((all) => {
        const notification = all.find((n) => n.id == notification_id);
        action = notification?.actions?.find((item) => item.id == action_id);
        return all;
    });

    if (!action) {
        return;
    }

    if (action.on_click) {
        try {
            await action.on_click();
        } catch (err) {
            console.error("[notifications] action on_click failed:", err);
        }
    }

    if (action.close_on_click !== false) {
        remove_notification(notification_id);
    }
};

export const notification_exists = (id: string): boolean => {
    return get(notifications_store).some((n) => n.id == id);
};
