import { writable } from "svelte/store";

// export progress state: { active: bool, id, collection, status, path, last_update, progress }
export const export_progress = writable({ active: false });

export const show_export_progress = (obj) => {
    const now = Date.now();
    export_progress.set({ ...obj, active: true, last_update: now });
};

export const hide_export_progress = () => {
    export_progress.set({ active: false });
};
