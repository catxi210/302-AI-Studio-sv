<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { Loader2, X } from "@lucide/svelte";

	interface Props {
		open?: boolean;
		sandboxId?: string;
		remark?: string;
		onSave?: (remark: string) => Promise<void>;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		sandboxId = "",
		remark = "",
		onSave = async () => {},
		onClose = () => {},
	}: Props = $props();

	let editedRemark = $state(remark);
	let isSaving = $state(false);

	$effect(() => {
		if (open) {
			editedRemark = remark;
		}
	});

	async function handleSave() {
		isSaving = true;
		try {
			await onSave(editedRemark);
			open = false;
		} finally {
			isSaving = false;
		}
	}

	function handleClose() {
		if (isSaving) return;
		onClose();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="min-w-[569px] p-0 gap-0 rounded-xl overflow-hidden"
		style="background: #ffffff; border: none; box-shadow: 0 4px 24px rgba(0,0,0,0.12);"
	>
		<!-- Header -->
		<div
			style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0;"
		>
			<span style="font-size: 16px; font-weight: 600; color: #1a1a1a;">
				{m.title_rename ? m.title_rename() : "修改备注"}
			</span>
			<button
				onclick={handleClose}
				disabled={isSaving}
				style="background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;"
			>
				<X size={20} style="color: #999999;" />
			</button>
		</div>

		<!-- Content -->
		<div style="padding: 20px;">
			<!-- 沙盒ID -->
			<div style="margin-bottom: 16px;">
				<div style="font-size: 14px; font-weight: 500; color: #1a1a1a; margin-bottom: 8px;">
					{m.title_sandbox_id()}
				</div>
				<div style="font-size: 14px; color: #999999;">{sandboxId}</div>
			</div>

			<!-- 备注输入 -->
			<div style="margin-bottom: 24px;">
				<div style="font-size: 14px; font-weight: 500; color: #1a1a1a; margin-bottom: 8px;">
					{m.label_remark ? m.label_remark() : "备注"}
				</div>
				<input
					type="text"
					bind:value={editedRemark}
					disabled={isSaving}
					style="width: 100%; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; color: #1a1a1a; outline: none; box-sizing: border-box;"
					onfocus={(e) => (e.currentTarget.style.borderColor = "#9945ff")}
					onblur={(e) => (e.currentTarget.style.borderColor = "#e5e5e5")}
				/>
			</div>

			<!-- Buttons -->
			<div class="flex gap-3 mt-6">
				<Button
					variant="outline"
					class="flex-1 rounded-lg h-10"
					style="border-color: #e5e5e5; color: #333333; background: transparent;"
					onclick={handleClose}
					disabled={isSaving}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					class="flex-1 rounded-lg h-10"
					style="background: #9945ff; color: #ffffff;"
					onclick={handleSave}
					disabled={isSaving}
				>
					{#if isSaving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin text-white" />
					{/if}
					{m.text_button_save()}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
