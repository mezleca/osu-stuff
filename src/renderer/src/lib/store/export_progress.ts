import { writable, type Writable } from "svelte/store";

interface IExportProgress {
    active: boolean;
    text: string;
    progress: number; // 0 - 100
    last_update: number;
}

const DEFAULT_PROGRESS_STATE: IExportProgress = {
    active: false,
    last_update: 0,
    progress: 0,
    text: ""
};

export const export_progress: Writable<IExportProgress> = writable(DEFAULT_PROGRESS_STATE);

export const update_export_progress = (data: Partial<IExportProgress>) => {
    export_progress.update((obj) => ({ ...obj, ...data }));
};

export const hide_export_progress = () => {
    export_progress.set(DEFAULT_PROGRESS_STATE);
};
