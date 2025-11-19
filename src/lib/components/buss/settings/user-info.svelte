<script lang="ts">
	import * as Avatar from "$lib/components/ui/avatar";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages.js";
	import { userState } from "$lib/stores/user-state.svelte";

	const { userInfo, isLoggedIn } = $derived(userState.state);

	function handleLogout() {
		userState.logout();
	}
</script>

{#if isLoggedIn && userInfo}
	<div class="gap-settings-gap flex flex-col">
		<Label class="text-label-fg">{m.settings_user_info_label()}</Label>
		<div class="bg-settings-item-bg flex items-center gap-4 rounded-lg p-4">
			<!-- Avatar -->
			<Avatar.Root class="size-16">
				<Avatar.Image src={userInfo.avatar} alt={userInfo.user_name} />
				<Avatar.Fallback>{userInfo.user_name.slice(0, 2)}</Avatar.Fallback>
			</Avatar.Root>

			<!-- User Details -->
			<div class="flex-1 space-y-1">
				<div class="text-base font-semibold">{userInfo.user_name}</div>
				<div class="text-sm text-muted-foreground">
					{#if userInfo.email}
						{userInfo.email}
					{:else if userInfo.phone}
						{userInfo.phone}
					{:else}
						UID: {userInfo.uid}
					{/if}
				</div>
				<div class="text-xs text-muted-foreground">
					{m.settings_balance({ balance: userInfo.balance.toFixed(2) })}
				</div>
			</div>

			<!-- Logout Button -->
			<Button variant="outline" size="sm" onclick={handleLogout}>{m.settings_logout()}</Button>
		</div>
	</div>
{/if}
