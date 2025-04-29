import { core } from "../app.js";
import { downloader } from "../utils/downloader/client.js";
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

    if (append) {

        const { name: selected_name } = get_selected_collection();

        if (!selected_name) {
            core.progress.update("failed to get collection name");
            return;
        }

        const collection = core.reader.collections.beatmaps.get(selected_name);

        if (!collection) {
            core.progress.update("failed to get collection");
            return;
        }

        const beatmaps = [...collection.maps, ...maps];
        await add_collection_manager(beatmaps, selected_name);
    } else {
        await add_collection_manager(maps, name);
        create_alert(`added ${name}!`, { type: "success" });
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

    const option_is_valid = (name) => beatmap_options.has(name) || beatmap_options.has("all");
    const status_is_valid = (name) => beatmap_status.has(name) || beatmap_status.has("all");

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

    let append = false;

    const { players } = options;
    const data = [];

    for (const player of players) {

        core.progress.update(`fething data from ${player}...`);

        const req = await get_player_info({ ...options, player_name: player });

        if (!req) {
            create_alert(`failed to find ${player}`, { type: "warning" });
            continue;
        }

        data.push(req);
    }

    if (data.length == 0) {
        create_alert("couldn't find anyone :(", { type: "warning" });
        return;
    }

    const download_options = await create_custom_popup({
        type: message_types.CUSTOM_MENU,
        title: "options",
        elements: [
            {
                key: "collection name",
                element: { input: { value: Array.from(players).join(", ") } }
            },
            {
                key: "method",
                element: { list: ["download", "add to collections", "both"] }
            }
        ]
    });

    const get_maps = () => {

        const beatmaps = data.map((d) => d.all_beatmaps);

        if (beatmaps.length == 0) {
            create_alert("found 0 beatmaps");
            return;
        }

        const result = beatmaps[0].flatMap((b) => {
            if (b?.beatmap) {
                return [{ 
                    checksum: b.beatmap.checksum, 
                    id: b.beatmap.beatmapset_id 
                }];
            } else {
                return b.beatmaps.map((bm) => ({
                    checksum: bm.checksum,
                    id: b.id
                }));
            }   
        });

        return result;
    };

    const maps = get_maps();
    const { name: current_collection } = get_selected_collection();
    
    // cancelled
    if (!download_options) {
        return;
    }

    const { method, collection_name } = download_options;

    if (!method) {
        return;
    }

    if (method == "add to collections" || method == "both") {      
        if (current_collection) {
            const confirmation = await quick_confirm(`merge with ${current_collection}?`);
            if (confirmation) {
                append = true;
            }
        }
    }

    // @TODO: rework this, i want the function get_maps to already return only missing and unique beatmaps
    const missing_maps = [];
    const md5_only = maps.map((m) => { 
        
        if (!core.reader.osu.beatmaps.get(m.checksum)) {
            missing_maps.push(m);
        }

        return m.checksum;
    });
    
    if (method == "add to collections") {
        await add_to_collection(md5_only, collection_name, append);
        return;
    }

    if (method == "both") {
        await add_to_collection(md5_only, collection_name, append);
    }

    if (missing_maps.length == 0) {
        create_alert("no beatmaps to download!", { type: "warning" });
        return;
    }

    if (!core.login?.access_token) {
        create_alert("no osu_id / secret configured :c", { type: "error" });
        return;
    }

    const unique = [
        ...new Map(missing_maps.map(m => [m.id, m])).values()
    ];

    // add download to the queue
    downloader.create_download({ id: crypto.randomUUID(), name: collection_name, maps: unique });
};
