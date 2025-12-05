<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";

	export interface ClaudeCodeToolCardProps {
		part: DynamicToolUIPart;
		messageId: string;
	}
</script>

<script lang="ts">
	import StaticCodeBlock from "$lib/components/buss/markdown/static-code-block.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { getClaudeCodeToolIcon, getClaudeCodeToolLabel } from "./utils";
	import { CheckCircle2, XCircle, Loader2, Circle } from "@lucide/svelte";

	let { part, messageId: _messageId }: ClaudeCodeToolCardProps = $props();

	let isModalOpen = $state(false);

	function formatJson(obj: unknown): string {
		try {
			return JSON.stringify(obj, null, 2);
		} catch {
			return String(obj);
		}
	}

	const statusConfig = $derived(() => {
		switch (part.state) {
			case "output-available":
				return {
					icon: CheckCircle2,
					color: "text-[#38B865]",
					bgColor: "bg-[#38B865]",
					label: m.tool_call_status_success(),
					animate: false,
				};
			case "output-error":
				return {
					icon: XCircle,
					color: "text-[#D82525]",
					bgColor: "bg-[#D82525]",
					label: m.tool_call_status_error(),
					animate: false,
				};
			case "input-available":
				return {
					icon: Loader2,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_executing(),
					animate: true,
				};
			case "input-streaming":
				return {
					icon: Circle,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_preparing(),
					animate: true,
				};
			default:
				return {
					icon: Circle,
					color: "text-muted-foreground",
					bgColor: "bg-muted",
					label: "Unknown",
					animate: false,
				};
		}
	});

	const ToolIcon = $derived(getClaudeCodeToolIcon(part.toolName));
	const toolLabel = $derived(getClaudeCodeToolLabel(part.toolName));
</script>

<!-- Card Button -->
<button
	type="button"
	class="my-2 block w-full cursor-pointer rounded-[10px] border-0 bg-white px-3.5 py-3 text-left hover:bg-[#F9F9F9] dark:bg-[#1A1A1A] dark:hover:bg-[#2D2D2D]"
	onclick={() => {
		isModalOpen = true;
	}}
>
	<div class="flex w-full items-center justify-between gap-x-4">
		<!-- Left: Tool Icon and Name -->
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
				<ToolIcon class="h-5 w-5 text-muted-foreground" />
			</div>

			<!-- Tool Name -->
			<div class="flex flex-col items-start gap-1">
				<h3 class="text-sm font-medium text-foreground">
					{part.toolName}
				</h3>
				<p class="text-xs text-muted-foreground">{toolLabel}</p>
			</div>
		</div>

		<!-- Right: Status -->
		<div class="flex items-center gap-2">
			{#if statusConfig().animate}
				<div class="h-2 w-2 animate-pulse rounded-full {statusConfig().bgColor}"></div>
			{:else}
				<div class="h-2 w-2 rounded-full {statusConfig().bgColor}"></div>
			{/if}
			<span class="text-sm {statusConfig().color}">{statusConfig().label}</span>
		</div>
	</div>
</button>

<!-- Modal Dialog -->
<Dialog bind:open={isModalOpen}>
	<DialogContent class="max-w-4xl max-h-[80vh] flex flex-col">
		<DialogHeader class="shrink-0">
			<DialogTitle class="flex items-center gap-2">
				<ToolIcon class="h-5 w-5" />
				<span>{part.toolName}</span>
			</DialogTitle>
		</DialogHeader>

		<div class="flex-1 min-h-0">
			<!-- Status indicator -->
			<div class="mb-4 flex items-center gap-2">
				{#if statusConfig().animate}
					<div class="h-3 w-3 animate-pulse rounded-full {statusConfig().bgColor}"></div>
				{:else}
					<div class="h-3 w-3 rounded-full {statusConfig().bgColor}"></div>
				{/if}
				<span class="text-sm {statusConfig().color}">{statusConfig().label}</span>
			</div>

			<!-- Input Parameters -->
			{#if part.input}
				<div class="mb-4 [&_.shiki]:max-h-[300px] [&_.shiki]:overflow-auto [&_.shiki]:text-xs">
					<StaticCodeBlock
						code={formatJson(part.input)}
						language="json"
						title={m.tool_call_parameters()}
						showCollapseButton={false}
					/>
				</div>
			{/if}

			<!-- Output / Error -->
			{#if part.state === "output-available" && part.output}
				<div class="[&_.shiki]:max-h-[300px] [&_.shiki]:overflow-auto [&_.shiki]:text-xs">
					<StaticCodeBlock
						code={formatJson(part.output)}
						language="json"
						title={m.tool_call_result()}
						showCollapseButton={false}
					/>
				</div>
			{:else if part.state === "output-error" && part.errorText}
				<div
					class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
				>
					<p class="text-sm font-medium text-[#D82525] mb-2">{m.tool_call_error_message()}</p>
					<p class="text-xs text-red-900 dark:text-red-100 whitespace-pre-wrap">
						{part.errorText}
					</p>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex justify-center pt-4 shrink-0">
			<Button variant="default" class="h-[42px] w-[148px]" onclick={() => (isModalOpen = false)}>
				{m.tool_call_close()}
			</Button>
		</div>
	</DialogContent>
</Dialog>
