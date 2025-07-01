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
	import { radio_repeat, radio_random, show_notification, preview_store, radio_store } from "../../store";
	import { reader } from "../../lib/reader/reader";

	// props
	export let beatmap = {};
	export let small = true;
	export let right = () => {};

	$: control = small ? preview_store : radio_store;
	$: ({ audio, playing, id: audio_id, progress, duration, progress_bar_width } = $control);

	let actual_url = `https://b.ppy.sh/preview/${beatmap?.beatmapset_id}.mp3`;
	let current_id = beatmap.md5;

	const get_audio = async (url) => {

		if (!small) {

			const audio_name = await reader.get_beatmap_audio(beatmap);
			
			if (!audio_name) {
				console.log("failed beatmap:", beatmap);
				show_notification({ type: "error", timeout: 2000, text: "failed to get beatmap audio location"});
				return;
			}

			const data = await fetch("media://" + encodeURIComponent(audio_name));
			
			if (data.status != 200) {
				console.log("failed audio:", audio_name, beatmap);
				show_notification({ type: "error", timeout: 2000, text: "failed to get beatmap audio"});
				return;
			}

			const buffer = await data.arrayBuffer();
			return new Blob([new Uint8Array(buffer)], { type: "audio/ogg" });
		}

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

	const handle_audio = async () => {

		// if same audio is playing, pause it
		if (playing && audio_id == current_id) {
			if (audio != null) {
				control.pause(audio);
			}
			return;
		}

		// resume
		if (!playing && audio_id == current_id) {
			control.play(audio);
			return;
		}

		// remove old audio to process new one
		if (audio != null) {
			control.remove(audio);
		}

		// load new audio
		const buffer = await get_audio(actual_url);

		if (!buffer) {
			console.log("failed to get buffer");
			return;
		}

		// create new audio object
		const new_audio = new Audio(window.URL.createObjectURL(buffer));
		// @TODO: volume slider
		new_audio.volume = 0.5;
		
		control.setup(current_id, new_audio);

		// play new song
		control.play(new_audio);
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
		<button class="small-control-icon" on:click={() => handle_audio()}>
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
				<button 
					class="control-btn random" 
					class:active={$radio_random} 
					on:click={() => ($radio_random = !$radio_random)}
				>
					<RandomIcon />
				</button>
				
				<div class="main-audio-control">
					<button class="control-btn previous">
						<PreviousIcon />
					</button>
					<button class="control-btn play-pause" on:click={() => handle_audio()}>
						{#if playing && audio_id == current_id}
							<Pause />
						{:else}
							<Play />
						{/if}
					</button>
					<button class="control-btn next">
						<NextIcon />
					</button>
				</div>
				
				<button 
					class="control-btn repeat" 
					class:active={$radio_repeat} 
					on:click={() => ($radio_repeat = !$radio_repeat)}
				>
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
		color: var(--accent-color);
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