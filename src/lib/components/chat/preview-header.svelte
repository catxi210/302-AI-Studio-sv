<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import {
		Copy,
		Monitor,
		Pin,
		PinOff,
		Rocket,
		Smartphone,
		SquareArrowOutUpRight,
		X,
	} from "@lucide/svelte";

	export type PreviewTab = {
		id: string;
		label: string;
	};

	interface Props {
		activeTab: string;
		tabs: PreviewTab[];
		deviceMode: "desktop" | "mobile";
		isDeploying: boolean;
		deployedUrl: string | null;
		compactDeployButton?: boolean;
		isPinned: boolean;
		onTabChange: (tab: string) => void;
		onDeviceModeChange: (mode: "desktop" | "mobile") => void;
		onDeploy: () => void;
		onClose: () => void;
		onOpenDeployedUrl: () => void;
		onOpenInNewTab: () => void;
		onCopyDeployedUrl: () => void;
		onPin: () => void;
	}

	let {
		activeTab,
		tabs,
		deviceMode,
		isDeploying,
		deployedUrl,
		compactDeployButton = false,
		isPinned,
		onTabChange,
		onDeviceModeChange,
		onDeploy,
		onClose,
		onOpenDeployedUrl,
		onOpenInNewTab,
		onCopyDeployedUrl,
		onPin,
	}: Props = $props();
</script>

<div
	class="shrink-0 border-b border-border bg-background w-full min-w-0"
	style="container-type: inline-size;"
>
	<!-- 顶部 A：Tab 切换和关闭按钮 -->
	<div
		class="flex h-10 w-full items-center justify-between min-w-0 gap-2 px-2 [@container(max-width:349px)]:gap-1 [@container(max-width:349px)]:px-1"
	>
		<!-- 左侧：Tabs -->
		<div
			class="flex flex-row items-center gap-0.5 rounded-md bg-muted p-0.5 min-w-0 max-w-fit overflow-hidden shrink-0"
		>
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					class={cn(
						"text-xs font-medium transition-colors rounded whitespace-nowrap px-2.5 py-0.5 [@container(max-width:349px)]:px-1.5",
						activeTab === tab.id
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onclick={() => onTabChange(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- 右侧：按钮组 -->
		<div class="flex items-center gap-1 shrink-0">
			<ButtonWithTooltip
				tooltip={m.label_button_open_in_new_tab()}
				class="hover:!bg-icon-btn-hover size-8"
				tooltipSide="bottom"
				onclick={onOpenInNewTab}
			>
				<SquareArrowOutUpRight class="size-4" />
			</ButtonWithTooltip>
			<ButtonWithTooltip
				tooltip={isPinned ? m.tooltip_unpin_panel() : m.tooltip_pin_panel()}
				class="hover:!bg-icon-btn-hover size-8"
				tooltipSide="bottom"
				onclick={onPin}
			>
				{#if isPinned}
					<Pin class="size-4" />
				{:else}
					<PinOff class="size-4" />
				{/if}
			</ButtonWithTooltip>
			<ButtonWithTooltip
				tooltip={m.label_button_close()}
				class="hover:!bg-icon-btn-hover size-8"
				tooltipSide="bottom"
				onclick={onClose}
			>
				<X class="size-4" />
			</ButtonWithTooltip>
		</div>
	</div>

	<!-- 分隔区域 -->
	<div class="w-full h-2 bg-[#F2F3F5] dark:bg-[#1a1a1a]"></div>

	<!-- 顶部 B：部署和设备切换 -->
	{#if activeTab === "preview"}
		<div class="grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 min-w-0">
			<!-- 左侧：部署按钮 -->
			<div class="flex items-center gap-2 min-w-0">
				{#if deployedUrl}
					<div class="flex-1 min-w-0 max-w-[200px]">
						<button
							type="button"
							class="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded border border-border/40 bg-background px-2 py-1 text-xs text-primary shadow-none transition-colors hover:bg-muted/70 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							title={deployedUrl ?? undefined}
							onclick={onOpenDeployedUrl}
						>
							<SquareArrowOutUpRight class="size-3 shrink-0" />
							<span class="truncate flex-1 min-w-0 text-left">{deployedUrl}</span>
						</button>
					</div>
					<ButtonWithTooltip
						tooltip={m.tooltip_copy_deploy_url()}
						class="hover:!bg-icon-btn-hover shrink-0"
						tooltipSide="bottom"
						onclick={onCopyDeployedUrl}
					>
						<Copy class="size-4" />
					</ButtonWithTooltip>
				{:else if compactDeployButton}
					<ButtonWithTooltip
						tooltip={isDeploying ? m.tooltip_deploying() : m.tooltip_deploy_sandbox()}
						class="hover:!bg-icon-btn-hover shrink-0"
						tooltipSide="bottom"
						disabled={isDeploying}
						onclick={onDeploy}
					>
						<Rocket class="size-4" />
					</ButtonWithTooltip>
				{:else}
					<button
						type="button"
						class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/40 bg-background text-foreground text-xs font-medium shadow-none transition-colors hover:bg-muted/70 disabled:opacity-50 disabled:cursor-not-allowed"
						title={isDeploying ? m.tooltip_deploying() : m.tooltip_deploy_to_302()}
						disabled={isDeploying}
						onclick={onDeploy}
					>
						<Rocket class="size-4 shrink-0" />
						<span class="shrink-0">{m.text_button_deploy()}</span>
					</button>
				{/if}
			</div>

			<!-- 右侧：设备模式切换 -->
			<div
				class="flex flex-row items-center gap-0.5 rounded-md bg-muted p-0.5 shrink-0 justify-self-end"
			>
				<button
					type="button"
					class={cn(
						"p-1.5 transition-colors rounded",
						deviceMode === "desktop"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onclick={() => onDeviceModeChange("desktop")}
					title={m.tooltip_desktop_view()}
				>
					<Monitor class="size-4" />
				</button>
				<button
					type="button"
					class={cn(
						"p-1.5 transition-colors rounded",
						deviceMode === "mobile"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onclick={() => onDeviceModeChange("mobile")}
					title={m.tooltip_mobile_view()}
				>
					<Smartphone class="size-4" />
				</button>
			</div>
		</div>
	{/if}
</div>
