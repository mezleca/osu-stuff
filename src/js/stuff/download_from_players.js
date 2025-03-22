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

const add_to_collection = async (maps, name, append) => {

    if (maps.length == 0) {
        console.log("[download from players] 0 maps to add");
        return;
    }

    console.log(maps);

    if (append) {

        const selected_name = get_selected_collection();

        if (!selected_name) {
            create_alert("huh");
            return;
        }

        const collection = core.reader.collections.beatmaps.get(selected_name);

        if (!collection) {
            create_alert("failed to get collection", { type: "error" });
            return;
        }

        const beatmaps = [...collection.maps, ...maps];
        await add_collection_manager(beatmaps, selected_name);
    } else {
        await add_collection_manager(maps, name);
        create_alert(`added ${name} to your collections!`, { type: "success" });
    }   
};

const fetch_maps = async (base_url, limit) => {

    const maps = [];  
    let offset = 0;

    if (!limit) {
        console.log("[download from players] 0 maps to fetch");
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

const get_player_info = async (options) => {

    const { player_name, beatmap_options, beatmap_status, difficulty_range } = options;

    if (!player_name) {
        return;
    }

    const fetch_data = {   
        method: "GET",
        headers: {
            'Authorization': `Bearer ${core.login.access_token}`
        }
    }

    const api_url = "https://osu.ppy.sh/api/v2";

    const default_response = await fetch(`${api_url}/users/${player_name}`, fetch_data);
    const default_data = await default_response.json();

    if (!default_data?.id) {
        console.log("[download from players] player", player_name, "not found");
        return;
    }

    const extra_response = await fetch(`https://osu.ppy.sh/users/${default_data.id}/extra-pages/top_ranks?mode=osu`, fetch_data);
    const extra_data = await extra_response.json();

    if (!extra_data) {
        return;
    }

    const option_is_valid = (name) => beatmap_options.includes(name) || beatmap_options.includes("all");
    const status_is_valid = (name) => beatmap_status.includes(name) || beatmap_status.includes("all");

    const first_place_maps = extra_data.firsts.count && option_is_valid("first place") ? 
        await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/scores/firsts?mode=osu`, extra_data.firsts.count, difficulty_range) : [];   
    const best_performance_maps = extra_data.best.count && option_is_valid("best performance") ? 
        await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/scores/best?mode=osu`, extra_data.best.count, difficulty_range) : [];
    const favourite_maps = default_data.favourite_beatmapset_count && option_is_valid("favourites") ? 
        await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/favourite`, default_data.favourite_beatmapset_count, difficulty_range) : [];
    const ranked = default_data.ranked_beatmapset_count && status_is_valid("ranked") && option_is_valid("created maps") ? 
        await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/ranked`, default_data.ranked_beatmapset_count, difficulty_range) : [];
    const loved = default_data.loved_beatmapset_count && status_is_valid("loved") && option_is_valid("created maps") ? 
        await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/loved`, default_data.loved_beatmapset_count, difficulty_range) : [];
    const pending = default_data.pending_beatmapset_count && status_is_valid("pending") && option_is_valid("created maps") ?  
        await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/pending`, default_data.pending_beatmapset_count, difficulty_range) : [];
    const graveyard = default_data.graveyard_beatmapset_count && status_is_valid("graveyard") && option_is_valid("created maps") ?  
        await fetch_maps(`https://osu.ppy.sh/users/${default_data.id}/beatmapsets/graveyard`, default_data.graveyard_beatmapset_count, difficulty_range) : [];

    const filter_beatmaps = (beatmaps) => {

        return beatmaps.filter((v) => {

            if (v?.beatmap?.difficulty_rating != undefined) {

                const b = v.beatmap;
                const status = b.status;
                
                if (!status_is_valid(status)) {
                    return false;
                }
                
                const sr = b.difficulty_rating;

                if (sr < difficulty_range.min || sr > difficulty_range.max) {
                    return false;
                }
                
                return true;
            }

            else if (v?.beatmaps != undefined) {

                const status = v.status;
                
                if (!status_is_valid(status)) {
                    return false;
                }
                
                const valid_sr = v.beatmaps.some(beatmap => {
                    const sr = beatmap.difficulty_rating;
                    return sr >= difficulty_range.min && sr <= difficulty_range.max;
                });
                
                return valid_sr;
            }

            else {

                const status = v?.status;
                
                if (!status_is_valid(status)) {
                    return false;
                }
                
                const sr = v?.difficulty_rating;
                
                if (sr == undefined || sr < difficulty_range.min || sr > difficulty_range.max) {
                    return false;
                }
                
                return true;
            }
        });
    };

    const all_beatmaps = new Set([
        ...first_place_maps,
        ...best_performance_maps,
        ...favourite_maps,
        ...ranked,
        ...loved,
        ...pending,
        ...graveyard
    ]);

    return {
        ...default_data,
        all_beatmaps: filter_beatmaps(Array.from(all_beatmaps.values())) // to make sure
    };
};

export const download_from_players = async (options) => {

    return new Promise(async (resolve, reject) => {

        let append = false;

        const { player_name } = options;
        const player_info = await get_player_info(options);

        if (!player_info) {
            create_alert(`player ${player_name} not found`);
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

            const beatmaps = player_info.all_beatmaps;

            if (beatmaps.length == 0) {
                create_alert("found 0 beatmaps");
                return reject();
            }
            
            return {
                md5: beatmaps.flatMap((b) => b?.beatmap ? b.beatmap.checksum : b.beatmaps.map((b) => b.checksum)),
                id: beatmaps.flatMap((b) => b?.beatmap ? b.beatmap.beatmapset_id : b.id)
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
            await add_to_collection(maps.md5, player_name, append);
            return resolve();
        }

        if (download_method == "both") {
            await add_to_collection(maps.md5, player_name, append);
        }

        const osu_beatmaps = Array.from(core.reader.osu.beatmaps.values());
        const missing_maps = maps.id.filter(id => !osu_beatmaps.find(b => b.beatmap_id == id));

        if (missing_maps.length == 0) {
            return reject("No beatmaps to download!");
        }

        resolve(missing_maps.map((id) => { return { id: id } }));
    });
};
