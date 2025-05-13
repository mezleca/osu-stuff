import { core } from "../manager/manager.js";
import { create_alert } from "../popup/popup.js";
import { Reader } from "../utils/reader/reader.js";
import { url_is_valid } from "./download_from_players.js";

const RENAME_MAP = {
    difficulty_rating: "star",
    hit_length: "length",
    version: "difficulty",
    id: "difficulty_id",
    checksum: "md5",
    accuracy: "od",
    drain: "hp",
    creator: "mapper"
};

const get_tournament_maps = async(id) => {

    const response = await fetch(`https://osucollector.com/api/tournaments/${id}`);
    const data = await response.json();

    const maps = [];
    const collection = {};
    const rounds = data.rounds;

    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i].mods;
        for (let k = 0; k < round.length; k++) {
            const mods = round[k].maps;
            maps.push(...mods);
        }
    }

    collection.name = data.name;
    collection.status = response.status;
    collection.beatmapsets = maps;

    return collection;
};

export const setup_collector = async (url) => {

    if (!core.login) {
        create_alert("forgot to configurate? :P");
        return null;
    }

    if (!url_is_valid(url, "osucollector.com")) {
        create_alert("invalid url", { type: "error" });
        return null;
    }

    const url_array = url.split("/");
    const collection_id = url_array.find(part => Number(part));
    const collection_name = decodeURIComponent(url_array[url_array.length - 1]).replace(/-/g, " ");
    
    if (!collection_id) {
        create_alert("invalid url", { type: "error" });
        return null;
    }

    const is_tournament = url_array.includes("tournaments");

    // @NOTE: pretty sure this is not supposed to return all of the beatmaps in 1 request
    // its prob gonna be fixed soon soo i will take a look later
    const collection_url = `https://osucollector.com/api/collections/${collection_id}/beatmapsv3?perPage=50`;

    core.progress.update(`fetching collection ${collection_name || collection_id}...`);
    
    const response = is_tournament ? await get_tournament_maps(collection_id) : await fetch(collection_url);
    const collection_data = is_tournament ? response : await response.json();

    if (response.status != 200) {
        create_alert("failed to get collection", { type: "error" });
        return null;
    }
    
    let new_maps = null;
    const collection_hashes = [...new Set(collection_data.beatmaps.map(b => b.checksum))];

    if (is_tournament) {
        new_maps = collection_data.beatmapsets.map((c) => { return { id: c.id, checksum: c.checksum } })
            .filter((c) => !core.reader.osu.beatmaps.get(c.checksum));
    } else {
        new_maps = collection_data.beatmaps.filter((c) => !core.reader.osu.beatmaps.get(c.checksum));
    }

    const unique = new Map();
    const KEYS_TO_DELETE = Object.keys(RENAME_MAP);

    for (const b of new_maps) {

        if (unique.has(b.id)) {
            continue;
        }
        
        const processed = {...b};

        if (!is_tournament) {

            const extra = collection_data.beatmapsets.find((set) => set.id == b.beatmapset_id) || {};
        
            extra.beatmapset_id = extra.id;
            
            delete extra.checksum;
            delete extra.id;
            
            Object.assign(processed, extra);
        }
        
        // rename other keys
        for (const [old_key, new_key] of Object.entries(RENAME_MAP)) {
            if (processed[old_key] != undefined) {
                processed[new_key] = processed[old_key];
            }
        }
        
        processed.status = Reader.get_beatmap_status_code(processed.status);

        // delete unused keys
        for (let i = 0; i < KEYS_TO_DELETE.length; i++) {
            delete processed[KEYS_TO_DELETE[i]];
        }

        unique.set(processed.difficulty_id, processed);
    }

    return {
        name: collection_name,
        maps: Array.from(unique.values()),
        c_maps: collection_hashes
    };
};