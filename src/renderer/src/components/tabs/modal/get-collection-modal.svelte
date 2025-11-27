<script lang="ts">
    import type { StarRatingFilter } from "@shared/types";
    import { show_notification } from "../../../lib/store/notifications";
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { get_from_osu_collector, get_legacy_collection_data, get_osdb_data } from "../../../lib/utils/collections";
    import { get_player_data, type IPlayerOptions } from "../../../lib/utils/beatmaps";
    import { string_is_valid } from "../../../lib/utils/utils";

    import Input from "../../utils/basic/input.svelte";
    import Dropdown from "../../utils/basic/dropdown.svelte";
    import InputDialog from "../../utils/basic/input-dialog.svelte";
    import Buttons from "../../utils/basic/buttons.svelte";
    import RangeSlider from "../../utils/basic/range-slider.svelte";
    import { config } from "../../../lib/store/config";

    // general
    let collection_type = "osu!collector";
    let collection_input = "";

    // from osu!collector options
    let collection_url = "";

    // from file options
    let collection_location = "";

    // from player options
    let selected_bm_status: string[] = [];
    let selected_bm_options: string[] = [];
    let bm_difficulty_range: StarRatingFilter = [0, 10];

    let { authenticated } = config;

    const collection_options = ["osu!collector", "file", "player"].map((option) => ({ label: option, value: option }));
    // TOFIX:
    $: collection_label =
        collection_type == "player" ? "player name" : collection_type == "osu!collector" ? "collection name (optional)" : "collection name";

    const handle_legacy_import = async (location: string): Promise<boolean> => {
        const result = await get_legacy_collection_data(location);

        // TOFIX: why cant i access reason?
        if (!result.success) {
            //console.error(result.reason);
            return false;
        }

        for (const [_, collection] of result.data) {
            collections.add_pending({ ...collection, edit: false });
        }

        return true;
    };

    const handle_osdb_import = async (location: string): Promise<boolean> => {
        const result = await get_osdb_data(location);

        // TOFIX: why cant i access reason?
        if (!result.success) {
            //console.error(result.reason);
            return false;
        }

        for (const collection of result.data.collections) {
            const hashes: string[] = collection.hash_only_beatmaps;

            console.log(collection);

            // some collections doest have that
            if (hashes.length == 0) {
                hashes.push(...collection.beatmaps.map((b) => b.md5));
            }

            collections.add_pending({
                name: collection.name,
                beatmaps: collection.hash_only_beatmaps,
                edit: false
            });
        }

        return true;
    };

    const handle_from_player = async () => {
        if (selected_bm_options.length == 0) {
            show_notification({ type: "error", text: "no options selected for player" });
            return;
        }

        const joined_options = selected_bm_options.join(", ");
        const joined_status = selected_bm_status.join(", ");

        const player_options: IPlayerOptions = {
            player_name: collection_input,
            options: new Set(selected_bm_options),
            statuses: new Set(selected_bm_status),
            star_rating: { min: bm_difficulty_range[0], max: bm_difficulty_range[1] }
        };

        const result = await get_player_data(player_options);

        if (!result) {
            show_notification({ type: "error", text: "failed to get beatmap..." });
            return;
        }

        if (result.maps.length == 0) {
            show_notification({ type: "error", text: "found 0 beatmaps lol" });
            return;
        }

        // get hash list
        const hashes = result.maps.map((b) => b.md5).filter((b) => b != undefined);

        // get collection name
        const collection_name = string_is_valid(collection_input)
            ? collection_input
            : // fallback to custom collection name (64 char limit)
              `${collection_input} - ${joined_options} (${joined_status})`.substring(0, 64);

        // add new collection
        const create_result = await collections.create_collection(collection_name);

        if (!create_result) {
            return;
        }

        await collections.add_beatmaps(collection_name, hashes);

        cleanup();
    };

    const handle_import_collections = async () => {
        if (collection_location == "") {
            show_notification({ type: "error", text: "please select a collection first" });
            return;
        }

        // get file type
        const splitted = collection_location.split(".");
        const type = splitted[splitted.length - 1];

        if (type != "db" && type != "osdb") {
            show_notification({ type: "error", text: "please use a valid collection file (.db or .osdb)" });
            return;
        }

        switch (type) {
            case "db": {
                const result = await handle_legacy_import(collection_location);

                if (!result) {
                    show_notification({ type: "error", text: "failed to import legacy collection..." });
                    return;
                }

                break;
            }
            case "osdb":
                const result = await handle_osdb_import(collection_location);

                if (!result) {
                    show_notification({ type: "error", text: "failed to import osdb collection..." });
                    return;
                }

                break;
            default:
                show_notification({ type: "error", text: "please use a valid collection file (.db or .osdb)" });
                return;
        }

        cleanup();
        show_modal(ModalType.get_pending_collections);
    };

    const handle_from_collector = async () => {
        if (collection_url == "") {
            show_notification({ type: "error", text: "url vro..." });
            return;
        }

        const collection_data = await get_from_osu_collector(collection_url);

        if (!collection_data.success) {
            show_notification({ type: "error", text: "failed to get collection from: " + collection_url });
            return;
        }

        const { name, beatmaps, checksums } = collection_data.data;
        const new_name = string_is_valid(collection_input) ? collection_input : name;

        if (collections.get(new_name)) {
            show_notification({ type: "warning", text: new_name + " already exists!" });
            return;
        }

        // temp add to osu beatmaps store
        for (const _ of beatmaps) {
            await Promise.all(beatmaps.map((b) => window.api.invoke("driver:add_beatmap", b)));
        }

        const create_result = await collections.create_collection(new_name);

        if (!create_result) {
            return;
        }

        await collections.add_beatmaps(new_name, checksums);
        cleanup();
    };

    const on_submit = () => {
        switch (collection_type) {
            case "player":
                handle_from_player();
                break;
            case "file":
                handle_import_collections();
                break;
            case "osu!collector":
                handle_from_collector();
                break;
            default:
                show_notification({ type: "error", text: "unknown type :(" });
                break;
        }
    };

    const on_cancel = () => {
        cleanup();
    };

    const cleanup = () => {
        // restore local shit
        collection_type = "osu!collector";
        collection_input = "";
        collection_input = "";
        collection_location = "";
        selected_bm_status = [];
        selected_bm_options = [];
        bm_difficulty_range = [0, 10];

        // restore stores
        current_modal.set(ModalType.none);
    };

    // ensure we are authenticated
    $: if (collection_type == "player" && !$authenticated) {
        show_notification({ type: "warning", text: "this feature needs you to be authenticated" });
        collection_type = "osu!collector";
    }
</script>

{#if $current_modal == ModalType.get_collection}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            {#if collection_type != "file"}
                <Input label={collection_label} bind:value={collection_input} />
            {/if}

            <Dropdown label={"type"} bind:selected_value={collection_type} options={collection_options} />

            {#if collection_type == "osu!collector"}
                <Input label={"url"} bind:value={collection_url} />
            {/if}

            {#if collection_type == "file"}
                <InputDialog title={"collection file"} type={"openFile"} bind:location={collection_location} />
            {/if}

            {#if collection_type == "player"}
                <Buttons
                    row={true}
                    label="beatmap options"
                    options={["best performance", "first place", "favourites", "created maps"]}
                    bind:selected={selected_bm_options}
                />

                <Buttons
                    row={true}
                    label="beatmap status"
                    options={["graveyard", "wip", "pending", "ranked", "approved", "qualified", "loved"]}
                    bind:selected={selected_bm_status}
                />

                <RangeSlider label={"difficulty range"} min={0} max={10} value={bm_difficulty_range} />
            {/if}

            <div class="actions actions-separator">
                <button onclick={on_submit}>submit</button>
                <button onclick={on_cancel}>cancel</button>
            </div>
        </div>
    </div>
{/if}
