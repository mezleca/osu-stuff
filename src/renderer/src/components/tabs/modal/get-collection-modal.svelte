<script lang="ts">
    import type { StarRatingFilter } from "@shared/types";
    import { show_notification } from "../../../lib/store/notifications";
    import { current_modal, ModalType, show_modal } from "../../../lib/utils/modal";
    import { collections } from "../../../lib/store/collections";
    import { get_from_osu_collector, get_legacy_collection_data, get_osdb_data } from "../../../lib/utils/collections";
    import { get_player_data, type IPlayerOptions } from "../../../lib/utils/beatmaps";
    import { config } from "../../../lib/store/config";
    import { string_is_valid } from "../../../lib/utils/utils";

    import Input from "../../utils/basic/input.svelte";
    import Dropdown from "../../utils/basic/dropdown.svelte";
    import InputDialog from "../../utils/basic/input-dialog.svelte";
    import ChipSelect from "../../utils/basic/chip-select.svelte";
    import RangeSlider from "../../utils/basic/range-slider.svelte";

    // icons
    import CrossIcon from "../../../components/icon/cross.svelte";
    import Spinner from "../../icon/spinner.svelte";

    // general
    let collection_type = "osu!collector";
    let collection_input = "";
    let fetching_status = "";

    // osu!collector
    let collection_url = "";

    // file
    let collection_location = "";

    // player
    let added_players: string[] = [];
    let player_input_value = "";
    let selected_bm_status: string[] = ["ranked"];
    let selected_bm_options: string[] = [];
    let bm_difficulty_range: StarRatingFilter = [0, 10];

    let { authenticated } = config;

    const collection_options = ["osu!collector", "file", "player"].map((option) => ({ label: option, value: option }));

    $: collection_label =
        collection_type == "player" ? "player name" : collection_type == "osu!collector" ? "collection name (optional)" : "collection name";

    const add_player = () => {
        if (!player_input_value || player_input_value.trim().length == 0) return;

        const name = player_input_value.trim();
        if (!added_players.includes(name)) {
            added_players = [...added_players, name];
        }
        player_input_value = "";
    };

    const remove_player = (name: string) => {
        added_players = added_players.filter((p) => p !== name);
    };

    const handle_legacy_import = async (location: string): Promise<boolean> => {
        const result = await get_legacy_collection_data(location);

        if (!result.success) {
            return false;
        }

        for (const [_, collection] of result.data) {
            collections.add_pending({ ...collection, edit: false });
        }

        return true;
    };

    const handle_osdb_import = async (location: string): Promise<boolean> => {
        const result = await get_osdb_data(location);

        if (!result.success) {
            return false;
        }

        for (const collection of result.data.collections) {
            const hashes: string[] = collection.hash_only_beatmaps;

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

        // if user typed name but forgot to add, or just wants single user
        if (added_players.length == 0 && player_input_value.trim().length > 0) {
            added_players = [player_input_value.trim()];
        }

        if (added_players.length == 0) {
            show_notification({ type: "error", text: "add at least one player!" });
            return;
        }

        try {
            const joined_options = selected_bm_options.join(", ");
            const joined_status = selected_bm_status.join(", ");
            const joined_players = added_players.join(",");

            const player_options: IPlayerOptions = {
                player_name: joined_players,
                options: new Set(selected_bm_options),
                statuses: new Set(selected_bm_status),
                star_rating: { min: bm_difficulty_range[0], max: bm_difficulty_range[1] }
            };

            fetching_status = "fetching player data...";

            const result = await get_player_data(player_options);

            if (!result) {
                show_notification({ type: "error", text: "failed to get beatmaps..." });
                return;
            }

            if (result.maps.length == 0) {
                show_notification({ type: "error", text: "found 0 beatmaps" });
                return;
            }

            fetching_status = "creating collection / adding beatmaps";

            const hashes = result.maps.map((b) => b.md5).filter((b) => b != undefined);

            const collection_name = string_is_valid(collection_input)
                ? collection_input // fallback to generated name
                : `${
                      result.players.length == 1 ? result.players[0].username : result.players.map((p) => p.username).join(", ")
                  } - ${joined_options} (${joined_status})`.substring(0, 64);

            const create_result = await collections.create_collection(collection_name);

            if (!create_result) {
                return;
            }

            await collections.add_beatmaps(collection_name, hashes);

            cleanup();
        } catch (err) {
            show_notification({ type: "error", text: err as string });
        } finally {
            fetching_status = "";
        }
    };

    const handle_import_collections = async () => {
        if (collection_location == "") {
            show_notification({ type: "error", text: "please select a collection first" });
            return;
        }

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
            show_notification({ type: "error", text: "url is empty" });
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
                show_notification({ type: "error", text: "unknown type" });
                break;
        }
    };

    const on_cancel = () => {
        cleanup();
    };

    const cleanup = () => {
        collection_type = "osu!collector";
        collection_input = "";
        collection_location = "";
        selected_bm_status = ["ranked"];
        selected_bm_options = [];
        bm_difficulty_range = [0, 10];
        added_players = [];
        player_input_value = "";
        fetching_status = "";
        current_modal.set(ModalType.none);
    };

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
            {#if fetching_status != ""}
                <div class="spinner-container" onclick={(e) => e.stopPropagation()}>
                    <Spinner />
                    <span>{fetching_status}</span>
                </div>
            {:else}
                {#if collection_type != "file" && collection_type != "player"}
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
                    <div class="field-group">
                        <!-- svelte-ignore a11y_label_has_associated_control -->
                        <label class="field-label">player(s)</label>

                        <div class="player-input-row">
                            <Input placeholder={"username"} bind:value={player_input_value} on_submit={() => add_player()} />
                            <div class="add-button" onclick={() => add_player()}>
                                <CrossIcon />
                            </div>
                        </div>

                        {#if added_players.length > 0}
                            <div class="added-players">
                                {#each added_players as player}
                                    <div class="player-chip">
                                        <span onclick={() => remove_player(player)}>{player}</span>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <ChipSelect
                        label="beatmap options"
                        options={["best performance", "first place", "favourites", "created maps"]}
                        bind:selected={selected_bm_options}
                        columns={2}
                    />

                    <ChipSelect
                        label="beatmap status"
                        options={["graveyard", "wip", "pending", "ranked", "approved", "qualified", "loved"]}
                        bind:selected={selected_bm_status}
                        columns={4}
                    />

                    <RangeSlider label={"difficulty range"} min={0} max={10} value={bm_difficulty_range} />
                {/if}

                <div class="actions actions-separator">
                    <button onclick={on_submit}>submit</button>
                    <button onclick={on_cancel}>cancel</button>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .player-input-row {
        display: grid;
        grid-template-columns: 85% 1fr;
        gap: 6px;
    }

    .add-button {
        display: flex;
        flex-wrap: wrap;
        align-content: center;
        justify-content: center;
        padding: 8px 12px;
        background-color: #2a2a2a;
        border: 1px solid #444;
        width: 100%;
        height: 100%;
        border-radius: 6px;
        transition: all 0.15s;
        cursor: pointer;
    }

    .add-button:hover,
    .player-chip:hover {
        background-color: var(--accent-color);
    }

    .added-players {
        display: flex;
        flex-direction: row;
        margin-top: 4px;
        gap: 8px;
    }

    .player-chip {
        display: flex;
        width: max-content;
        flex-direction: row;
        justify-content: center;
        padding: 4px 6px;
        background-color: rgb(33, 33, 33);
        border: 1px solid #444;
        border-radius: 6px;
    }

    .player-chip > span {
        font-size: 13px;
    }
</style>
