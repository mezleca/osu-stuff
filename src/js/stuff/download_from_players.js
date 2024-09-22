import { core } from "../utils/config.js";
import { add_alert } from "../popup/popup.js";
import { add_get_extra_info } from "../popup/popup.js";
import { add_collection_manager } from "../manager/manager.js";

export const url_is_valid = (url, hostname) => {

    try {
        
        const player_url = new URL(url);

        if (player_url.hostname != hostname) {
            console.log(player_url);
            return false;
        }

        if (!player_url.pathname.match(/\d+/g) && hostname == "osu.ppy.sh") {
            return false;
        }

        return true;

    } catch(err) {
        return false;
    }
};

const add_to_collection = async (maps, name, type) => {

    if (maps.length == 0) {
        console.log("no maps");
        return;
    }

    const collection_name = `!stuff - ${name} ${type}`;

    core.reader.collections.beatmaps.push({
        name: collection_name,
        maps: [...maps]
    });

    core.reader.collections.length = core.reader.collections.beatmaps.length;

    await add_collection_manager(maps, { name: collection_name });

    add_alert(`added ${name} ${type} to your collection!`, { type: "success" });
};

const fetch_maps = async (base_url, limit) => {

    const maps = [];  
    let offset = 0;

    if (!limit) {
        console.log("[ERROR] no maps to fetch");
        return;
    }

    for (let i = 0; i < limit; i++) {

        if (offset >= limit) {
            break;
        }

        const url = new URL(base_url);

        url.searchParams.append("limit", "50");
        url.searchParams.append("offset", offset.toString());

        const response = await fetch(url);
        const data = await response.json();

        for (let k = 0; k < data.length; k++) {

            const beatmap = data[k];

            if (!beatmap) {
                continue;
            }

            maps.push(beatmap);
        }
        
        offset += data.length;
    }

    return maps;
};

const get_player_info = async (name, method) => {

    if (!name) {
        return;
    }

    add_alert("searching player...");

    const data = {   
        method: "GET",
        headers: {
            'Authorization': `Bearer ${core.login.access_token}`
        }
    }

    const api_url = "https://osu.ppy.sh/api/v2";

    const default_response = await fetch(`${api_url}/users/${name}`, data);
    const default_data = await default_response.json();

    if (!default_data?.id) {
        console.log("player", name, "not found");
        return;
    }

    const extra_response = await fetch(`https://osu.ppy.sh/users/${default_data.id}/extra-pages/top_ranks?mode=osu`, data);
    const extra_data = await extra_response.json();
    
    if (!extra_data) {
        console.log("extra");
        return;
    }

    const method_is_valid = (name) => method == name || method == "all";

    const first_place_maps = extra_data.firsts.count && method_is_valid("first place") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/scores/firsts?mode=osu`, extra_data.firsts.count) : [];
    const best_performance_maps = extra_data.best.count && method_is_valid("best performance") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/scores/best?mode=osu`, extra_data.best.count) : [];
    const favourite_maps = default_data.favourite_beatmapset_count && method_is_valid("favourites") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/favourite`, default_data.favourite_beatmapset_count) : [];

    return {
        ...default_data,
        favourites: favourite_maps,
        first_place: first_place_maps,
        best_performance: best_performance_maps
    };
};

export const download_from_players = async (player, method) => {

    return new Promise(async (resolve, reject) => {

        const player_info = await get_player_info(player, method);

        if (!player_info) {
            add_alert("player", player, "not found");
            return;
        }

        const download_method = await add_get_extra_info([{
            type: "list",
            value: ["download", "add to collections", "both"],
            important: false,
            input_type: "url"
        }]);

        if (!download_method) {
            return reject();
        }

        const get_maps = () => {

            let maps = [];

            switch (method) {
                case "first place":
                    maps = [...player_info.first_place];
                    break;
                case "best performance":
                    console.log("appending best performance");
                    maps = [...player_info.best_performance];
                    break;
                case "favourites":
                    console.log("appending fav");
                    maps = [...player_info.favourites];
                    break;
                default:
                    maps = [...player_info.favourites, ...player_info.first_place, ...player_info.best_performance];
                    break;
            }

            if (!maps) {
                return;
            }
            
            return {
                md5: maps.flatMap((b) => b?.beatmap ? b.beatmap.checksum : b.beatmaps.map((b) => b.checksum)),
                id: maps.flatMap((b) => b?.beatmap ? b.beatmap.beatmapset_id : b.id)
            }
        };

        const maps = get_maps();

        if (!maps) {
            add_alert("found 0 beatmaps from", player);
            return reject();
        }

        if (download_method == "add to collections") {
            await add_to_collection(maps.md5, player, method == "all" ? "" : method);
            return resolve();
        }

        if (download_method == "both") {
            await add_to_collection(maps.md5, player, method == "all" ? "" : method);
        }

        resolve(maps.id.map((id) => { return { id: id } }));
    });
};