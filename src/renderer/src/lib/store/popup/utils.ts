import type { PopupData } from "./types";

export const text_to_data = (text: string): Extract<PopupData, object> => {
    return { label: text, value: text };
};
