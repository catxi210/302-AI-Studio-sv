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

	import { SegButton, SettingSelect } from "$lib/components/buss/settings";
	import { Button } from "$lib/components/ui/button";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeAgentState } from "$lib/stores/code-agent";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { cn } from "$lib/utils";
	import { RefreshCcw, Wrench } from "@lucide/svelte";
	import { onMount } from "svelte";

	const { updateClaudeCodeSandboxRemark } = window.electronAPI.codeAgentService;

	let isSandboxesLoading = $state(false);
	let isSessionsLoading = $state(false);
	let openModifyRemarkInput = $state(false);
	let customSandboxRemark = $state("");
	let isModifyRemarkLoading = $state(false);

	function handleSessionModeChange(sessionMode: "select-existing-agent" | "new-agent") {
		claudeCodeAgentState.sessionMode = sessionMode;
	}

	async function handleSelectSandbox(sandboxId: string) {
		claudeCodeAgentState.customSandboxId = sandboxId;
		customSandboxRemark = claudeCodeSandboxState.sandboxRemarkMap.get(sandboxId) ?? "";
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

	function handleModifyRemark() {
		if (openModifyRemarkInput) {
			customSandboxRemark =
				claudeCodeSandboxState.sandboxRemarkMap.get(claudeCodeAgentState.customSandboxId) ?? "";
		}
		openModifyRemarkInput = !openModifyRemarkInput;
	}

	async function handleModifyRemarkConfirm() {
		isModifyRemarkLoading = true;
		const { isOK } = await updateClaudeCodeSandboxRemark(
			claudeCodeAgentState.customSandboxId,
			customSandboxRemark,
		);
		if (isOK) {
			await handleRefreshSandboxes();
		}
		isModifyRemarkLoading = false;
		openModifyRemarkInput = false;
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
	<Label class="text-label-fg">{m.title_sandbox_remark()}</Label>
	<Input
		class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
		bind:value={claudeCodeAgentState.customSandboxId}
		placeholder={m.title_custom_sandbox_remark()}
	/>
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
			placeholder={m.select_sandbox_placeholder()}
			onValueChange={(v) => {
				handleSelectSandbox(v);
			}}
		/>
		<ButtonWithTooltip
			class={cn("hover:!bg-chat-action-hover", openModifyRemarkInput ? "bg-chat-action-hover" : "")}
			tooltip={m.text_button_modify_remark()}
			onclick={handleModifyRemark}
			disabled={isSandboxesLoading || !claudeCodeAgentState.customSandboxId}
		>
			<Wrench />
		</ButtonWithTooltip>
		<ButtonWithTooltip
			class="hover:!bg-chat-action-hover"
			tooltip={m.label_button_reload()}
			onclick={handleRefreshSandboxes}
			disabled={isSandboxesLoading}
		>
			<RefreshCcw class={cn("h-4 w-4", isSandboxesLoading ? "animate-spin" : "")} />
		</ButtonWithTooltip>
	</div>
	{#if openModifyRemarkInput}
		<div class="flex flex-row gap-2 items-center">
			<Input
				class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
				bind:value={customSandboxRemark}
				placeholder={m.placeholder_input_sandbox_remark()}
			/>
			<Button
				variant="secondary"
				disabled={isModifyRemarkLoading}
				onclick={handleModifyRemarkConfirm}
			>
				{#if isModifyRemarkLoading}
					<RefreshCcw class="animate-spin" />
				{:else}
					{m.label_button_confirm()}
				{/if}
			</Button>
		</div>
	{/if}
	<Label class="text-label-fg">{m.title_select_session()}</Label>
	<div class="flex flex-row gap-2 items-center">
		<SettingSelect
			name="session"
			value={claudeCodeAgentState.customSessionId}
			options={claudeCodeSandboxState.sessions}
			placeholder={m.select_session_placeholder()}
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

<Label class="text-label-fg">{m.title_select_agent_mode()}</Label>
<!-- <SettingSelect
	name="sessionMode"
	value={claudeCodeAgentState.sessionMode}
	options={sessionModeOptions}
	placeholder={m.select_session()}
	onValueChange={(v) => handleSessionModeChange(v as "select-existing-agent" | "new-agent")}
/> -->
<SegButton
	options={sessionModeOptions}
	selectedKey={claudeCodeAgentState.sessionMode}
	onSelect={(v) => handleSessionModeChange(v as "select-existing-agent" | "new-agent")}
/>

{#if claudeCodeAgentState.sessionMode === "select-existing-agent"}
	{@render selectExistingAgentPanel()}
{:else if claudeCodeAgentState.sessionMode === "new-agent"}
	{@render newAgentPanel()}
{/if}
