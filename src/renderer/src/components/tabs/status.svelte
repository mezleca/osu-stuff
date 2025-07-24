<script>
    // icons
    import Pause from "../icon/pause.svelte";
    import Play from "../icon/play.svelte";
    import X from "../icon/x.svelte";
</script>

<div class="content tab-content" style="padding: 20px;">
    <div class="manager-content">
        <div class="download-container">
            <div class="download-info">
                <h1>name</h1>
            </div>
            <div class="download-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 40%;"></div>
                </div>
            </div>
            <div class="download-status">
                <p>downloading... <span>(0/0)</span></p>
            </div>
            <div class="download-actions">
                <button class="action">
                    <Pause />
                </button>
                <button class="action">
                    <X />
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .download-container {
        display: flex;
        flex-direction: column;
        padding: 16px;
        margin-bottom: 10px;
        background-color: var(--bg-status);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        border: 1px solid rgb(120, 120, 120, 0.15);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .download-container:hover {
        border-color: var(--accent-color);
    }

    .download-info {
        margin-bottom: 10px;
    }

    .download-info > h1 {
        font-size: 1.5em;
    }

    .download-status > p {
        font-size: 0.85em;
        color: var(--text-muted);
    }

    .progress-bar {
        width: 100%;
        height: 12px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        position: relative;
        cursor: pointer;
        margin-bottom: 10px;
        transition: height 0.1s ease;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-color-half), var(--accent-color));
        border-radius: 3px;
        width: 0%;
        position: relative;
        transition: width 0.15s ease;
        pointer-events: none;
    }

    button {
        background: none;
        border: none;
        transition: 0.1s all;
        border: none;
        padding: 8px 12px;
    }

    button:hover {
        background-color: rgb(20, 20, 20, 1);
        transform: scale(1.05);
    }

    .download-actions {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 6px;
        opacity: 1;
        transition: all 0.3s ease;
    }
</style>
