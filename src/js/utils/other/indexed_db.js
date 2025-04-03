const connect_to_db = (name) => {

    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(name, 3);
        
        request.onerror = () => {
            console.error("db is not working LUL");
            return reject(null);
        };
   
        request.onsuccess = () => {
            return resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(name)) {
                db.createObjectStore(name);
            }
        };
    });
};

export const save_to_db = async (name, key, value) => {

    const database = await connect_to_db(name);

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([name], 'readwrite');
        const object_store = transaction.objectStore(name);
        const request = object_store.put(value, key);
        
        request.onsuccess = () => {
            resolve(true);
        };
        
        request.onerror = (err) => {
            console.error("error saving to database:", err);
            reject(false);
        };
    });
};

export const delete_from_db = async (name, key) => {

    const database = await connect_to_db(name);

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([name], 'readwrite');
        const object_store = transaction.objectStore(name);
        const request = object_store.delete(key);
        
        request.onsuccess = () => {
            resolve(true);
        };
        
        request.onerror = (err) => {
            console.error("error deleting from database:", err);
            reject(false);
        };
    });
};

export const get_from_database = async (name, key) => {

    const database = await connect_to_db(name);

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([name], 'readonly');
        const object_store = transaction.objectStore(name);
        const request = object_store.get(key);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = (err) => {
            console.error("error loading from database:", err);
            reject(null);
        };
    });
};

export const get_all_from_database = async (name) => {

    const database = await connect_to_db(name);

    return new Promise((resolve, reject) => {
        
        const transaction = database.transaction([name], 'readonly');
        const object_store = transaction.objectStore(name);
        const result = new Map();

        const cursor_request = object_store.openCursor();
        
        cursor_request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                result.set(cursor.key, cursor.value);
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        
        cursor_request.onerror = (err) => {
            console.error("error info from database:", err);
            reject(result);
        };
    });
};
