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

	// global audio object :)
	import { audio_data, radio_repeat, radio_random } from "../../store";

	// props
	let { 
		url = "",
		local = false,
		small = true,
		right = () => {}
	} = $props();

	let actual_url = $state(url);
	let current_time = $state("0:00");
	let song_length = $state("0:00");
	let progress_bar_width = $state(0);

	const get_audio = async (url) => {
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

		// check if got the audio
		if (data.status != 200) {
			console.log("failed to get audio:", data.error);
			return;
		}

		const audio_source = new Blob([data.data], { type: "audio/ogg " });
		return audio_source;
	};

	const handle_audio = async (url) => {
		// check if we're handling another one
		if ($audio_data.id && $audio_data.id != url) {
			$audio_data.id = null;
			$audio_data.obj.pause();
			$audio_data.playing = false;
		}

		// pause but dot reset the currentTime (i prefer this way)
		if ($audio_data.playing && $audio_data.id != null) {
			$audio_data.obj.pause();
			$audio_data.playing = false;
			return;
		}

		// if we're paused but already have a audio object just play again
		if (!$audio_data.playing && $audio_data.id != null) {
			$audio_data.obj.play();
			$audio_data.playing = true;
			return;
		}

		// otherwise just download the preview
		const buffer = await get_audio(url);

		if (!buffer) {
			return;
		}

		// update the old audio object with the new one
		$audio_data.obj = new Audio(window.URL.createObjectURL(buffer));
		$audio_data.obj.volume = 0.5;

		// reset
		$audio_data.obj.addEventListener("ended", () => {
			$audio_data.obj.pause();
			$audio_data.obj.currentTime = 0;
			$audio_data.playing = false;
		});

		$audio_data.obj.play();
		$audio_data.id = url;

		$audio_data.playing = true;
	};
</script>

{#if small}
	<div class="small-control">
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button class="small-control-icon" onclick={() => handle_audio(actual_url)}>
			{#if $audio_data?.playing && $audio_data?.id == actual_url}
				<Pause />
			{:else}
				<Play />
			{/if}
		</button>
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button class="small-control-icon" onclick={() => right(local ? "remove" : "add")}>
			{#if local}
				<X />
			{:else}
				<Cross />
			{/if}
		</button>
	</div>
{:else}
	<div class="big-control">
		<div class="progress-container">
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progress_bar_width}%;"></div>
			</div>
			<div class="time-display">
				<span style="font-size: 12px">{current_time}</span>
				<span style="font-size: 12px">{song_length}</span>
			</div>
			<div class="controls">
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div role="button" class="random" class:active={$radio_random} onclick={() => ($radio_random = !$radio_random)}>
					<RandomIcon />
				</div>
				<div class="main-audio-control">
					<div class="previous">
						<PreviousIcon />
					</div>
					{#if $audio_data?.playing && $audio_data?.id == actual_url}
						<Pause />
					{:else}
						<Play />
					{/if}
					<div class="next">
						<NextIcon />
					</div>
				</div>
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div role="button" class="repeat" class:active={$radio_repeat} onclick={() => ($radio_repeat = !$radio_repeat)}>
					<RepeatIcon />
				</div>
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
		background: var(--bg-tertiary);
		z-index: 3;
		opacity: 0;
		padding: 6px;
	}

	.small-control-icon:hover {
		transform: scale(1.05);
	}

	.big-control {
		display: grid;
		grid-template-rows: repeat(1fr, 2);
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

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent-color-half), var(--accent-color));
		border-radius: 3px;
		width: 0%;
		position: relative;
		transition: width 0.3s ease;
	}

	.time-display {
		display: flex;
		justify-content: space-between;
		color: rgba(255, 255, 255, 0.6);
		font-size: 13px;
		font-weight: 500;
	}

	.big-control .controls {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		margin-top: 15px;
	}

	.main-audio-control {
		display: flex;
		flex-direction: row;
		gap: 24px;
		will-change: transform;
		transition: all 0.1s;
	}

	.controls *:hover {
		transform: scale(1.05);
	}

	.controls .random.active,
	.controls .repeat.active {
		color: var(--accent-color);
	}
</style>
