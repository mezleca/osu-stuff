<script lang="ts">
    import { fade } from "svelte/transition";
    import { click_notification, click_notification_action, notifications_store, remove_notification } from "../../lib/store/notifications";

    // icons
    import X from "../icon/x.svelte";
    import WarningIcon from "../icon/warning-icon.svelte";
    import SuccessIcon from "../icon/checkmark-icon.svelte";
    import Spinner from "../icon/spinner.svelte";

    const get_icon = (type: string, is_persist: boolean) => {
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

    const handle_on_click = (event: MouseEvent, id: string) => {
        event.stopPropagation();
        remove_notification(id);
    };

    const handle_notification_content_click = (event: MouseEvent, id: string) => {
        event.stopPropagation();
        click_notification(id);
    };

    const handle_action_click = (event: MouseEvent, notification_id: string, action_id: string) => {
        event.stopPropagation();
        click_notification_action(notification_id, action_id);
    };
</script>

<div class="notification-container">
    {#each $notifications_store as notification}
        <div class="notification {notification.type}" class:clickable={Boolean(notification.on_click)} transition:fade>
            <div class="notification-content">
                <svelte:component this={get_icon(notification.type, notification.persist)} />
                {#if notification.on_click}
                    <button class="notification-link" onclick={(event) => handle_notification_content_click(event, notification.id)}>
                        <h2 class="notification-text">{notification.text}</h2>
                    </button>
                {:else}
                    <h2 class="notification-text">{notification.text}</h2>
                {/if}
            </div>
            {#if notification.type == "confirm" && notification.actions && notification.actions.length > 0}
                <div class="notification-actions">
                    {#each notification.actions as action}
                        <button class="notification-action" onclick={(event) => handle_action_click(event, notification.id, action.id)}>
                            {action.label}
                        </button>
                    {/each}
                </div>
            {/if}
            <button class="close" id={notification.id} onclick={(event) => handle_on_click(event, notification.id)}>
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
        grid-template-columns: 1fr;
        align-items: flex-start;
        position: relative;
        min-width: 5em;
        max-width: 20em;
        margin-bottom: 10px;
        padding: 12px 38px 12px 12px;
        border-radius: 6px;
        background-color: var(--bg-color);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        pointer-events: auto;
        box-sizing: border-box;
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
    }

    .notification-content * {
        word-break: break-word;
        overflow-wrap: break-word;
        font-size: 0.9em;
        font-family: "Torus SemiBold";
        color: white;
    }

    .notification-text {
        white-space: pre-line;
        line-height: 1.3;
        margin: 0;
    }

    .notification-content :global(svg) {
        flex-shrink: 0;
    }

    .notification.error {
        border: 2px solid rgb(255, 66, 66);
    }

    .notification.info {
        border: 2px solid rgb(100, 180, 255);
    }

    .notification.success,
    .notification.default {
        border: 2px solid var(--accent-color);
    }
    .notification.warning {
        border: 2px solid rgb(255, 255, 95);
    }
    .notification.confirm {
        border: 2px solid rgb(255, 196, 102);
    }

    .close {
        position: absolute;
        top: 50%;
        right: 10px;
        transform: translateY(-50%);
        cursor: pointer;
        background: rgba(255, 255, 255, 0.08);
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        color: rgb(255, 255, 255);
        opacity: 0.95;
        z-index: 2;
    }

    .close :global(svg) {
        transform: scale(1.1);
    }

    .close:hover {
        background: rgba(255, 255, 255, 0.16);
    }

    .notification.clickable {
        cursor: pointer;
    }

    .notification-link {
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        cursor: pointer;
        text-align: left;
        width: 100%;
        display: block;
    }

    .notification-actions {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
        width: 100%;
    }

    .notification-action {
        background: transparent;
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 4px;
        padding: 4px 8px;
        font-family: "Torus SemiBold";
        font-size: 0.85em;
        cursor: pointer;
    }

    .notification-action:hover {
        border-color: rgba(255, 255, 255, 0.5);
    }
</style>
