<script lang="ts">
    export let location = "";
    export let title: string = "uhh";
    export let type: "openDirectory" | "openFile" = "openDirectory";
    export let callback: (location: string) => {} = null;

    const show_dialog = async () => {
        const dialog = await window.api.invoke("window:dialog", { title, properties: [type] });

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

<style>
    .file-input-display {
        background-color: var(--bg-color);
        border: 2px dashed var(--header-border-color);
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        transition: all var(--context-fade-delay) ease;
        cursor: pointer;
        position: relative;
        z-index: 1;
    }

    .file-input-wrapper:hover .file-input-display,
    .file-input-display:hover {
        border-color: var(--accent-color);
        background-color: var(--accent-color-half);
    }

    .file-input-display .text {
        color: #cccccc;
        font-size: 14px;
    }
</style>
