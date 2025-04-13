const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const Realm = require('realm');
const JSZip = require("jszip");

const { contextBridge, ipcRenderer, shell } = require("electron");
const { exec } = require("child_process");

const instances = new Map();

export class BeatmapDifficulty extends Realm.Object {
    static schema = {
        name: 'BeatmapDifficulty',
        embedded: true,
        properties: {
            DrainRate: 'float',
            CircleSize: 'float',
            OverallDifficulty: 'float',
            ApproachRate: 'float',
            SliderMultiplier: 'double',
            SliderTickRate: 'double'
        }
    };
};

export class BeatmapMetadata extends Realm.Object {
    static schema = {
        name: 'BeatmapMetadata',
        properties: {
            Title: 'string?',
            TitleUnicode: 'string?',
            Artist: 'string?',
            ArtistUnicode: 'string?',
            Author: "RealmUser?",
            Source: 'string?',
            Tags: 'string?',
            PreviewTime: 'int',
            AudioFile: 'string?',
            BackgroundFile: 'string?',
        }
    };
};

export class BeatmapUserSettings extends Realm.Object {
    static schema = {
        name: 'BeatmapUserSettings',
        embedded: true,
        properties: {
            Offset: 'double',
        }
    };
};

export class RealmUser extends Realm.Object {
    static schema = {
        name: 'RealmUser',
        embedded: true,
        properties: {
            OnlineID: 'int',
            Username: 'string?',
            CountryCode: 'string?',
        }
    };
};

export class Ruleset extends Realm.Object {
    static schema = {
        name: 'Ruleset',
        primaryKey: 'ShortName',
        properties: {
            ShortName: 'string?',
            OnlineID: { type: 'int', default: -1, indexed: true, optional: false },
            Name: 'string?',
            InstantiationInfo: 'string?',
            LastAppliedDifficultyVersion: 'int',
            Available: 'bool',
        }
    };
};

export class File extends Realm.Object {
    static schema = {
        name: 'File',
        primaryKey: 'Hash',
        properties: {
            Hash: 'string?',
        }
    };
};

export class RealmNamedFileUsage extends Realm.Object {
    static schema = {
        name: 'RealmNamedFileUsage',
        embedded: true,
        properties: {
            File: 'File?',
            Filename: 'string?',
        }
    };
};

export class BeatmapCollection extends Realm.Object {
    static schema = {
        name: 'BeatmapCollection',
        primaryKey: "ID",
        properties: {
            ID: 'uuid',
            Name: 'string?',
            BeatmapMD5Hashes: 'string?[]',
            LastModified: 'date',
        }
    };
};

export class BeatmapSet extends Realm.Object {
    static schema = {
        name: 'BeatmapSet',
        primaryKey: 'ID',
        properties: {
            ID: 'uuid',
            OnlineID: { type: 'int', default: -1, indexed: true, optional: false },
            DateAdded: 'date',
            DateSubmitted: 'date?',
            DateRanked: 'date?',
            Beatmaps: 'Beatmap[]',
            Files: 'RealmNamedFileUsage[]',
            Status: { type: 'int', default: 0 },
            DeletePending: { type: 'bool', default: false },
            Hash: 'string?',
            Protected: { type: 'bool', default: false },
        }
    };
};

export class Beatmap extends Realm.Object {
    static schema = {
        name: 'Beatmap',
        primaryKey: 'ID',
        properties: {
            ID: 'uuid',
            DifficultyName: 'string?',
            Ruleset: 'Ruleset',
            Difficulty: 'BeatmapDifficulty',
            Metadata: 'BeatmapMetadata',
            UserSettings: 'BeatmapUserSettings',
            BeatmapSet: 'BeatmapSet', 
            OnlineID: { type: 'int', default: -1, indexed: true, optional: false },
            Length: { type: 'double', default: 0 },
            BPM: { type: 'double', default: 0 },
            Hash: 'string?',
            StarRating: { type: 'double', default: -1 },
            MD5Hash: 'string?',
            OnlineMD5Hash: 'string?',
            LastLocalUpdate: 'date?',
            LastOnlineUpdate: 'date?',
            Status: { type: 'int', default: 0 },
            Hidden: { type: 'bool', default: false },
            EndTimeObjectCount: { type: 'int', default: -1 },
            TotalObjectCount: { type: 'int', default: -1 },
            LastPlayed: 'date?',
            BeatDivisor: { type: 'int', default: 4 },
            EditorTimestamp: 'double?',
        }
    };
};

export const get_schema = (names) => {

    let schemas = [];

    for (let i = 0; i < names.length; i++) {

        const name = names[i];

        switch (name) {

            case "All":
                schemas = [Beatmap, BeatmapCollection, BeatmapDifficulty, BeatmapMetadata, BeatmapSet, BeatmapUserSettings, File, RealmNamedFileUsage, RealmUser, Ruleset];
                break;   
            case "BeatmapDifficulty":
                schemas.push(BeatmapDifficulty);
                break;
            case "BeatmapMetadata":
                schemas.push(BeatmapMetadata);
                break;
            case "BeatmapUserSettings":
                schemas.push(BeatmapUserSettings);
                break;
            case "RealmUser":
                schemas.push(RealmUser);
                break;
            case "RuleSet":
                schemas.push(Ruleset);
                break;
            case "File":
                schemas.push(File);
                break;
            case "RealmNamedFileUsage":
                schemas.push(RealmNamedFileUsage);
                break;
            case "BeatmapCollection":
                schemas.push(BeatmapCollection);
                break;
            case "BeatmapSet":
                schemas.push(BeatmapSet);
                break;
            case "Beatmap":
                schemas.push(Beatmap);
                break;
            default:
                break;
        }
    }

    return schemas;
};

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

const save_to_db = async (name, key, value) => {

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

const delete_from_db = async (name, key) => {

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

const get_from_database = async (name, key) => {

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

const get_all_from_database = async (name) => {

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

const check_folder_permissions = async (folder) => {

    try {

        const test_file = path.join(folder, `test-${Date.now()}.tmp`);
        const test_file_renamed = path.join(folder, "renamed-test.tmp");

        fs.writeFileSync(test_file, "test");
        fs.readFileSync(test_file);
        fs.renameSync(test_file, test_file_renamed);
        fs.unlinkSync(test_file_renamed);

        const first_file = fs.readdirSync(folder)[0];

        if (first_file) {
            const file_path = path.join(folder, first_file);
            const stats = fs.statSync(file_path);
            const is_dir = (stats.mode & 0o170000) == 0o040000;
            const temp_name = path.join(folder, is_dir ? "stufttest0101" : "renamed-test.tmp");
            fs.renameSync(file_path, temp_name);
            fs.renameSync(temp_name, file_path);
        }

        return true;
    } catch (err) {
        console.log("folder perm error:", err);
        return false;
    }
};

export const get_linux_path = async () => {

    const default_path = path.join(os.homedir(), '.local', 'share', 'osu-wine', 'osu!');
    const custom_path = path.join(os.homedir(), ".local/share/osuconfig/osupath");

    // check if its in the default path
    if (fs.existsSync(default_path)) {
        return "";
    }

    const result = await new Promise((resolve, reject) => {
        exec(`[ -e "$HOME/.local/share/osuconfig/osupath" ] && echo "1"`, (err, stdout, stderr) => {
            if (err) {
                return reject("");
            }
            if (stderr) {
                return reject("");
            }
            if (stdout == 1) {
                return resolve(fs.readFileSync(custom_path, "utf-8").split("\n")[0]);
            }
        });
    });

    return result;
};

contextBridge.exposeInMainWorld("os", {
    homedir: () => os.homedir()
});

contextBridge.exposeInMainWorld("electronAPI", {
    update_mirrors: (mirrorList) => ipcRenderer.invoke("update-mirrors", mirrorList),
    update_path: (downloadPath) => ipcRenderer.invoke("update-path", downloadPath),
    create_download: (id, hashes) => ipcRenderer.invoke("create-download", id, hashes),
    stop_download: (id) => ipcRenderer.invoke("stop-download", id),
    on_download_create: (callback) => {
        ipcRenderer.on("download-create", (_, data) => callback(data));
    },
    on_progress_update: (callback) => {
        ipcRenderer.on("progress-update", (_, data) => callback(data));
    },
    on_progress_end: (callback) => {
        ipcRenderer.on("progress-end", (_, data) => callback(data));
    }
});

contextBridge.exposeInMainWorld("fs", {
    existsSync: (path) => fs.existsSync(path),
    mkdirSync: (path, options) => fs.mkdirSync(path, options),
    readdirSync: (path, options) => fs.readdirSync(path, options),
    unlinkSync: (path) => fs.unlinkSync(path),
    rmdirSync: (path, options) => fs.rmdirSync(path, options),
    renameSync: (a, b) => fs.renameSync(a, b),
    save_exported: async (name, buffer) => {
        const _path = await get_from_database("config", "export_path");
        fs.writeFileSync(path.resolve(_path, name), Buffer.from((buffer)));
    },
    save_osu_file: async (buffer) => {
        console.log("saving", buffer);
        const base = await get_all_from_database("config", "stable_path");
        fs.writeFileSync(path.resolve(base, "osu!.db"), Buffer.from(buffer));
    },
    statSync: (path, options) => {
        const stat = fs.statSync(path, options);
        return {
            isFile: () => stat.isFile(),
            isDirectory: () => stat.isDirectory(),
            size: stat.size,
            mtime: stat.mtime,
            ctime: stat.ctime,
            birthtime: stat.birthtime
        };
    },
    constants: fs.constants
});

contextBridge.exposeInMainWorld("path", {
    basename: (_path, ext) => path.basename(_path, ext),
    dirname: (_path) => path.dirname(_path),
    extname: (_path) => path.extname(_path),
    format: (pathObject) => path.format(pathObject),
    isAbsolute: (_path) => path.isAbsolute(_path),
    join: (...paths) => path.join(...paths),
    normalize: (_path) => path.normalize(_path),
    parse: (_path) => path.parse(_path),
    relative: (from, to) => path.relative(from, to),
    resolve: (...paths) => path.resolve(...paths),
    get_linux_path: () => get_linux_path()
});

contextBridge.exposeInMainWorld("realmjs", {
    BSON: Realm.BSON,
    openRealm: (path, schema, version) => {
        try {
            const id = crypto.randomUUID();
            instances.set(id, new Realm({
                path: path,
                schema: get_schema(schema),
                schemaVersion: version
            }));
            return id;
        } catch (error) {
            console.error("error opening realm:", error);
            return null;
        }
    },
    objects: (realm, schema) => {
        if (!realm) return [];
        return instances.get(realm).objects(schema).toJSON();
    },
    update_collection: (realm, _uuid, name, maps) => {

        const uuid = _uuid ? new Realm.BSON.UUID(Buffer.from(_uuid.buffer)) : null;
        const result = { new: false, id: uuid };

        const instance = instances.get(realm);
        const exists = uuid ? instance.objectForPrimaryKey("BeatmapCollection", uuid) : null;
                        
        instance.write(() => {

            if (exists == null) {

                const id = new Realm.BSON.UUID();

                result.id = id;
                result.new = true;

                console.log("creating new collection", id, name);
                
                instance.create("BeatmapCollection", {
                    ID: id,
                    Name: name,
                    BeatmapMD5Hashes: Array.from(maps) || [],
                    LastModified: new Date()
                });

            } else {
                const collection = exists;
                collection.Name = name;
                collection.BeatmapMD5Hashes = Array.from(maps);
                collection.LastModified = new Date();
            }
        });

        return result;
    },
    delete_collection: (realm, uuid) => {
        const instance = instances.get(realm);
        instance.write(() => {
            const collection = instance.objectForPrimaryKey("BeatmapCollection", uuid);
            instance.delete(collection);
        });
    },
    close: (realm) => {
        if (realm) realm.close();
    },
});

contextBridge.exposeInMainWorld("JSZip", {
    new: () => new JSZip(),
    file: (instance, name, data, options) => instance.file(name, data, options),
    folder: (instance, name) => instance.folder(name),
    filter: (instance, predicate) => instance.filter(predicate),
    remove: (instance, path) => instance.remove(path),
    generateAsync: (instance, options) => instance.generateAsync(options),
    loadAsync: (data, options) => JSZip.loadAsync(data, options),
    zip_file: (files) => {
        const zip = new JSZip();
        for (let i = 0; i < files.length; i++) {
            const { name, location } = files[i];
            if (fs.statSync(location).isDirectory()) {
                continue;
            }
            zip.file(name, fs.readFileSync(location));
        }
        return zip.generateAsync({ type: "nodebuffer" });
    }
});

contextBridge.exposeInMainWorld("zlib", {
    deflateSync: (buffer, options) => zlib.deflateSync(buffer, options),
    inflateSync: (buffer, options) => zlib.inflateSync(buffer, options),
    gzipSync: (buffer, options) => zlib.gzipSync(buffer, options),
    gunzipSync: (buffer, options) => zlib.gunzipSync(buffer, options),
    constants: zlib.constants
});

contextBridge.exposeInMainWorld("shell", {
    openExternal: (url, options) => shell.openExternal(url, options)
});

contextBridge.exposeInMainWorld("process", {
    platform: process.platform,
    env: process.env
});

contextBridge.exposeInMainWorld("database", {
    save: (name, key, value) => save_to_db(name, key, value),
    delete: (name, key) => delete_from_db(name, key),
    get: (name, key) => get_from_database(name, key),
    all: (name) => get_all_from_database(name),   
});

contextBridge.exposeInMainWorld("extra", {
    fetch_stats: (url, cookies) => ipcRenderer.invoke("fetch-stats", url, cookies),
    create_auth: (url, end) => ipcRenderer.invoke("create-auth", url, end),
    create_dialog: (options) => ipcRenderer.invoke("create-dialog", options),
    select_file: (options) => ipcRenderer.invoke("select-file", options), 
    maximize_window: () => ipcRenderer.invoke("maximize"),
    minimize_window: () => ipcRenderer.invoke("minimize"),
    close_window: () => ipcRenderer.invoke("close"),
    check_folder_permissions: (folder) => check_folder_permissions(folder),
    save_collection_file: async (buffer, _path) => {

        // @TODO: only allow some paths
        const base = await get_from_database("config", "stable_path");

        if (!_path) {
            const backup_name = `collection_backup_${Date.now()}.db`;
            const old_name = path.resolve(base, "collection.db"), 
                new_name = path.resolve(base, backup_name);

            if (fs.existsSync(old_name)) {
                fs.renameSync(old_name, new_name);
            }

            fs.writeFileSync(old_name, Buffer.from(buffer));
        } else {
            fs.writeFileSync(_path, Buffer.from(buffer));
        }
    },
    get_osu_file: (file) => {

        console.log("osu file", file);

        const ext = path.extname(file);

        if (ext != ".osu") {
            return null;
        }

        return fs.readFileSync(file, "utf-8");
    },
    get_osu_files: async () => {
        const base = await get_from_database("config", "stable_path");
        const db_file = fs.readFileSync(path.join(base, "osu!.db"));
        const cl_file = fs.readFileSync(path.join(base, "collection.db"));
        return { db: db_file, cl: cl_file };
    }
});
