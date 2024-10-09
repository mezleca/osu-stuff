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

export const load_from_database = async (name, key) => {
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