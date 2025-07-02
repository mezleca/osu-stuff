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

	// stores
	import { radio_repeat, radio_random, show_notification, preview_store, radio_store, radio_selected } from "../../store";
	import { reader } from "../../lib/reader/reader";
	import { get_from_media } from "../../lib/utils";

	// props
	export let beatmap = {};
	export let small = true;
	export let right = () => {};

	$: control = small ? preview_store : radio_store;
	$: ({ audio, playing, id: audio_id, progress, duration, progress_bar_width } = $control);

	let actual_url = `https://b.ppy.sh/preview/${beatmap?.beatmapset_id}.mp3`;
	let current_id = beatmap.md5;

	const get_audio = async (beatmap, url) => {
		if (!small) {
			const audio_name = await reader.get_beatmap_audio(beatmap);

			if (!audio_name) {
				show_notification({ type: "error", timeout: 2000, text: "failed to get beatmap audio location" });
				return;
			}
			
			const data = await get_from_media(audio_name);

			if (data.status != 200) {
				console.log("failed audio:", audio_name, beatmap);
				show_notification({ type: "error", timeout: 2000, text: "failed to get beatmap audio" });
				return;
			}

			const buffer = await data.arrayBuffer();
			return new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
		}

		// make sure the preview url is present
		if (url == "") {
			return;
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
			console.log("failed to get audio:", data.error);
			return;
		}

		return new Blob([data.data], { type: "audio/ogg" });
	};

	const setup_audio = async (beatmap, url) => {
		console.log("gettign new audio from", url);
		// load new audio
		const buffer = await get_audio(beatmap, url);

		if (!buffer) {
			console.log("failed to get buffer from", url);
			return;
		}

		// create new audio object
		const new_audio = new Audio(window.URL.createObjectURL(buffer));
		// @TODO: volume slider
		new_audio.volume = 0.5;

		return new_audio;
	};

	const play_audio = (audio) => {
		// temp pause radio song if we're previewing something
		if (small && $radio_store.playing) {
			// @TODO: if we change tab without waiting the preview to finish or pausing the pause_until will not work
			radio_store.pause_until($radio_store.audio, () => !$preview_store.playing);
		}
		// set next song if possible
		control.set_next(get_next_song);
		control.play(audio);
	};

	// @TODO: messy
	const get_next_song = async (custom) => {
		if (small || $radio_selected.list.length == 0) {
			return null;
		}

		let next_idx = 0;

		// next song via button
		if (custom == 1) {
			next_idx = $radio_selected.index + 1;
		}
		// previous song via button
		else if (custom == -1) {
			next_idx = $radio_selected.index - 1;
		} else {
			// repeat one time
			if ($radio_repeat) {
				next_idx = $radio_selected.index;
				$radio_repeat = false;
			}
			// get random index
			else if ($radio_random) {
				next_idx = Math.floor(Math.random() * $radio_selected.list.length);
			}
			// next index
			else {
				next_idx = $radio_selected.index + 1;
			}
		}

		// wrap around list
		if (next_idx >= $radio_selected.list.length) {
			next_idx = 0;
		} else if (next_idx < 0) {
			next_idx = $radio_selected.list.length - 1;
		}

		// update selected beatmap
		const new_beatmap = $radio_selected.list[next_idx];

		// check if the beatmap is valid
		if (!new_beatmap?.downloaded) {
			console.log("failed to get next song (invalid beatmap)", new_beatmap);
			return null;
		}

		$radio_selected = { list: $radio_selected.list, beatmap: new_beatmap, index: next_idx };

		const new_audio = await setup_audio(new_beatmap, `https://b.ppy.sh/preview/${new_beatmap?.beatmapset_id}.mp3`);
		return { audio: new_audio, id: new_beatmap.md5 };
	};

	const set_next_song = async (code) => {
		const data = await get_next_song(code);

		if (!data) {
			console.log(`failed to get ${code == 1 ? "next" : "previous"} song`);
			return;
		}

		await control.setup(data.id, data.audio);
		play_audio(data.audio);
	};

	const handle_audio = async () => {
		if (!current_id) {
			console.log("not playing cuz invalid index", current_id);
			return;
		}

		// if same audio is playing, pause it
		if (playing && audio_id == current_id) {
			if (audio != null) {
				control.pause(audio);
			}
			return;
		}

		// resume
		if (!playing && audio_id == current_id) {
			play_audio(audio);
			return;
		}

		// remove old audio to process new one
		if (audio != null) {
			control.remove(audio);
		}

		const new_audio = await setup_audio(beatmap, actual_url);

		if (!new_audio) {
			console.log("failed to setup audio for", new_audio, beatmap);
			return;
		}

		control.setup(current_id, new_audio);

		// play new song
		play_audio(new_audio);
	};

	const seek_audio = (e) => {
		if (audio == null) {
			return;
		}

		const rect = e.currentTarget.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const new_time = percent * audio.duration;

		control.seek(audio, percent, new_time);
	};
</script>

{#if small}
	<div class="small-control">
		<button class="small-control-icon" on:click={handle_audio}>
			{#if playing && audio_id == current_id}
				<Pause />
			{:else}
				<Play />
			{/if}
		</button>
		<button class="small-control-icon" on:click={() => right(beatmap?.local ? "remove" : "add")}>
			{#if beatmap?.local}
				<X />
			{:else}
				<Cross />
			{/if}
		</button>
	</div>
{:else}
	<div class="big-control">
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
						{#if playing && audio_id == current_id}
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
		background-color: var(--bg-tertiary);
	}

	.big-control {
		width: 100%;
	}

	.progress-container {
		width: 100%;
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

	.progress-bar:hover {
		height: 8px;
	}

	.progress-fill {
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
