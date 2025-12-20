<script lang="ts">
    import { onMount } from "svelte";
    import type { StarRatingFilter, ICollectionResult } from "@shared/types";
    import { show_notification } from "../../../lib/store/notifications";
    import { current_modal, ModalType } from "../../../lib/utils/modal";
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
    import CollectionCard from "../../cards/collection-card.svelte";

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

    // driver
    let target_driver = !!config.get("lazer_mode") ? "stable" : "lazer";
    let is_driver_loading = true;
    let is_target_initialized = false;

    // player
    let added_players: string[] = [];
    let player_input_value = "";
    let selected_bm_status: string[] = ["ranked"];
    let selected_bm_options: string[] = [];
    let bm_difficulty_range: StarRatingFilter = [0, 10];

    // selection
    let pending_collections: ICollectionResult[] = [];
    let selected_collections: string[] = [];

    const { authenticated } = config;

    const collection_options = ["osu!collector", "client", "file", "player"].map((option) => ({ label: option, value: option }));

    $: collection_label =
        collection_type == "player" ? "player name" : collection_type == "osu!collector" ? "collection name (optional)" : "collection name";

    const add_player = () => {
        if (!player_input_value || player_input_value.trim().length == 0) {
            return;
        }

        const name = player_input_value.trim();
        if (!added_players.includes(name)) {
            added_players = [...added_players, name];
        }
        player_input_value = "";
    };

    const remove_player = (name: string) => {
        added_players = added_players.filter((p) => p !== name);
    };

    const handle_legacy_import = async (location: string) => {
        fetching_status = "reading collection file...";
        const result = await get_legacy_collection_data(location);

        if (!result.success) {
            show_notification({ type: "error", text: "failed to read collection file" });
            fetching_status = "";
            return;
        }

        process_results(Array.from(result.data.values()));
    };

    const handle_osdb_import = async (location: string) => {
        fetching_status = "reading osdb file...";
        const result = await get_osdb_data(location);

        if (!result.success) {
            show_notification({ type: "error", text: "failed to read osdb file" });
            fetching_status = "";
            return;
        }

        const data = result.data.collections.map((c) => {
            const hashes = c.hash_only_beatmaps.length > 0 ? c.hash_only_beatmaps : c.beatmaps.map((b) => b.md5);
            return { name: c.name, beatmaps: hashes };
        });

        process_results(data);
    };

    const process_results = (results: ICollectionResult[]) => {
        // filter out collections that already exist
        const filtered = results.filter((c) => !collections.has(c.name));
        pending_collections = filtered;
        fetching_status = "";
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

            show_notification({ type: "success", text: `created ${collection_name}` });
            await collections.add_beatmaps(collection_name, hashes);

            cleanup();
        } catch (err) {
            show_notification({ type: "error", text: err as string });
        } finally {
            fetching_status = "";
        }
    };

    const handle_from_client = async () => {
        try {
            fetching_status = "fetching collections from client...";
            const data = await window.api.invoke("driver:get_collections", target_driver);
            process_results(data || []);
            is_client_fetched = true;
            is_fetching_client = false;
        } catch (err) {
            show_notification({ type: "error", text: "failed to fetch collections from client" });
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
            case "db":
                await handle_legacy_import(collection_location);
                break;
            case "osdb":
                await handle_osdb_import(collection_location);
                break;
            default:
                show_notification({ type: "error", text: "please use a valid collection file (.db or .osdb)" });
                return;
        }
    };

    const handle_from_collector = async () => {
        if (collection_url == "") {
            show_notification({ type: "error", text: "url is empty" });
            return;
        }

        try {
            fetching_status = "fetching collection...";

            const collection_data = await get_from_osu_collector(collection_url);

            if (!collection_data.success) {
                show_notification({ type: "error", text: "failed to get collection from: " + collection_url });
                return;
            }

            const { name, checksums } = collection_data.data;
            const new_name = string_is_valid(collection_input) ? collection_input : name;

            if (collections.get(new_name)) {
                show_notification({ type: "warning", text: new_name + " already exists!" });
                return;
            }

            fetching_status = "creating collection...";

            const create_result = await collections.create_collection(new_name);

            if (!create_result) {
                return;
            }

            show_notification({ type: "success", text: `created ${new_name}` });

            // this will not fail
            await collections.add_beatmaps(new_name, checksums);

            cleanup();
        } catch (err) {
            show_notification({ type: "error", text: err as string });
        } finally {
            fetching_status = "";
        }
    };

    const handle_driver_initialization = async () => {
        try {
            fetching_status = "initializing driver...";
            const result = await window.api.invoke("driver:initialize", false, target_driver);

            if (!result) {
                show_notification({ type: "error", text: "failed to start driver..." });
                return;
            }

            is_target_initialized = true;
            handle_from_client();
        } catch (err) {
            show_notification({ type: "error", text: err as string });
        } finally {
            fetching_status = "";
        }
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
            case "client":
                handle_from_client();
                break;
            default:
                show_notification({ type: "error", text: "unknown type" });
                break;
        }
    };

    const on_import_pending = async () => {
        try {
            if (selected_collections.length == 0) {
                show_notification({ type: "warning", text: "select at least one collection" });
                return;
            }

            fetching_status = "importing collections...";

            let import_count = 0;

            for (const name of selected_collections) {
                const collection = pending_collections.find((c) => c.name == name);

                if (!collection) {
                    continue;
                }

                const result = await collections.create_collection(collection.name);

                // if we fail, just send a notification
                // should be enough for now
                if (!result) {
                    show_notification({ type: "warning", text: `failed to create ${collection.name}...` });
                    continue;
                }

                // this cant fail btw
                await collections.add_beatmaps(collection.name, collection.beatmaps);
                import_count++;
            }

            if (!import_count) {
                show_notification({ type: "error", text: "couldn't import anything..." });
            } else {
                const suffix = import_count == 1 ? "" : "s";
                show_notification({ type: "success", text: `finished importing ${import_count} collection${suffix}` });
            }
        } catch (err) {
            show_notification({ type: "error", text: err as string });
        } finally {
            // just close the modal idc
            cleanup();
        }
    };

    const toggle_selection = (name: string) => {
        if (selected_collections.includes(name)) {
            selected_collections = selected_collections.filter((c) => c != name);
        } else {
            selected_collections = [...selected_collections, name];
        }
    };

    const toggle_all_selection = () => {
        if (selected_collections.length === pending_collections.length) {
            selected_collections = [];
        } else {
            selected_collections = pending_collections.map((c) => c.name);
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
        pending_collections = [];
        selected_collections = [];
        is_client_fetched = false;
        current_modal.set(ModalType.none);
    };

    let is_client_fetched = false;
    let is_fetching_client = false;

    $: {
        if (
            collection_type == "client" &&
            !is_client_fetched &&
            !is_fetching_client &&
            !is_driver_loading &&
            $current_modal == ModalType.get_collection
        ) {
            if (is_target_initialized) {
                is_fetching_client = true;
                handle_from_client();
            }
        }

        if (collection_type != "client") {
            is_client_fetched = false;
            if (pending_collections.length > 0) {
                pending_collections = [];
                selected_collections = [];
            }
        }

        if (collection_type == "player" && !$authenticated) {
            show_notification({ type: "warning", text: "this feature needs you to be authenticated" });
            collection_type = "osu!collector";
        }
    }

    onMount(() => {
        try {
            window.api.invoke("driver:is_initialized", target_driver).then((value: boolean) => {
                is_target_initialized = value;
            });
        } catch (err) {
            show_notification({ type: "error", text: err as string });
        } finally {
            is_driver_loading = false;
        }
    });
</script>

{#if $current_modal == ModalType.get_collection}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-container" onclick={cleanup}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
            {#if fetching_status != ""}
                <div class="spinner-overlay">
                    <Spinner />
                    <span>{fetching_status}</span>
                </div>
            {/if}

            {#if pending_collections.length > 0}
                <div class="pending-container">
                    <div class="header-row">
                        <h1 class="field-label">collections found</h1>
                        <button class="text-btn" onclick={toggle_all_selection}>
                            {selected_collections.length === pending_collections.length ? "unselect all" : "select all"}
                        </button>
                    </div>

                    <div class="collection-list">
                        {#each pending_collections as collection}
                            <CollectionCard
                                name={collection.name}
                                count={collection.beatmaps.length}
                                selected={selected_collections.includes(collection.name)}
                                on_select={() => toggle_selection(collection.name)}
                            />
                        {/each}
                    </div>

                    <div class="actions actions-separator">
                        <button class="primary-btn" onclick={on_import_pending}>import ({selected_collections.length})</button>
                        <button
                            onclick={() => {
                                pending_collections = [];
                                collection_type = "osu!collector";
                                is_client_fetched = false;
                            }}>back</button
                        >
                    </div>
                </div>
            {:else if collection_type == "client" && is_client_fetched && pending_collections.length == 0 && fetching_status == ""}
                <div class="empty-state">
                    <span>0 collections found :(</span>
                    <button
                        class="text-btn"
                        onclick={() => {
                            collection_type = "osu!collector";
                            is_client_fetched = false;
                        }}>back</button
                    >
                </div>
            {:else}
                <div class="form-container">
                    {#if collection_type != "file" && collection_type != "player" && collection_type != "client"}
                        <Input label={collection_label} bind:value={collection_input} />
                    {/if}

                    <Dropdown label={"type"} inline={false} bind:selected_value={collection_type} options={collection_options} />

                    {#if collection_type == "client"}
                        {#if is_driver_loading}
                            <div class="inline-spinner">
                                <Spinner />
                                <span>getting data from driver...</span>
                            </div>
                        {:else if !is_target_initialized}
                            <div class="driver-init">
                                <span>{target_driver} client is not initialized yet</span>
                                <button class="accent-btn" onclick={() => handle_driver_initialization()}>initialize</button>
                            </div>
                        {/if}
                    {/if}

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
                        <button class="primary-btn" onclick={on_submit}>submit</button>
                        <button onclick={on_cancel}>cancel</button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .form-container,
    .pending-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .spinner-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10;
        backdrop-filter: blur(4px);
    }

    .inline-spinner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }

    .player-input-row {
        display: grid;
        grid-template-columns: 1fr 48px;
        gap: 10px;
    }

    .add-button {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--bg-secondary);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        transition: all 0.2s;
        cursor: pointer;
    }

    .add-button:hover {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
        transform: scale(1.05);
    }

    .added-players {
        display: flex;
        flex-wrap: wrap;
        margin-top: 10px;
        gap: 8px;
    }

    .player-chip {
        display: flex;
        padding: 6px 14px;
        background-color: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .player-chip:hover {
        background-color: #ff4444;
        border-color: #ff4444;
        transform: translateY(-1px);
    }

    .driver-init {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
    }
</style>
