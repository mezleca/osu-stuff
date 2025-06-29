<script>
	export let location = "",
		type = "";

	const show_dialog = async () => {
		const dialog = await window.extra.dialog({
			title: "get file",
			properties: [type == "folder" ? "openDirectory" : "openFile"]
		});

		if (dialog.canceled) {
			return;
		}

		location = dialog.filePaths[0];
	};
</script>

<div class="file-input-wrapper">
	<input type="custom-file" class="file-input" on:click={show_dialog} />
	<div class="file-input-display">
		<div class="text">{location == "" ? "click to select" : location}</div>
	</div>
</div>
