<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import {
		claudeCodeSandboxState,
		persistedClaudeCodeSandboxState,
	} from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { Loader2 } from "@lucide/svelte";
	import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";

	interface Props {
		open?: boolean;
		sandbox: ClaudeCodeSandboxInfo | null;
		onClose?: () => void;
		onSuccess?: () => void;
	}

	let {
		open = $bindable(false),
		sandbox,
		onClose = () => {},
		onSuccess = () => {},
	}: Props = $props();

	let isDeleting = $state(false);
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

	async function handleDelete() {
		if (!sandbox) return;
		isDeleting = true;
		try {
			await claudeCodeSandboxState.deleteSandbox(sandbox.sandboxId);
			open = false;
			onSuccess();
		} finally {
			isDeleting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<!-- Using inline styles with hex colors to match original design -->
	<Dialog.Content class="min-w-[568px] rounded-2xl p-6" style="background: #ffffff;">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-lg font-semibold" style="color: #1a1a1a;">
				{m.title_delete_sandbox()}
			</h2>
		</div>

		<!-- Confirmation View -->
		<div class="space-y-4">
			<div class="space-y-1">
				<p class="text-sm text-[#1a1a1a]">
					{m.title_delete_sandbox_confirm({
						remark: sandbox?.sandboxRemark || m.remark_null(),
					})}
				</p>
				<p class="text-sm text-[#1a1a1a]">
					{m.title_sandbox_id()}：<span class="font-bold">{sandbox?.sandboxId}</span>
				</p>
			</div>

			<div class="space-y-2">
				<p class="text-sm font-bold mb-3" style="color: #333333;">
					{m.text_delete_sandbox_warning()}
				</p>
				<div class="max-h-48 overflow-y-auto space-y-2 mb-4">
					{#if isLoading}
						<div class="flex items-center justify-center py-4">
							<Loader2 class="h-6 w-6 animate-spin" style="color: #999999;" />
						</div>
					{:else if sessions.length === 0}
						<p class="text-sm text-muted-foreground text-center py-4">{m.no_sessions()}</p>
					{:else}
						{#each sessions as session (session.sessionId)}
							<div
								class="flex items-center justify-between p-4 rounded-xl"
								style="background: #f8f5ff;"
							>
								<div>
									<p class="text-sm font-medium" style="color: #1a1a1a;">
										{session.note || session.sessionId}
									</p>
									<p class="text-xs" style="color: #999999;">{session.sessionId}</p>
								</div>
								<span class="text-sm" style="color: #999999;">{formatTime(session)}</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<p class="text-sm" style="color: #ef4444;">
				{m.text_delete_sandbox_warning_confirm()}
			</p>
		</div>

		<!-- Footer Buttons -->
		<div class="flex gap-3 mt-6">
			<Button
				variant="outline"
				class="flex-1 rounded-lg h-10"
				style="border-color: #e5e5e5; color: #333333; background: transparent;"
				onclick={() => {
					open = false;
					onClose();
				}}
				disabled={isDeleting}
			>
				{m.common_cancel()}
			</Button>
			<Button
				class="flex-1 rounded-lg h-10"
				style="background: #ef4444; color: #ffffff;"
				onclick={handleDelete}
				disabled={isDeleting}
			>
				{#if isDeleting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin text-white" />
				{/if}
				{m.title_button_delete()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
