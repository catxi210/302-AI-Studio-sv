<script lang="ts" module>
	export const sessionModeOptions = [
		{
			key: "new-agent",
			label: m.title_new_agent(),
			value: "new-agent",
		},
		{
			key: "select-existing-agent",
			label: m.title_select_existing_agent(),
			value: "select-existing-agent",
		},
	];
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";

	import { SettingSelect } from "$lib/components/buss/settings";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeAgentState } from "$lib/stores/code-agent";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { cn } from "$lib/utils";
	import { RefreshCcw } from "@lucide/svelte";
	import { onMount } from "svelte";

	let isSandboxesLoading = $state(false);
	let isSessionsLoading = $state(false);

	function handleSessionModeChange(sessionMode: "select-existing-agent" | "new-agent") {
		claudeCodeAgentState.sessionMode = sessionMode;
	}

	async function handleSelectSandbox(sandboxId: string) {
		claudeCodeAgentState.customSandboxId = sandboxId;
		await handleRefreshSessions(sandboxId);
	}

	async function handleRefreshSandboxes() {
		isSandboxesLoading = true;
		const success = await claudeCodeSandboxState.refreshSandboxes();
		if (success && claudeCodeAgentState.customSandboxId) {
			await handleRefreshSessions();
		}
		isSandboxesLoading = false;
	}

	async function handleRefreshSessions(sandboxId?: string) {
		isSessionsLoading = true;
		await claudeCodeSandboxState.refreshSessions(sandboxId ?? claudeCodeAgentState.customSandboxId);
		isSessionsLoading = false;
	}

	onMount(() => {
		const { currentSessionId, sandboxId } = claudeCodeAgentState;
		if (currentSessionId) {
			claudeCodeAgentState.customSessionId = currentSessionId;
		}
		if (sandboxId) {
			claudeCodeAgentState.customSandboxId = sandboxId;
		}
	});
</script>

{#snippet newAgentPanel()}
	<Label class="text-label-fg">{m.title_session_id()}</Label>
	<Input
		class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
		bind:value={claudeCodeAgentState.customSessionId}
		placeholder={m.title_custom_session_id()}
	/>
{/snippet}

{#snippet selectExistingAgentPanel()}
	<Label class="text-label-fg">{m.title_sandbox_id()}</Label>
	<div class="flex flex-row gap-2 items-center">
		<SettingSelect
			name="sandbox"
			value={claudeCodeAgentState.customSandboxId}
			options={claudeCodeSandboxState.sandboxes}
			placeholder={m.select_session()}
			onValueChange={(v) => {
				handleSelectSandbox(v);
			}}
		/>
		<ButtonWithTooltip
			class="hover:!bg-chat-action-hover"
			tooltip={m.label_button_reload()}
			onclick={handleRefreshSandboxes}
			disabled={isSandboxesLoading}
		>
			<RefreshCcw class={cn("h-4 w-4", isSandboxesLoading ? "animate-spin" : "")} />
		</ButtonWithTooltip>
	</div>
	<!-- <Input
		class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
		bind:value={claudeCodeAgentState.customSandboxId}
		placeholder={m.title_sandbox_id_to_be_associated()}
	/> -->
	<Label class="text-label-fg">{m.title_session_id()}</Label>
	<div class="flex flex-row gap-2 items-center">
		<SettingSelect
			name="session"
			value={claudeCodeAgentState.customSessionId}
			options={claudeCodeSandboxState.sessions}
			placeholder={m.select_session()}
			onValueChange={(v) => {
				claudeCodeAgentState.customSessionId = v;
			}}
		/>
		<ButtonWithTooltip
			class="hover:!bg-chat-action-hover"
			tooltip={m.label_button_reload()}
			onclick={() => handleRefreshSessions()}
			disabled={isSessionsLoading || !claudeCodeAgentState.customSandboxId}
		>
			<RefreshCcw class={cn("h-4 w-4", isSessionsLoading ? "animate-spin" : "")} />
		</ButtonWithTooltip>
	</div>
	<!-- <Input
		class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
		bind:value={claudeCodeAgentState.customSessionId}
		placeholder={m.title_session_id_to_be_associated()}
	/> -->
{/snippet}

<Label class="text-label-fg">{m.title_select_session()}</Label>
<SettingSelect
	name="sessionMode"
	value={claudeCodeAgentState.sessionMode}
	options={sessionModeOptions}
	placeholder={m.select_session()}
	onValueChange={(v) => handleSessionModeChange(v as "select-existing-agent" | "new-agent")}
/>

{#if claudeCodeAgentState.sessionMode === "select-existing-agent"}
	{@render selectExistingAgentPanel()}
{:else if claudeCodeAgentState.sessionMode === "new-agent"}
	{@render newAgentPanel()}
{/if}
