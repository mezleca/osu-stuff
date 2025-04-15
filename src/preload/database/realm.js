const Realm = require("realm");

import { get_schema } from "../schema/lazer.js";

const instances = new Map();

export const realm = {
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

        if (!realm) {
            return [];
        }

        return instances.get(realm).objects(schema).toJSON();
    },
    update_collection: (realm, _uuid, name, maps) => {

        const uuid = _uuid ? new Realm.BSON.UUID(Buffer.from(_uuid.buffer)) : null;
        const result = { new: false, id: uuid };

        const instance = instances.get(realm);
        const exists = uuid ? instance.objectForPrimaryKey("BeatmapCollection", uuid) : null;
                        
        instance.write(() => {
            
            try {

                if (exists == null) {

                    const id = new Realm.BSON.UUID();
                    result.id = id;
                    result.new = true;
                    
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

            } catch(err) {
                console.log("write error", err);
            }
        });

        return result;
    },
    delete_collection: (realm, uuid) => {

        const instance = instances.get(realm);

        instance.write(() => {
            const collection = instance.objectForPrimaryKey("BeatmapCollection", new Realm.BSON.UUID(Buffer.from(uuid.buffer)));
            instance.delete(collection);
        });
    },
    close: (realm) => {

        if (realm) {
            instances.get(realm).close();
        }

        instances.delete(realm);
    },
}
