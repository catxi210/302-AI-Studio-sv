<script lang="ts">
	import { API_BASE_URL } from "$lib/constants/api";
	import { m } from "$lib/paraglide/messages.js";

	let { code = $bindable("") } = $props();

	let timestamp = $state(Date.now());
	let imgElement: HTMLImageElement | null = $state(null);
	let initialized = $state(false);

	function generateRandomString(length: number = 12): string {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	function generateCode() {
		timestamp = Date.now();
		const randomStr = generateRandomString(12);
		code = `${randomStr}-${timestamp}`;
		console.log("Generated code:", code);
	}

	const imgSrc = $derived(`${API_BASE_URL}/proxy/static/image?code=${code}`);

	$effect(() => {
		if (!initialized) {
			initialized = true;
			generateCode();
		}
	});
</script>

<button
	type="button"
	class="relative h-9 w-24 overflow-hidden rounded-md border bg-muted"
	onclick={generateCode}
	title={m.captcha_click_to_refresh()}
>
	{#if code}
		<img
			bind:this={imgElement}
			src={imgSrc}
			alt={m.captcha_alt()}
			class="h-full w-full cursor-pointer object-cover"
		/>
	{/if}
</button>
