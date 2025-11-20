<script lang="ts">
	import LoginDialog from "$lib/components/buss/login/login-dialog.svelte";
	import RegisterDialog from "$lib/components/buss/login/register-dialog.svelte";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { ssoState } from "$lib/stores/sso-state.svelte";
	import { userState } from "$lib/stores/user-state.svelte";
	import { AlertCircle, ArrowRight, Check, Loader, LogIn, UserPlus, Zap } from "@lucide/svelte";

	let showLoginDialog = $state(false);
	let showRegisterDialog = $state(false);

	const handleSwitchToLogin = () => {
		showRegisterDialog = false;
		showLoginDialog = true;
	};
</script>

{#if !userState.isLoggedIn}
	<div class="gap-settings-gap flex flex-col">
		<Label class="text-label-fg">{m.login_account_management()}</Label>

		<!-- SSO Quick Login Card -->
		<button
			class="bg-settings-item-bg hover:bg-hover-2 group relative flex items-center gap-4 overflow-hidden rounded-xl border border-transparent p-4 text-left transition-all hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
			onclick={() => ssoState.login()}
			disabled={ssoState.isLoading}
		>
			<div
				class="rounded-lg p-2 transition-colors {ssoState.isSuccess
					? 'bg-green-500/10'
					: ssoState.hasError
						? 'bg-destructive/10'
						: 'bg-primary/10 group-hover:bg-primary/20'}"
			>
				{#if ssoState.isLoading}
					<Loader class="size-5 animate-spin text-primary" />
				{:else if ssoState.isSuccess}
					<Check class="size-5 text-green-600" />
				{:else if ssoState.hasError}
					<AlertCircle class="size-5 text-destructive" />
				{:else}
					<Zap class="size-5 text-primary" />
				{/if}
			</div>
			<div class="flex-1">
				<div class="font-medium leading-none">
					{#if ssoState.isLoading}
						{m.sso_logging_in()}
					{:else if ssoState.isSuccess}
						{m.sso_success()}
					{:else if ssoState.hasError}
						{m.sso_retry()}
					{:else}
						{m.sso_login()}
					{/if}
				</div>
				<div class="mt-1 text-xs text-muted-foreground">{m.sso_login_desc()}</div>
			</div>
			{#if !ssoState.isLoading}
				<ArrowRight
					class="size-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-50"
				/>
			{/if}
		</button>

		<!-- Login and Register Cards -->
		<div class="grid grid-cols-2 gap-3">
			<!-- Login Card -->
			<button
				class="bg-settings-item-bg hover:bg-hover-2 group relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border border-transparent p-4 text-left transition-all hover:border-border"
				onclick={() => {
					showLoginDialog = true;
				}}
			>
				<div class="bg-primary/10 rounded-lg p-2 transition-colors group-hover:bg-primary/20">
					<LogIn class="size-5 text-primary" />
				</div>
				<div>
					<div class="font-medium leading-none">{m.login_button()}</div>
					<div class="mt-1 text-xs text-muted-foreground line-clamp-1">
						{m.login_button_desc()}
					</div>
				</div>
				<ArrowRight
					class="absolute top-4 right-4 size-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-50"
				/>
			</button>

			<!-- Register Card -->
			<button
				class="bg-settings-item-bg hover:bg-hover-2 group relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border border-transparent p-4 text-left transition-all hover:border-border"
				onclick={() => {
					showRegisterDialog = true;
				}}
			>
				<div class="bg-primary/10 rounded-lg p-2 transition-colors group-hover:bg-primary/20">
					<UserPlus class="size-5 text-primary" />
				</div>
				<div>
					<div class="font-medium leading-none">{m.login_register_now()}</div>
					<div class="mt-1 text-xs text-muted-foreground line-clamp-1">
						{m.login_auto_register_hint()}
					</div>
				</div>
				<ArrowRight
					class="absolute top-4 right-4 size-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-50"
				/>
			</button>
		</div>
	</div>
{/if}

<LoginDialog bind:open={showLoginDialog} />
<RegisterDialog bind:open={showRegisterDialog} onSwitchToLogin={handleSwitchToLogin} />
