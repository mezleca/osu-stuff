import { writable, type Writable, get } from "svelte/store";

export interface IProgressBox {
    id: string;
    text: string;
    progress: number; // 0 - 100
    auto_hide?: boolean;
}

export const progress_boxes: Writable<IProgressBox[]> = writable([]);

export const show_progress_box = (data: IProgressBox) => {
    const existing = get(progress_boxes).find((p) => p.id == data.id);

    if (existing) {
        update_progress_box(data.id, data);
        return;
    }

    progress_boxes.update((boxes) => [...boxes, data]);
};

export const update_progress_box = (id: string, data: Partial<IProgressBox>) => {
    progress_boxes.update((boxes) =>
        boxes.map((box) => {
            if (box.id == id) {
                return { ...box, ...data };
            }
            return box;
        })
    );
};

export const hide_progress_box = (id: string) => {
    progress_boxes.update((boxes) => boxes.filter((box) => box.id != id));
};
