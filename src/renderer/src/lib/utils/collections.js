import { get_beatmap_status_code, get_code_by_mode, osu_beatmaps } from "../store/beatmaps";
import { collections } from "../store/collections";
import { downloader } from "../store/downloader";
import { show_notification } from "../store/notifications";

export const get_osu_data = async (force) => {
    const collection_data = await window.osu.get_collections(force);

    if (!collection_data) {
        return;
    }

    const collections_array = Array.from(collection_data.collections.values());
    const version = collection_data.version;

    collections.set(collections_array);
    collections.set_version(version);

    const beatmaps_data = await window.osu.get_beatmaps(force);

    if (!beatmaps_data) {
        console.log("failed to initialize");
        return;
    }
};

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

const get_tournament_maps = async (id) => {
    const response = await window.fetch({ url: `https://osucollector.com/api/tournaments/${id}` });
    const data = response.json();

    const beatmaps = [],
        beatmapsets = [];
    const collection = {};
    const rounds = data.rounds;

    // get each round (nm, hr, dt, fm)
    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i].mods;

        // loop through each round
        for (let k = 0; k < round.length; k++) {
            // get all beatmaps from each round (and separate then into beatmap / beatmapset)
            round[k].maps.map((beatmap) => {
                const beatmapset = beatmap.beatmapset;

                // remove beatmapset from the beatmap object (to make it separate)
                delete beatmap.beatmapset;
                beatmap.beatmapset_id = beatmapset.id;

                beatmaps.push(beatmap);
                beatmapsets.push(beatmapset);
            });
        }
    }

    collection.name = data.name;
    collection.status = response.status;
    collection.beatmaps = beatmaps;
    collection.beatmapsets = beatmapsets;

    return collection;
};

export const get_from_osu_collector = async (url) => {
    if (url == "") {
        show_notification({ type: "error", text: "invalid url" });
        return;
    }

    const url_array = url.split("/");
    const collection_id = url_array.find((part) => Number(part));
    const collection_name = decodeURIComponent(url_array[url_array.length - 1].split("?")[0]).replace(/-/g, " ");

    if (!collection_id) {
        create_alert("invalid url", { type: "error" });
        return null;
    }

    const is_tournament = url_array.includes("tournaments");
    const collection_url = `https://osucollector.com/api/collections/${collection_id}/beatmapsv3?perPage=50`;

    const response = is_tournament ? await get_tournament_maps(collection_id) : await window.fetch({ url: collection_url });
    const collection_data = is_tournament ? response : response.json();

    if (response.status != 200) {
        create_alert("failed to get collection", { type: "error" });
        return null;
    }

    const beatmaps = new Map();
    const new_maps = collection_data.beatmaps.filter((c) => !osu_beatmaps.has(c.checksum));

    for (const b of new_maps) {
        if (beatmaps.has(b.id)) {
            continue;
        }

        const processed = { ...b };
        const extra = collection_data.beatmapsets.find((set) => set.id == b.beatmapset_id) || {};

        extra.beatmapset_id = extra.id;

        delete extra.checksum;
        delete extra.id;

        const mode = get_code_by_mode(processed.mode);

        Object.assign(processed, extra);

        // rename other keys
        for (const [old_key, new_key] of Object.entries(RENAME_MAP)) {
            const value = processed[old_key];
            if (value) {
                if (old_key == "difficulty_rating") {
                    // create 4 gamemodes sr shit
                    processed.star_rating = new Array(4).fill({ pair: [], nm: -1 });

                    // populate the current gamemode
                    processed.star_rating[mode] = {
                        nm: processed.difficulty_rating,
                        pair: [0, processed.difficulty_rating]
                    };
                } else {
                    processed[new_key] = value;
                }

                // remove old key
                delete processed[old_key];
            }
        }

        processed.status = get_beatmap_status_code(processed.status) || 0;
        processed.mode = mode;
        beatmaps.set(processed.difficulty_id, processed);
    }

    return {
        name: collection_name,
        beatmaps: Array.from(beatmaps.values()).filter((b) => b.beatmapset_id)
    };
};

export const download_missing_beatmaps = async (collection) => {
    const beatmaps = await window.osu.missing_beatmaps(collection.maps);

    if (beatmaps.length == 0) {
        show_notification({ type: "alert", text: "theres no missing beatmaps in this collection" });
        return;
    }

    downloader.add({ name: collection.name, beatmaps });
};
