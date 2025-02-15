import { core } from "../utils/config.js";
import { create_alert, create_custom_popup, message_types, quick_confirm } from "../popup/popup.js";
import { add_collection_manager, get_selected_collection } from "../manager/manager.js";

export const url_is_valid = (url, hostname) => {

    try {
        
        const player_url = new URL(url);

        if (player_url.hostname != hostname) {
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

const add_to_collection = async (maps, name, type, append) => {

    if (maps.length == 0) {
        console.log("no maps");
        return;
    }

    const collection_name = `!stuff - ${name} ${type}`;

    if (append) {

        const collection = core.reader.collections.beatmaps.find((e) => e.name == name);

        if (!collection) {
            create_alert("failed to get collection", { type: "error" });
            return;
        }

        collection.maps = [...collection.maps, ...maps];
        await add_collection_manager(collection.maps, name);
        return;
    }

    core.reader.collections.beatmaps.push({
        name: collection_name,
        maps: [...maps]
    });

    core.reader.collections.length = core.reader.collections.beatmaps.length;

    await add_collection_manager(maps, collection_name);
    create_alert(`added ${name} ${type} to your collections!`, { type: "success" });
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

    create_alert("searching player...");

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
        return;
    }

    const method_is_valid = (name) => method == name || method == "all";
    const maps_method_is_valid = (name) => method == name || method == "all maps" || method == "all";

    const first_place_maps = extra_data.firsts.count && method_is_valid("first place") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/scores/firsts?mode=osu`, extra_data.firsts.count) : [];
    const best_performance_maps = extra_data.best.count && method_is_valid("best performance") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/scores/best?mode=osu`, extra_data.best.count) : [];
    const favourite_maps = default_data.favourite_beatmapset_count && method_is_valid("favourites") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/favourite`, default_data.favourite_beatmapset_count) : [];

    const ranked = default_data.ranked_beatmapset_count && maps_method_is_valid("ranked") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/ranked`, default_data.ranked_beatmapset_count) : [];
    const loved = default_data.loved_beatmapset_count && maps_method_is_valid("loved") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/loved`, default_data.loved_beatmapset_count) : [];
    const pending = default_data.pending_beatmapset_count && maps_method_is_valid("pending") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/pending`, default_data.pending_beatmapset_count) : [];
    const graveyard = default_data.graveyard_beatmapset_count && maps_method_is_valid("graveyard") ? await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/graveyard`, default_data.graveyard_beatmapset_count) : [];

    return {
        ...default_data,
        favourites: favourite_maps,
        first_place: first_place_maps,
        best_performance: best_performance_maps,
        ranked: ranked,
        loved: loved,
        pending: pending,
        graveyard: graveyard
    };
};

export const download_from_players = async (player, method) => {

    return new Promise(async (resolve, reject) => {

        let append = false;

        if (method == "created maps") {

            const ranked = await create_custom_popup({
                type: message_types.CUSTOM_MENU,
                title: "method",
                elements: [{
                    key: "name",
                    element: { list: ["ranked", "loved", "pending", "graveyard", "all maps"] }
                }]
            });

            const ranked_method = ranked.name;

            if (!ranked_method) {
                return reject();
            }

            method = ranked_method;
        }

        const player_info = await get_player_info(player, method);

        if (!player_info) {
            create_alert(`player ${player} not found`);
            return;
        }

        const download = await create_custom_popup({
            type: message_types.CUSTOM_MENU,
            title: "method",
            elements: [{
                key: "name",
                element: { list: ["download", "add to collections", "both"] }
            }]
        });

        const download_method = download.name;

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
                    maps = [...player_info.best_performance];
                    break;
                case "favourites":
                    maps = [...player_info.favourites];
                    break;
                case "ranked":
                    maps = [...player_info.ranked];
                    break;
                case "loved":
                    maps = [...player_info.loved];
                    break;
                case "pending":
                    maps = [...player_info.pending];
                    break;
                case "graveyard":
                    maps = [...player_info.graveyard];
                    break;
                case "all maps":
                    maps = [...player_info.ranked, ...player_info.loved, 
                            ...player_info.pending, ...player_info.graveyard];
                    break;
                default:
                    maps = [...player_info.favourites, ...player_info.first_place, 
                            ...player_info.best_performance, ...player_info.ranked, 
                            ...player_info.loved, ...player_info.pending, ...player_info.graveyard];
                    break;
            }

            if (!maps) {
                create_alert("found 0 maps ;-;");
                return reject();
            }
            
            return {
                md5: maps.flatMap((b) => b?.beatmap ? b.beatmap.checksum : b.beatmaps.map((b) => b.checksum)),
                id: maps.flatMap((b) => b?.beatmap ? b.beatmap.beatmapset_id : b.id)
            }
        };

        const maps = get_maps();
        const current_collection = get_selected_collection(false);

        if (download_method == "add to collections" || download_method == "both") {
            
            if (current_collection) {
                const confirmation = await quick_confirm(`merge with ${current_collection}?`);
                if (confirmation) {
                    append = true;
                }
            }
        }
        
        if (download_method == "add to collections") {
            await add_to_collection(maps.md5, append ? current_collection : player, method == "all" ? "" : method, append);
            return resolve();
        }

        if (download_method == "both") {
            await add_to_collection(maps.md5, append ? current_collection : player, method == "all" ? "" : method, append);
        }

        const osu_beatmaps = Array.from(core.reader.osu.beatmaps.values());
        const missing_maps = maps.id.filter(id => !osu_beatmaps.find(b => b.beatmap_id == id));

        if (missing_maps.length == 0) {
            return reject("No beatmaps to download!");
        }

        resolve(missing_maps.map((id) => { return { id: id } }));
    });
};