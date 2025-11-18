<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import LoginDialog from "$lib/components/buss/login/login-dialog.svelte";

	let showLoginDialog = $state(false);
</script>

<div class="gap-settings-gap flex flex-col">
	<Label id="account" class="text-label-fg">{m.login_account_management()}</Label>
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

<LoginDialog bind:open={showLoginDialog} />
