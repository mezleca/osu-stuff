import { writable } from "svelte/store";

export const indexing = writable(false);
export const indexing_data = writable({});

window.indexer.on_process((data) => indexing.update(() => data.show));
window.indexer.on_process_update((data) => {
	indexing.update(() => true);
	indexing_data.update((old) => ({ old, ...data }));
});
