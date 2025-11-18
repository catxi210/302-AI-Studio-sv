<script lang="ts" module>
	export const options = [
		{
			key: "select-existing-agent",
			label: m.title_select_existing_agent(),
			value: "select-existing-agent",
		},
		{
			key: "new-agent",
			label: m.title_new_agent(),
			value: "new-agent",
		},
	];
</script>

<script lang="ts">
	import { SettingSelect } from "$lib/components/buss/settings";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeAgentState } from "$lib/stores/code-agent";
	import { onMount } from "svelte";

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
	<Input
		class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
		bind:value={claudeCodeAgentState.customSandboxId}
		placeholder={m.title_sandbox_id_to_be_associated()}
	/>
	<Label class="text-label-fg">{m.title_session_id()}</Label>
	<Input
		class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
		bind:value={claudeCodeAgentState.customSessionId}
		placeholder={m.title_session_id_to_be_associated()}
	/>
{/snippet}

<Label class="text-label-fg">{m.title_select_session()}</Label>
<SettingSelect
	name="session"
	value={claudeCodeAgentState.sessionMode}
	{options}
	placeholder={m.select_session()}
	onValueChange={(v) =>
		(claudeCodeAgentState.sessionMode = v as "select-existing-agent" | "new-agent")}
/>

{#if claudeCodeAgentState.sessionMode === "select-existing-agent"}
	{@render selectExistingAgentPanel()}
{:else if claudeCodeAgentState.sessionMode === "new-agent"}
	{@render newAgentPanel()}
{/if}
