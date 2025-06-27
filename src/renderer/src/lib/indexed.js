const connect = (name) => {
	return new Promise((resolve, reject) => {
		const request = window.indexedDB.open(name, 3);

		request.onerror = () => {
			console.error("db is not working LUL");
			reject(new Error("Database connection failed"));
		};

		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onupgradeneeded = (event) => {
			const target = event.target;
			if (!target) {
				console.error("IndexedDB upgrade event target is null.");
				return;
			}
			// @ts-ignore
			const db = target.result;
			if (!db.objectStoreNames.contains(name)) {
				db.createObjectStore(name);
			}
		};
	});
};

const save = async (name, key, value) => {
	const database = await connect(name);

	return new Promise((resolve, reject) => {
		const transaction = database.transaction([name], "readwrite");
		const object_store = transaction.objectStore(name);
		const request = object_store.put(value, key);

		request.onsuccess = () => {
			database.close();
			resolve(true);
		};

		request.onerror = (err) => {
			database.close();
			console.error("error saving to database:", err);
			reject(false);
		};
	});
};

const delete_db = async (name, key) => {
	const database = await connect(name);

	return new Promise((resolve, reject) => {
		const transaction = database.transaction([name], "readwrite");
		const object_store = transaction.objectStore(name);
		const request = object_store.delete(key);

		request.onsuccess = () => {
			database.close();
			resolve(true);
		};

		request.onerror = (err) => {
			database.close();
			console.error("error deleting from database:", err);
			reject(false);
		};
	});
};

const get = async (name, key) => {
	const database = await connect(name);

	return new Promise((resolve, reject) => {
		const transaction = database.transaction([name], "readonly");
		const object_store = transaction.objectStore(name);
		const request = object_store.get(key);

		request.onsuccess = () => {
			database.close();
			resolve(request.result);
		};

		request.onerror = (err) => {
			database.close();
			console.error("error loading from database:", err);
			reject(null);
		};
	});
};

const get_all = async (name) => {
	const database = await connect(name);

	return new Promise((resolve, reject) => {
		const transaction = database.transaction([name], "readonly");
		const object_store = transaction.objectStore(name);
		const result = {};

		transaction.oncomplete = () => {
			database.close();
			resolve(result);
		};

		transaction.onerror = (err) => {
			database.close();
			reject(err);
		};

		const cursor_request = object_store.openCursor();

		cursor_request.onsuccess = (event) => {
			const cursor = event.target.result;

			if (cursor) {
				result[cursor.key] = cursor.value;
				cursor.continue();
			}
		};

		cursor_request.onerror = (err) => {
			database.close();
			reject(err);
		};
	});
};

export const indexed = {
	connect: connect,
	save: save,
	get: get,
	all: get_all,
	delete: delete_db
};
