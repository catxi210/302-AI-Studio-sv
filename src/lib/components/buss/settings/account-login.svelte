<script lang="ts">
	import LoginDialog from "$lib/components/buss/login/login-dialog.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { userState } from "$lib/stores/user-state.svelte";

	let showLoginDialog = $state(false);
</script>

{#if !userState.isLoggedIn}
	<div class="gap-settings-gap flex flex-col">
		<Label class="text-label-fg">{m.login_account_management()}</Label>
		<div class="flex items-center gap-4">
			<Button
				variant="outline"
				onclick={() => {
					showLoginDialog = true;
				}}
			>
				{m.login_button()}
			</Button>
			<span class="text-sm text-muted-foreground">{m.login_button_desc()}</span>
		</div>
	</div>
{/if}

<LoginDialog bind:open={showLoginDialog} />
