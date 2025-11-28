<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { m } from "$lib/paraglide/messages";
	import {
		claudeCodeSandboxState,
		persistedClaudeCodeSandboxState,
	} from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { Loader2 } from "@lucide/svelte";
	import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
	import SandboxDeleteConfirmDialog from "./sandbox-delete-confirm-dialog.svelte";

	interface Props {
		open?: boolean;
		sandbox?: ClaudeCodeSandboxInfo | null;
		onDelete?: () => void;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		sandbox = null,
		onDelete = () => {},
		onClose = () => {},
	}: Props = $props();

	let isLoading = $state(false);

	// Get the latest sessions from the persisted state
	const sessions = $derived.by(() => {
		if (!sandbox) return [];
		const currentSandbox = persistedClaudeCodeSandboxState.current.find(
			(s) => s.sandboxId === sandbox.sandboxId,
		);
		return currentSandbox?.sessionInfos || [];
	});

	// Refresh sessions when dialog opens
	$effect(() => {
		if (open && sandbox) {
			(async () => {
				isLoading = true;
				try {
					await claudeCodeSandboxState.refreshSessions(sandbox.sandboxId);
				} finally {
					isLoading = false;
				}
			})();
		}
	});

	function formatTime(session: {
		sessionId: string;
		workspacePath: string;
		note: string;
		createdAt?: string | number;
	}) {
		// 如果有时间戳，格式化显示
		if (session.createdAt) {
			const date = new Date(session.createdAt);
			return date.toLocaleString("zh-CN", {
				month: "numeric",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		}
		return "";
	}
	let isDeleteDialogOpen = $state(false);

	// Reset showConfirm when dialog opens/closes
	$effect(() => {
		if (!open) {
			isDeleteDialogOpen = false;
		}
	});
</script>

<Dialog.Root bind:open>
	<!-- Using inline styles with hex colors -->
	<Dialog.Content class="min-w-[568px] rounded-2xl p-6" style="background: #ffffff;">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-lg font-semibold" style="color: #1a1a1a;">
				{sandbox?.sandboxRemark || sandbox?.sandboxId || "Sandbox"}
			</h2>
			<p class="text-sm" style="color: #999999;">{sandbox?.sandboxId}</p>
		</div>

		<!-- Main View -->
		<div>
			<h3 class="text-base font-medium mb-3" style="color: #1a1a1a;">
				{m.label_session_list()}
			</h3>

			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin" style="color: #999999;" />
				</div>
			{:else if sessions.length === 0}
				<Empty.Root>
					<Empty.Content class="h-[120px] flex flex-col items-center justify-center">
						<Empty.Description style="color: #999999;">
							{m.no_sessions()}
						</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{:else}
				<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each sessions as session (session.sessionId)}
						<!-- Inline style for list item background -->
						<div
							class="flex items-center justify-between p-4 rounded-xl"
							style="background: #f8f5ff;"
						>
							<div>
								<p class="text-sm font-medium" style="color: #1a1a1a;">
									{session.note || session.sessionId}
								</p>
								{#if session.note}
									<p class="text-xs" style="color: #999999;">{session.sessionId}</p>
								{/if}
							</div>
							<span class="text-sm" style="color: #999999;">{formatTime(session)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer Buttons -->
		<div class="flex gap-3 mt-6 justify-between">
			<!-- Inline styles for delete button -->
			<Button
				class="bg-[#F9F9F9] text-[#D82525] hover:!bg-[#FFF1F1] hover:!text-[#D82525] text-sm "
				onclick={() => (isDeleteDialogOpen = true)}
				variant="ghost">{m.label_delete_sandbox ? m.label_delete_sandbox() : "删除此沙盒"}</Button
			>
			<!-- Inline styles for close button -->
			<Button class="text-sm" onclick={() => onClose()}>
				{m.btn_close()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<SandboxDeleteConfirmDialog
	bind:open={isDeleteDialogOpen}
	{sandbox}
	onSuccess={() => {
		onClose();
		onDelete();
	}}
/>

<style>
</style>
