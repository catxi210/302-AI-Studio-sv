<script lang="ts" module>
	export interface Props {
		onClose: () => void;
	}
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";

	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";

	import { Button, buttonVariants } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import {
		claudeCodeAgentState,
		claudeCodeSandboxState,
		codeAgentState,
	} from "$lib/stores/code-agent";
	import { cn } from "$lib/utils";
	import { ChevronsUpDownIcon, RefreshCcw } from "@lucide/svelte";

	let { onClose }: Props = $props();

	let disabled = $derived(!codeAgentState.isFreshTab);

	let executionIterator: AsyncGenerator<string, void, boolean> | null = null;

	let isRefreshing = $state(false);
	let isCreateSandboxDialogOpen = $state(false);
	let isCreatingSandbox = $state(false);
	let isChecking = $state(false);
	let showLackOfDiskDialog = $state(false);

	async function* enableCodeAgentFlow() {
		isChecking = true;

		const { isOK, sandboxInfo } = await codeAgentState.updateCodeAgentCfgs();
		if (!isOK) {
			isChecking = false;
			return;
		}

		if (sandboxInfo) {
			if (chatState.selectedModel && chatState.selectedModel.id !== sandboxInfo.llmModel) {
				await codeAgentState.handleCodeAgentModelChange(chatState.selectedModel);
			}

			if (sandboxInfo.diskUsage === "insufficient") {
				showLackOfDiskDialog = true;
				const shouldContinue: boolean = yield "wait_user_choice";
				if (!shouldContinue) {
					isChecking = false;
					return;
				}
			}
		}
		codeAgentState.updateEnabled(true);
		isChecking = false;
		onClose();
	}

	async function handleRefresh() {
		isRefreshing = true;
		await claudeCodeSandboxState.refreshSandboxes();
		isRefreshing = false;
	}

	async function handleCreateSandbox() {
		isCreatingSandbox = true;
		const isOK = await claudeCodeAgentState.handleCreateNewSandbox();
		if (isOK) {
			isCreateSandboxDialogOpen = false;
		}
		isCreatingSandbox = false;
	}

	async function handleOverlayAction(type: "enabled" | "disabled" | "cancel" | "close") {
		if (type === "enabled") {
			executionIterator = enableCodeAgentFlow();
			await executionIterator.next();
		} else if (type === "close") {
			codeAgentState.updateEnabled(false);
			onClose();
		} else if (type === "cancel") {
			onClose();
		}
	}

	async function handleContinueAnyway() {
		showLackOfDiskDialog = false;
		if (executionIterator) {
			await executionIterator.next(true);
			executionIterator = null;
		}
	}

	function handleChangeSandbox() {
		showLackOfDiskDialog = false;
		if (executionIterator) {
			executionIterator.return();
			executionIterator = null;
		}
		isChecking = false;
	}
</script>

{#snippet selectSession()}
	<div class="gap-settings-gap flex flex-col">
		<div class="flex flex-row gap-2 items-center justify-between">
			<Label class="text-label-fg">{m.title_select_session()}</Label>
			<ButtonWithTooltip
				class="hover:!bg-chat-action-hover"
				tooltip={m.label_button_reload()}
				onclick={() => handleRefresh()}
				disabled={isRefreshing}
			>
				<RefreshCcw class={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
			</ButtonWithTooltip>
		</div>
		<SettingSelect
			name="session"
			value={claudeCodeAgentState.selectedSessionId}
			options={claudeCodeSandboxState.sessions}
			placeholder={m.select_session_placeholder()}
			{disabled}
			onValueChange={(v) => claudeCodeSandboxState.handleSessionSelected(v)}
		/>
	</div>
{/snippet}

{#snippet selectSandbox()}
	<div class="gap-settings-gap flex flex-col">
		<div class="flex flex-row gap-2 items-center justify-between">
			<Label class="text-label-fg text-xs">{m.title_select_sandbox()}</Label>

			<Dialog.Root bind:open={isCreateSandboxDialogOpen}>
				<Dialog.Trigger
					class={buttonVariants({
						variant: "ghost",
						class: "text-primary text-xs hover:!text-primary hover:!bg-chat-action-hover/50 h-8",
					})}
				>
					{m.label_button_create()}
				</Dialog.Trigger>
				<Dialog.Content class="!min-w-[600px]">
					<Dialog.Header>
						<Dialog.Title>{m.title_create_sandbox()}</Dialog.Title>
					</Dialog.Header>
					<Label class="text-label-fg">{m.title_sandbox_id()}</Label>
					<Input
						class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
						bind:value={claudeCodeAgentState.customSandboxName}
						placeholder={m.placeholder_input_sandbox_remark()}
					/>

					<Dialog.Footer class="flex flex-row items-center sm:justify-between">
						<Button variant="secondary" onclick={() => (isCreateSandboxDialogOpen = false)}>
							{m.common_cancel()}
						</Button>
						<Button variant="default" disabled={isCreatingSandbox} onclick={handleCreateSandbox}>
							{#if isCreatingSandbox}
								<LdrsLoader type="line-spinner" size={16} />
								{m.sandbox_creating()}
							{:else}
								{m.label_button_confirm()}
							{/if}
						</Button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		</div>
		<SettingSelect
			name="sandbox"
			value={claudeCodeAgentState.selectedSandboxId}
			options={claudeCodeSandboxState.sandboxes}
			placeholder={m.select_sandbox_placeholder()}
			onValueChange={(v) => claudeCodeSandboxState.handleSelectSandbox(v)}
			disabled={claudeCodeAgentState.agentMode === "existing" || disabled}
			class="!bg-background dark:!bg-background"
		/>
	</div>
{/snippet}

{#snippet advancedSettings()}
	<Collapsible.Root class="!bg-settings-item-bg dark:!bg-settings-item-bg rounded-[10px] px-4 py-2">
		<div class="flex flex-row items-center justify-between">
			<Label class="text-label-fg">{m.title_advanced_settings()}</Label>
			<Collapsible.Trigger
				class={buttonVariants({
					variant: "ghost",
					size: "icon",
					class: "hover:!bg-chat-action-hover rounded-[10px]",
				})}
			>
				<ChevronsUpDownIcon class="h-4 w-4" />
			</Collapsible.Trigger>
		</div>

		<Collapsible.Content class="pb-2">
			<div class="flex flex-col gap-2">
				{@render selectSandbox()}
				<Field.Description class="text-xs">{m.description_advanced_settings()}</Field.Description>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/snippet}

{#snippet panelFooter()}
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
			<Dialog.Root bind:open={showLackOfDiskDialog}>
				<Button disabled={isChecking} onclick={() => handleOverlayAction("enabled")}>
					{#if isChecking}
						<LdrsLoader type="line-spinner" size={16} />
						{m.text_button_checking()}
					{:else}
						{m.text_button_open()}
					{/if}
				</Button>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>{m.title_lack_of_disk()}</Dialog.Title>
					</Dialog.Header>

					<Dialog.Description>
						<p>
							{m.description_lack_of_disk()}: {claudeCodeAgentState.selectedSandboxRemark === ""
								? m.no_remark()
								: claudeCodeAgentState.selectedSandboxRemark}
						</p>
						<p>{m.description_lack_of_disk_2()}: {claudeCodeAgentState.selectedSandboxId}</p>
					</Dialog.Description>

					<Dialog.Description>
						<p>{m.description_lack_of_disk_3()}</p>
						<p>{m.description_lack_of_disk_4()}</p>
					</Dialog.Description>

					<Dialog.Footer class="flex flex-row items-center sm:justify-between">
						<Button variant="secondary" onclick={handleContinueAnyway}>
							{m.text_button_still_continue()}
						</Button>
						<Button onclick={handleChangeSandbox}>
							{m.text_button_replace_sandbox()}
						</Button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		{/if}
	</div>
{/snippet}

{@render selectSession()}
{@render advancedSettings()}
{@render panelFooter()}
