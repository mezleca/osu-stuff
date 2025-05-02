import { core } from "../../manager/manager.js";
import { create_alert } from "../../popup/popup.js";
import { OSU_STATS_URL } from "../global.js";
import { indexed } from "./indexed_db.js";
import { create_auth, fetchstats } from "./process.js";

export const osu_login = async (id, secret) => {

    try {

        const form_data = new FormData();

        form_data.append("grant_type", 'client_credentials');
        form_data.append("client_id", id);
        form_data.append("client_secret", secret);
        form_data.append("scope", "public");
            
        const response = await fetch(`https://osu.ppy.sh/oauth/token`, { method: 'POST', body: form_data });
        const data = await response.json();

        if (response.status != 200) {
            create_alert("failed to login<br>make sure your osu_id/secret is valid", { type: "error", seconds: 10, html: true });
            return null;
        }
        
        return data;
    } catch(err) {
        console.log("[login] error:", err);
        return null;
    }
};

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

    const stats_data = await indexed.get("stats", "data");

    if (!stats_data) {
        core.progress.update("started osu!stats auth");
        const data = await create_auth(OSU_STATS_URL, "https://osustats.ppy.sh/");
        await indexed.save("stats", "data", data);
    }

    const url = `https://osustats.ppy.sh/apiv2/collection/${id}/download`;
    const collection_info = await fetch(`https://osustats.ppy.sh/apiv2/collection/${id}`);
    const file_data = await fetchstats(url, stats_data);

    if (file_data?.cookie) {
        create_alert("hmm, something went wrong...<br>if you're logging for the first time, try again", { type: "error", html: true });
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
