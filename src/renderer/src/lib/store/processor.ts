import type { IProcessorEventData } from "@shared/types";
import { writable, type Writable } from "svelte/store";

export const processing: Writable<boolean> = writable(false);
export const processing_data: Writable<IProcessorEventData> = writable({});

window.api.on("processor:events", (payload) => {
    if (payload.type == "start") {
        processing.set(true);
    }

    if (payload.type == "finish") {
        processing.set(false);
        processing_data.set({});
        return;
    }

    if (payload.data) {
        processing_data.set(payload.data);
    }
});
