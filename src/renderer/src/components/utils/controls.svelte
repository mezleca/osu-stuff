<script>
	// control icons
	import Play from "../icon/play.svelte";
	import Pause from "../icon/pause.svelte";
	import X from "../icon/x.svelte";
	import Cross from "../icon/cross.svelte";
	import RandomIcon from "../icon/random-icon.svelte";
	import RepeatIcon from "../icon/repeat-icon.svelte";
	import NextIcon from "../icon/next-icon.svelte";
	import PreviousIcon from "../icon/previous-icon.svelte";
	import Volume from "../icon/volume.svelte";
	import VolumeMuted from "../icon/volume-muted.svelte";

	// stores
	import { radio_repeat, radio_random, get_audio_manager } from "../../lib/store/audio";
	import { get_beatmap_list } from "../../lib/store/beatmaps";
	import { config } from "../../lib/store/config";
	import { get_from_media } from "../../lib/utils/utils";
	import { get_beatmap_data } from "../../lib/utils/beatmaps";

	// props
	export let small = true;
	export let right = () => {};
	export let beatmap = null; // for preview (yeah...)

	const MANAGER_ID = small ? "preview" : "radio";
	const DEFAULT_VOLUME = 50;
	const PREVIEW_BASE_URL = "https://b.ppy.sh/preview/";
	const audio_manager = get_audio_manager(MANAGER_ID);
	const radio_list = get_beatmap_list("radio");

	// variables from current state
	const { beatmaps, index, selected, invalid_selected } = get_beatmap_list("radio");

	$: current_beatmap = small ? beatmap : $selected;
	$: current_id = current_beatmap?.md5;
	$: preview_url = `${PREVIEW_BASE_URL}${current_beatmap?.beatmapset_id}.mp3`;
	$: audio_state = $audio_manager;
	$: ({ audio, playing, id: audio_id, progress, duration, progress_bar_width } = audio_state);
	$: is_current_playing = playing && audio_id == current_id;

	let radio_volume = config.get("radio_volume") ?? DEFAULT_VOLUME;

	const create_audio_blob = async (beatmap, url) => {
		try {
			if (!small) {
				return await get_local_audio(beatmap);
			}
			return await get_preview_audio(url);
		} catch (err) {
			console.log("error creating audio blob:", err);
			return null;
		}
	};

	const get_local_audio = async (beatmap) => {
		const audio_url = beatmap?.audio_path;

		if (!audio_url) {
			show_notification({
				type: "error",
				timeout: 5000,
				text: "failed to get beatmap audio location"
			});
			return null;
		}

		const data = await get_from_media(audio_url);

		if (data.status != 200) {
			console.log("failed audio:", audio_url, beatmap);
			show_notification({
				type: "error",
				timeout: 5000,
				text: "failed to get beatmap audio"
			});
			return null;
		}

		const buffer = await data.arrayBuffer();
		return new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
	};

	const get_preview_audio = async (url) => {
		if (!url || url == "") {
			console.log("no url for preview");
			return null;
		}

		const data = await window.extra.fetch({
			url,
			headers: {
				Accept: "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5",
				"Sec-GPC": "1",
				"Sec-Fetch-Dest": "audio"
			}
		});

		if (data.status != 200) {
			console.log("failed to get preview audio:", data.error);
			return null;
		}

		return new Blob([data.data], { type: "audio/ogg" });
	};

	const setup_audio = async (beatmap, url) => {
		console.log("setup_audio", beatmap);
		const blob = await create_audio_blob(beatmap, url);

		if (!blob) {
			console.log("failed to get audio blob");
			return null;
		}

		const new_audio = new Audio(window.URL.createObjectURL(blob));
		new_audio.volume = radio_volume / 100;
		new_audio.preload = "auto";

		await audio_manager.setup(beatmap.md5, new_audio);
		return new_audio;
	};

	const play_audio = async (audio) => {
		// pause radio if playing preview
		if (small && get_audio_manager("radio").get_state().playing) {
			get_audio_manager("radio").pause_until(
				get_audio_manager("radio").get_state().audio, // pause current radio state
				() => !get_audio_manager("preview").get_state().playing // until our preview state finishes playing
			);
		}

		if (!small) {
			audio_manager.set_next(get_next_song);
		}

		await audio_manager.play(audio);
	};

	const get_next_song = async (direction = 0) => {
		if (small || $beatmaps.length == 0) {
			console.log("[controls] buffer.length == 0");
			return null;
		}

		// get new index/beatmap
		const current_index = $index;
		const next_idx = get_next_index(current_index, direction);
		const new_beatmap = await get_beatmap_data($beatmaps[next_idx]);

		if (!new_beatmap?.audio_path) {
			console.log("failed to get next song (invalid beatmap)", new_beatmap);
			return null;
		}

		// update selection if changed
		if (next_idx != current_index) {
			radio_list.select_beatmap(new_beatmap, next_idx);
		} else {
			await play_audio(audio);
			return;
		}

		const new_audio = await setup_audio(new_beatmap, `${PREVIEW_BASE_URL}${new_beatmap?.beatmapset_id}.mp3`);
		return { audio: new_audio, id: new_beatmap.md5 };
	};

	const get_next_index = (current_index, direction) => {
		let next_idx = 0;

		// if we have a invalid context (different list from the previous one where this md5 existed)
		// make it start from the beginning to prevent index errors
		if ($invalid_selected) {
			$invalid_selected = false;
			return next_idx;
		}

		if (direction == 1) {
			next_idx = current_index + 1; // next
		} else if (direction == -1) {
			next_idx = current_index - 1; // previous
		} else {
			if ($radio_repeat) {
				next_idx = current_index; // same index and remove repeat toggle
				$radio_repeat = false;
			} else if ($radio_random) {
				next_idx = Math.floor(Math.random() * $beatmaps.length);
			} else {
				next_idx = current_index + 1; // defaults to next
			}
		}

		// wrap around list
		if (next_idx >= $beatmaps.length) {
			next_idx = 0;
		} else if (next_idx < 0) {
			next_idx = $beatmaps.length - 1;
		}

		return next_idx;
	};

	const set_next_song = async (code) => {
		const data = await get_next_song(code);

		if (!data) {
			console.log(`failed to get ${code == 1 ? "next" : "previous"} song`);
			return;
		}

		await play_audio(data.audio);
	};

	const handle_audio = async () => {
		if (!current_id) {
			console.log("not playing cuz invalid index", current_id);
			return;
		}

		console.log("handle_audio:", "current_id=", current_id);

		// toggle play/pause if same track
		if (audio_id == current_id) {
			if (playing) {
				audio_manager.pause(audio);
			} else {
				await play_audio(audio);
			}
			return;
		}

		// cleanup previous audio
		if (audio) {
			audio_manager.remove(audio);
		}

		// setup new audio
		const new_audio = await setup_audio(current_beatmap, preview_url);

		if (!new_audio) {
			console.log("failed to setup audio for", current_beatmap);
			if (!small) set_next_song(1);
			return;
		}

		await play_audio(new_audio);
	};

	const get_perc = (event, max_value) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const percent = (event.clientX - rect.left) / rect.width;
		return { percent, current: percent * max_value };
	};

	const seek_audio = (event) => {
		if (!audio) return;
		const { percent, current } = get_perc(event, audio.duration);
		audio_manager.seek(audio, percent, current);
	};

	const update_volume = (event) => {
		const { current } = get_perc(event, 100);
		radio_volume = Math.round(current);

		if (audio) {
			audio_manager.set_volume(audio, radio_volume);
		}

		config.set("radio_volume", radio_volume);
	};

	// @TODO: use old value instead of hardcoded DEFAUT_VOLUME
	const toggle_mute = () => {
		radio_volume = radio_volume > 0 ? 0 : DEFAULT_VOLUME;
		audio_manager.set_volume(audio, radio_volume);
		config.set("radio_volume", radio_volume);
	};

	// event handlers
	const on_left_click = (event, callback) => {
		event.stopPropagation();
		if (callback) callback();
	};

	const on_right_click = (event) => {
		event.stopPropagation();
		if (right) right();
	};
</script>

{#if small}
	<div class="small-control">
		<button class="small-control-icon" on:click={(event) => on_left_click(event, handle_audio)}>
			{#if is_current_playing}
				<Pause />
			{:else}
				<Play />
			{/if}
		</button>
		<button class="small-control-icon" on:click={(event) => on_right_click(event)}>
			{#if current_beatmap?.local}
				<X />
			{:else}
				<Cross />
			{/if}
		</button>
	</div>
{:else}
	<div class="big-control">
		<div class="volume-container">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="volume-icon" on:click={toggle_mute}>
				{#if radio_volume != 0}
					<Volume />
				{:else}
					<VolumeMuted />
				{/if}
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="volume-bar" on:click={update_volume}>
				<div class="volume-fill" style="width: {radio_volume}%;"></div>
			</div>
		</div>

		<div class="progress-container">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="progress-bar" on:click={seek_audio}>
				<div class="progress-fill" style="width: {progress_bar_width}%;"></div>
			</div>

			<div class="time-display">
				<span>{progress}</span>
				<span>{duration}</span>
			</div>

			<div class="controls">
				<button class="control-btn random" class:active={$radio_random} on:click={() => ($radio_random = !$radio_random)}>
					<RandomIcon />
				</button>

				<div class="main-audio-control">
					<button class="control-btn previous" on:click={() => set_next_song(-1)}>
						<PreviousIcon />
					</button>
					<button class="control-btn play-pause" on:click={handle_audio}>
						{#if is_current_playing}
							<Pause />
						{:else}
							<Play />
						{/if}
					</button>
					<button class="control-btn next" on:click={() => set_next_song(1)}>
						<NextIcon />
					</button>
				</div>

				<button class="control-btn repeat" class:active={$radio_repeat} on:click={() => ($radio_repeat = !$radio_repeat)}>
					<RepeatIcon />
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.small-control {
		position: absolute;
		top: 10px;
		right: 10px;
		display: flex;
		gap: 6px;
		opacity: 1;
		transition: all 0.3s ease;
	}

	.small-control-icon {
		background: transparent;
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		z-index: 3;
		opacity: 0;
		padding: 6px;
	}

	.small-control-icon:hover {
		transform: scale(1.05);
		background-color: var(--header-bg-color);
	}

	.big-control {
		width: 100%;
	}

	.progress-container {
		width: 100%;
		padding: 24px;
		background: rgba(19, 19, 19, 0.8);
		border-radius: 4px;
	}

	.volume-container {
		position: relative;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background-color: rgba(19, 19, 19, 0.8);
		border-radius: 6px;
		width: fit-content;
		margin-bottom: 10px;
	}

	.volume-bar {
		width: 0;
		overflow: hidden;
		transition: width 0.3s ease;
		background-color: #444;
		height: 6px;
		border-radius: 3px;
	}

	.volume-container:hover .volume-bar {
		width: 120px;
	}

	.volume-icon {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		position: relative;
		cursor: pointer;
		margin-bottom: 12px;
		transition: height 0.1s ease;
	}

	.progress-fill,
	.volume-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent-color-half), var(--accent-color));
		border-radius: 3px;
		width: 0%;
		position: relative;
		transition: width 0.1s ease;
		pointer-events: none;
	}

	.time-display {
		display: flex;
		justify-content: space-between;
		color: rgba(255, 255, 255, 0.6);
		font-size: 12px;
		margin-bottom: 16px;
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}

	.control-btn {
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.control-btn:hover {
		transform: scale(1.05);
		color: white;
		background: rgba(255, 255, 255, 0.1);
	}

	.control-btn.active {
		background-color: var(--bg-tertiary);
	}

	.main-audio-control {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.play-pause {
		padding: 12px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 50%;
	}

	.play-pause:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.1);
	}
</style>
