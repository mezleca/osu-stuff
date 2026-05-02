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
            case "info":
                return Spinner;
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
        <div class="notification-shell" transition:fade>
            <div class="notification notification-main {notification.type}" class:clickable={Boolean(notification.on_click)}>
                <div class="notification-icon-rail">
                    <svelte:component this={get_icon(notification.type, notification.persist)} />
                </div>

                <div class="notification-body">
                    <div class="notification-content">
                        {#if notification.on_click}
                            <button class="notification-link" onclick={(event) => handle_notification_content_click(event, notification.id)}>
                                <h2 class="notification-text">{notification.text}</h2>
                            </button>
                        {:else}
                            <h2 class="notification-text">{notification.text}</h2>
                        {/if}
                    </div>
                </div>

                <button class="close" id={notification.id} onclick={(event) => handle_on_click(event, notification.id)}>
                    <X />
                </button>
            </div>

            {#if notification.actions && notification.actions.length > 0}
                <div
                    class="notification-actions"
                    class:two-actions={notification.actions.length >= 2}
                    class:one-action={notification.actions.length < 2}
                >
                    {#each notification.actions as action}
                        <button class="notification-action" onclick={(event) => handle_action_click(event, notification.id, action.id)}>
                            {action.label}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .notification-container {
        display: flex;
        align-items: flex-end;
        flex-direction: column;
        position: fixed;
        top: 9%;
        right: 10px;
        width: 80%;
        pointer-events: none;
        z-index: 100000;
    }

    .notification-shell {
        min-width: 5em;
        max-width: 20em;
        width: 100%;
        margin-bottom: 10px;
    }

    .notification {
        position: relative;
        padding: 12px;
        border-radius: 6px;
        background-color: var(--bg-color);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        pointer-events: auto;
        box-sizing: border-box;
    }

    .notification-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding-left: 30px;
        padding-right: 30px;
    }

    .notification-icon-rail {
        position: absolute;
        left: 10px;
        top: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
    }

    .notification-icon-rail :global(svg) {
        flex-shrink: 0;
    }

    .notification-content {
        display: flex;
        align-items: center;
        justify-content: flex-start;
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
        text-align: left;
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
        align-items: stretch;
        gap: 8px;
        margin-top: 6px;
        width: 100%;
        pointer-events: auto;
    }

    .notification-actions.one-action {
        flex-direction: column;
    }

    .notification-actions.two-actions {
        flex-direction: row;
        flex-wrap: nowrap;
    }

    .notification-actions.two-actions .notification-action {
        flex: 0 0 calc(50% - 4px);
        max-width: calc(50% - 4px);
    }

    .notification-action {
        display: block;
        appearance: none;
        width: 100%;
        background: var(--bg-color);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 6px 10px;
        font-family: "Torus SemiBold";
        font-size: 0.85em;
        cursor: pointer;
    }

    .notification-action:hover {
        background: var(--bg-color);
        border-color: rgba(255, 255, 255, 0.4);
    }
</style>
