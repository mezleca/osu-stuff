<script>
	import { fade } from "svelte/transition";

	// icons
	import X from "../icon/x.svelte";
	import { notifications_store, remove_notification } from "../../lib/store/notifications";
</script>

<div class="notification-container">
	{#each $notifications_store as notification}
		<div class="notification default {notification.type}" transition:fade>
			<h2>{notification.text}</h2>
			<button class="notification close" id={notification.id} onclick={() => remove_notification(notification.id)}>
				<X />
			</button>
		</div>
	{/each}
</div>
