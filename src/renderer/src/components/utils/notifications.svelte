<script>
    import { fade } from "svelte/transition";
    import { notifications_store, remove_notification } from "../../lib/store/notifications";

    // icons
    import X from "../icon/x.svelte";
    import WarningIcon from "../icon/warning-icon.svelte";
    import SuccessIcon from "../icon/checkmark-icon.svelte";
    import Spinner from "../icon/spinner.svelte";

    const get_icon = (type, is_persist) => {
        if (is_persist) return Spinner;

        // fallback to icon
        switch (type) {
            case "warning":
            case "error":
                return WarningIcon;
            case "success":
                return SuccessIcon;
            default:
                return SuccessIcon;
        }
    };
</script>

<div class="notification-container">
    {#each $notifications_store as notification}
        <div class="notification {notification.type}" transition:fade>
            <div class="notification-content">
                <svelte:component this={get_icon(notification.type, notification.persist)} />
                <h2>{notification.text}</h2>
            </div>
            <button class="notification close" id={notification.id} onclick={() => remove_notification(notification.id)}>
                <X />
            </button>
        </div>
    {/each}
</div>

<style>
    .notification-container {
        display: flex;
        align-items: flex-end;
        flex-direction: column;
        position: absolute;
        top: 9%;
        right: 10px;
        width: 80%;
        pointer-events: none;
        z-index: 9999;
    }

    .notification {
        display: grid;
        grid-template-columns: 90% 1fr;
        align-items: center;
        position: relative;
        min-width: 5em;
        max-width: 20em;
        margin-bottom: 10px;
        padding: 12px;
        border-radius: 6px;
        background-color: var(--bg-color);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        pointer-events: auto;
        box-sizing: border-box;
    }

    .notification-content {
        display: flex;
        align-items: center;
    }

    .notification-content * {
        word-break: break-word;
        white-space: normal;
        overflow-wrap: break-word;
        font-size: 0.9em;
        color: white;
    }

    .notification-content :global(svg) {
        margin-right: 10px;
    }

    .notification.error {
        border: 2px solid rgb(255, 66, 66);
    }

    .notification.success,
    .notification.default {
        border: 2px solid var(--accent-color);
    }
    .notification.warning {
        border: 2px solid rgb(255, 255, 95);
    }

    .notification .close {
        cursor: pointer;
        right: 0;
        background: none;
        padding: 0;
        border: none;
        color: rgb(255, 255, 255);
        max-width: fit-content;
        margin: 0;
    }

    .notification .close:hover {
        background: none;
        border: none;
    }
</style>
