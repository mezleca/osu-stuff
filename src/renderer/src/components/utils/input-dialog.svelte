<script>
    export let location = "";
    export let type = "folder";
    export let callback = null;

    const show_dialog = async () => {
        const dialog = await window.extra.dialog({
            title: "get file",
            properties: [type == "folder" ? "openDirectory" : "openFile"]
        });

        if (dialog.canceled) {
            return;
        }

        location = dialog.filePaths[0];
        if (callback) callback(location);
    };
</script>

<div class="file-input-wrapper">
    <input type="custom-file" class="file-input" onclick={show_dialog} />
    <div class="file-input-display">
        <div class="text">{location == "" ? "click to select" : location}</div>
    </div>
</div>
