<script>
	// control icons
	import Play from "../icon/play.svelte";
	import Pause from "../icon/pause.svelte";
	import X from "../icon/x.svelte";
	import Cross from "../icon/cross.svelte";

	// global global audio object :)
	import { audio_data } from "../../store";

	// props
	export let url = "",
		local = false,
		right = () => {};

	$: actual_url = url;

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

<div class="controls">
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<button class="control-icon" onclick={() => handle_audio(actual_url)}>
		{#if $audio_data?.playing && $audio_data?.id == actual_url}
			<Pause />
		{:else}
			<Play />
		{/if}
	</button>
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<button class="control-icon" onclick={() => right(local ? "remove" : "add")}>
		{#if local}
			<X />
		{:else}
			<Cross />
		{/if}
	</button>
</div>
