import { core } from "../config.js";

export const osu_fetch = async (url) => {
    try {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${core.login.access_token}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error("fetch failed:", error);
        return null;
    }
};

export const fetch_osustats = async (collection_url) => {

    const id = collection_url.split("/").find((v) => Number(v));

    if (!id) {
        create_alert("failed to get collection id", { type: "error" });
        return;
    }

    const stats_data = await get_from_database("stats", "data");

    if (!stats_data) {
        create_alert("please login on osustats before using that feature", { type: "warning" });
        const data = await window.electron.create_auth(OSU_STATS_URL, "https://osustats.ppy.sh/");
        await save_to_db("stats", "data", data);
    }

    const url = `https://osustats.ppy.sh/apiv2/collection/${id}/download`;
    const collection_info = await fetch(`https://osustats.ppy.sh/apiv2/collection/${id}`);
    const file_data = await window.electron.fetchstats(url, stats_data);

    if (file_data?.cookie) {
        create_alert("hmm, something went wrong...<br>if you're logging for the first time, try again", { type: "error" });
        return;
    }

    if (!file_data || !file_data.ok) {
        create_alert("failed to get collection", { type: "error" });   
        return;
    }

    const collection_data = await collection_info.json();
    const buffer = file_data.data;

    core.reader.set_buffer(buffer);

    const osdb_data = await core.reader.get_osdb_data();
    const all_hashes = [];
    const missing_beatmaps = osdb_data.collections.reduce((acc, c) => {
        for (let i = 0; i < c.beatmaps.length; i++) {
            const b = c.beatmaps[i];
            if (!core.reader.osu.beatmaps.has(b.md5)) {
                acc.push({ id: b.map_set_id, md5: b.md5 });
            }
            all_hashes.push(b.md5);
        }
        return acc;
    }, []);

    collection_data.name = collection_data.title;

    return { 
        maps: missing_beatmaps,
        c_maps: all_hashes,
        collection: collection_data
    }
};