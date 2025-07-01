<script>
	import { onMount } from "svelte";
	import { config } from "../../store";
	import { get_collections } from "../../lib/collections";

	// components
	import Add from "../utils/add.svelte";
	import InputDialog from "../utils/input-dialog.svelte";

	let osu_id;
	let osu_secret = "";
	let stable_path = "";
	let lazer_path = "";
	let stable_songs_path = "";
	let lazer_mode = false;
	let local_images = false;
	let initialized = false;

	const save_config = (key, value) => {
		if (initialized && value != $config[key]) {
			config.set(key, value);
		}
	};

	$: if (osu_id) save_config("osu_id", osu_id);
	$: if (osu_secret) save_config("osu_secret", osu_secret);
	$: if (stable_path) save_config("stable_path", stable_path);
	$: if (lazer_path) save_config("lazer_path", lazer_path);
	$: if (stable_songs_path) save_config("stable_songs_path", stable_songs_path);
	$: if (lazer_mode != undefined) save_config("lazer_mode", lazer_mode);
	$: if (local_images != undefined) save_config("local_images", local_images);

	// update values on start
	onMount(() => {
		osu_id = $config.osu_id || "";
		osu_secret = $config.osu_secret || "";
		stable_path = $config.stable_path || "";
		lazer_path = $config.lazer_path || "";
		stable_songs_path = $config.stable_songs_path || "";
		lazer_mode = $config.lazer_mode == true || $config.lazer_mode == "true";
		local_images = $config.local_images == true || $config.local_images == "true";
		initialized = true;
	});

	// @TODO: confirm popup if we're about to discard changes
	const load_files = async () => {
		await get_collections();
	};
</script>

<div class="content tab-content">
	<Add />
	<div class="config-content">
		<div class="config-fields">
			<div class="field-group" id="osu_id">
				<label class="field-label" for="osu_id_input">osu! id</label>
				<div class="field-description">
					create a new OAuth application <a
						href="https://osu.ppy.sh/home/account/edit#new-oauth-application"
						target="_blank"
						rel="noopener noreferrer">here</a
					> and paste the ID below
				</div>
				<input id="osu_id_input" type="password" class="text-input" placeholder="ex: 123" bind:value={osu_id} />
			</div>

			<div class="field-group" id="osu_secret">
				<label class="field-label" for="osu_secret_input">osu! secret</label>
				<div class="field-description">
					create a new OAuth application <a
						href="https://osu.ppy.sh/home/account/edit#new-oauth-application"
						target="_blank"
						rel="noopener noreferrer">here</a
					> and paste the SECRET below
				</div>
				<input id="osu_secret_input" type="password" class="text-input" placeholder="ex: 123" bind:value={osu_secret} />
			</div>

			<div class="field-group" id="stable_path">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="field-label">osu stable path</label>
				<div class="field-description">click to select your osu! stable path</div>
				<InputDialog bind:location={stable_path} type="folder" />
			</div>

			<div class="field-group" id="lazer_path">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="field-label">osu lazer path</label>
				<div class="field-description">click to select your osu! lazer path</div>
				<InputDialog bind:location={lazer_path} type="folder" />
			</div>

			<div class="field-group" id="stable_songs_path">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="field-label">songs folder</label>
				<div class="field-description">click to select your osu! songs folder</div>
				<InputDialog bind:location={stable_songs_path} type="folder" />
			</div>

			<div class="field-group" id="lazer">
				<div class="checkbox-wrapper">
					<div class="checkbox">
						<input type="checkbox" id="lazer_checkbox" bind:checked={lazer_mode} />
						<div class="checkbox-custom"></div>
					</div>
					<label class="checkbox-text" for="lazer_checkbox">lazer mode</label>
				</div>
				<div class="field-description">enable to use your lazer collections / beatmaps</div>
			</div>

			<div class="field-group" id="local">
				<div class="checkbox-wrapper">
					<div class="checkbox">
						<input type="checkbox" id="local_checkbox" bind:checked={local_images} />
						<div class="checkbox-custom"></div>
					</div>
					<label class="checkbox-text" for="local_checkbox">use local beatmap images</label>
				</div>
				<div class="field-description">useful if you have no internet</div>
			</div>

			<button type="button" on:click={load_files}>reload files</button>
		</div>

		<div class="info-box">
			<div class="info-box-header">
				<div class="info-box-title">custom mirrors</div>
				<div class="info-box-subtitle">TODO</div>
			</div>
			<div class="info-box-stats">
				<div class="stat-item">
					<div class="stat-value">TODO</div>
					<div class="stat-label">TODO</div>
				</div>
				<div class="stat-item">
					<div class="stat-value">TODO</div>
					<div class="stat-label">TODO</div>
				</div>
			</div>
		</div>
	</div>
</div>