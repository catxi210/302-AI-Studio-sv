<script lang="ts" module>
	export const platformOptions = [
		{
			key: "remote",
			label: m.title_remote(),
		},
		{
			key: "local",
			label: m.title_local(),
		},
	];
	export const options: SelectOption[] = [
		{
			key: "claude-code",
			label: "Claude Code",
			value: "claude-code",
		},
	];

	export interface Props {
		onClose: () => void;
	}
</script>

<script lang="ts">
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { Label } from "$lib/components/ui/label";

	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent";
	import type { CodeAgentType } from "@shared/storage/code-agent";
	import ClaudeCodePanel from "./claude-code-panel.svelte";

	let { onClose }: Props = $props();

	let isChecking = $state(false);

	async function handleSelect(key: string) {
		codeAgentState.updateType(key as CodeAgentType);
	}

	function handleCodeAgentSelected(codeAgentId: string) {
		codeAgentState.updateCurrentAgentId(codeAgentId);
	}

	async function handleOverlayAction(type: "enabled" | "disabled" | "cancel" | "close") {
		if (type === "enabled") {
			isChecking = true;
			const isOK = await codeAgentState.updateCodeAgentCfgs();
			isChecking = false;
			if (!isOK) return;
			codeAgentState.updateEnabled(true);
		} else if (type === "close") {
			codeAgentState.updateEnabled(false);
		}
		onClose();
	}
</script>

<div class="w-[600px]">
	<div class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4">
		<div class="gap-settings-gap flex flex-col">
			<Label class="mb-2 text-label-fg">{m.title_code_agent_type()}</Label>
			<SegButton
				options={platformOptions}
				selectedKey={codeAgentState.type}
				onSelect={handleSelect}
			/>
		</div>

		{#if codeAgentState.type === "remote"}
			<Label class="text-label-fg">{m.title_agent()}</Label>
			<SettingSelect
				name="agent"
				value={codeAgentState.currentAgentId}
				{options}
				placeholder={m.select_agent()}
				onValueChange={(codeAgentId) => handleCodeAgentSelected(codeAgentId)}
			/>

			{#if codeAgentState.currentAgentId === "claude-code"}
				<ClaudeCodePanel />
			{/if}

			<div class="flex flex-row justify-between">
				<Button variant="secondary" onclick={() => handleOverlayAction("cancel")}>
					{m.common_cancel()}
				</Button>
				{#if codeAgentState.enabled}
					<Button
						disabled={codeAgentState.inCodeAgentMode}
						onclick={() => handleOverlayAction("close")}
					>
						{m.label_button_close()}
					</Button>
				{:else}
					<Button disabled={isChecking} onclick={() => handleOverlayAction("enabled")}>
						{#if isChecking}
							<LdrsLoader type="line-spinner" size={16} />
							{m.text_button_checking()}
						{:else}
							{m.text_button_open()}
						{/if}
					</Button>
				{/if}
			</div>
		{/if}
		{#if codeAgentState.type === "local"}
			<!-- TODO: local agent -->
			<Empty.Root>
				<Empty.Content class="h-[200px] flex flex-col items-center justify-center">
					<Empty.Description>
						{m.unsupport()}
					</Empty.Description>
				</Empty.Content>
			</Empty.Root>
		{/if}
	</div>
</div>
