<script lang="ts">
	import { executeSandboxCommand } from "$lib/api/sandbox-command";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { Loader2, Terminal as TerminalIcon } from "@lucide/svelte";
	import { DEFAULT_WORKSPACE_PATH } from "./constants";

	interface Props {
		sandboxId: string;
		sessionId: string | null;
		onExecuteCommand?: (command: string) => void;
	}

	let { sandboxId, sessionId, onExecuteCommand }: Props = $props();

	let commandInput = $state("");
	let outputLines = $state<
		Array<{ type: "command" | "output" | "error"; content: string; cwd?: string }>
	>([]);
	let isExecuting = $state(false);
	let commandHistory = $state<string[]>([]);
	let historyIndex = $state(-1);
	let inputRef = $state<HTMLInputElement | null>(null);
	let outputRef = $state<HTMLDivElement | null>(null);
	let currentWorkingDirectory = $state<string>(DEFAULT_WORKSPACE_PATH);

	// Initialize CWD and terminal history from storage
	$effect(() => {
		if (sandboxId && sessionId) {
			(async () => {
				const savedCwd = await agentPreviewState.getCurrentWorkingDirectory(sandboxId, sessionId);
				if (savedCwd) {
					currentWorkingDirectory = savedCwd;
				}

				const savedHistory = await agentPreviewState.getTerminalHistory(sandboxId, sessionId);
				if (savedHistory && savedHistory.length > 0) {
					outputLines = savedHistory;
				}
			})();
		}
	});

	// Get 302.AI API key
	const get302ApiKey = () => {
		const provider = persistedProviderState.current.find((p) => p.name === "302.AI" && p.enabled);
		return provider?.apiKey || "";
	};

	// Scroll to bottom when new output is added
	function scrollToBottom() {
		if (outputRef) {
			outputRef.scrollTop = outputRef.scrollHeight;
		}
	}

	$effect(() => {
		if (outputLines.length > 0) {
			scrollToBottom();
		}
	});

	// Parse cd command to get target directory
	function parseCdCommand(command: string): string | null {
		const trimmed = command.trim();
		// Match "cd" with optional path
		const cdMatch = trimmed.match(/^cd(?:\s+(.+))?$/);
		if (!cdMatch) {
			return null;
		}

		// If no path provided, go to home directory
		if (!cdMatch[1]) {
			return "/home/user";
		}

		let targetPath = cdMatch[1].trim();

		// Handle ~ (home directory)
		if (targetPath === "~" || targetPath.startsWith("~/")) {
			targetPath = targetPath.replace(/^~/, "/home/user");
		}

		// Handle absolute paths
		if (targetPath.startsWith("/")) {
			return targetPath;
		}

		// Handle relative paths
		// Resolve .. and . in the path
		const parts = targetPath.split("/").filter((p) => p !== "");
		let resolved = currentWorkingDirectory.split("/").filter((p) => p !== "");

		for (const part of parts) {
			if (part === "..") {
				if (resolved.length > 0) {
					resolved.pop();
				}
			} else if (part !== ".") {
				resolved.push(part);
			}
		}

		return "/" + resolved.join("/");
	}

	// Execute command
	async function executeCommand() {
		const cmd = commandInput.trim();
		if (!cmd || isExecuting) return;

		// Record the cwd at the time of command execution
		const commandCwd = currentWorkingDirectory;

		// Add command to output with the cwd it was executed in
		outputLines = [...outputLines, { type: "command", content: cmd, cwd: commandCwd }];
		commandInput = "";

		// Add to history (avoid duplicates)
		if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== cmd) {
			commandHistory = [...commandHistory.slice(-49), cmd]; // Keep last 50 commands
		}
		historyIndex = -1;

		// Call callback if provided
		if (onExecuteCommand) {
			onExecuteCommand(cmd);
		}

		isExecuting = true;

		try {
			const apiKey = get302ApiKey();
			if (!apiKey) {
				throw new Error("302.AI API key not found");
			}

			const provider = persistedProviderState.current.find((p) => p.name === "302.AI" && p.enabled);
			if (!provider) {
				throw new Error("302.AI provider not found");
			}

			const result = await executeSandboxCommand(provider, {
				sandbox_id: sandboxId,
				session_id: sessionId || undefined,
				command: cmd,
				cwd: currentWorkingDirectory,
			});

			if (!result.success) {
				outputLines = [
					...outputLines,
					{
						type: "error",
						content: result.error || "Failed to execute command",
					},
				];
				// Save terminal history even on error
				if (sandboxId && sessionId) {
					await agentPreviewState.setTerminalHistory(sandboxId, sessionId, outputLines);
				}
				return;
			}

			if (result.data && result.data.result) {
				const { stdout, stderr, error, exit_code } = result.data.result;

				// Handle cd command - update cwd if successful
				const cdTarget = parseCdCommand(cmd);
				if (cdTarget !== null && exit_code === 0 && !stderr && !error) {
					currentWorkingDirectory = cdTarget;
					// Save to storage
					if (sandboxId && sessionId) {
						await agentPreviewState.setCurrentWorkingDirectory(sandboxId, sessionId, cdTarget);
					}
				}

				// Display stdout if present
				if (stdout) {
					outputLines = [...outputLines, { type: "output", content: stdout }];
				}

				// Display stderr if present (in red)
				if (stderr) {
					outputLines = [...outputLines, { type: "error", content: stderr }];
				}

				// Display error if present
				if (error) {
					outputLines = [...outputLines, { type: "error", content: error }];
				}

				// Save terminal history to storage after adding all outputs
				if (sandboxId && sessionId) {
					await agentPreviewState.setTerminalHistory(sandboxId, sessionId, outputLines);
				}
			}
		} catch (error) {
			outputLines = [
				...outputLines,
				{
					type: "error",
					content: error instanceof Error ? error.message : "Unknown error occurred",
				},
			];
		} finally {
			isExecuting = false;
			// Focus input after execution
			if (inputRef) {
				inputRef.focus();
			}
		}
	}

	// Handle keyboard events
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			executeCommand();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (commandHistory.length > 0) {
				if (historyIndex === -1) {
					historyIndex = commandHistory.length - 1;
				} else if (historyIndex > 0) {
					historyIndex--;
				}
				commandInput = commandHistory[historyIndex] || "";
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			if (historyIndex >= 0) {
				if (historyIndex < commandHistory.length - 1) {
					historyIndex++;
					commandInput = commandHistory[historyIndex] || "";
				} else {
					historyIndex = -1;
					commandInput = "";
				}
			}
		}
	}

	// Format cwd for display (replace /home/user with ~)
	function formatCwdForDisplay(cwd: string): string {
		if (cwd.startsWith("/home/user")) {
			return cwd.replace(/^\/home\/user/, "~");
		}
		return cwd;
	}
</script>

<div
	class="flex h-full flex-col bg-muted/40 dark:bg-zinc-950 font-mono text-xs sm:text-sm group"
	onclick={() => inputRef?.focus()}
	onkeydown={(e) => {
		if (e.key === "Enter") inputRef?.focus();
	}}
	role="button"
	tabindex="0"
>
	<!-- Output area -->
	<div
		bind:this={outputRef}
		class="flex-1 overflow-y-auto p-3 min-h-0 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent"
	>
		{#if outputLines.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2">
				<TerminalIcon class="w-8 h-8 opacity-20" />
				<span class="text-xs">Terminal ready</span>
			</div>
		{:else}
			{#each outputLines as line, i (i)}
				<div class="mb-1 whitespace-pre-wrap break-words leading-relaxed">
					{#if line.type === "command"}
						<div class="flex flex-row items-start gap-2 mt-2 mb-1">
							<span class="text-primary font-bold shrink-0 select-none">➜</span>
							<span class="text-muted-foreground font-medium shrink-0 select-none">
								{formatCwdForDisplay(line.cwd || currentWorkingDirectory)}
							</span>
							<span class="text-foreground font-medium">{line.content}</span>
						</div>
					{:else if line.type === "error"}
						<span
							class="text-destructive dark:text-red-400 block pl-4 border-l-2 border-destructive/50"
							>{line.content}</span
						>
					{:else}
						<span class="text-foreground/90 dark:text-zinc-300 block">{line.content}</span>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Input area -->
	<div class="flex shrink-0 items-center gap-2 border-t border-border/40 bg-background/50 p-2 px-3">
		<div class="flex items-center gap-1.5 shrink-0 text-primary">
			{#if isExecuting}
				<Loader2 class="h-3.5 w-3.5 animate-spin" />
			{:else}
				<span class="font-bold select-none">➜</span>
			{/if}
			<span class="text-muted-foreground font-medium select-none text-xs hidden sm:inline-block">
				{formatCwdForDisplay(currentWorkingDirectory)}
			</span>
		</div>

		<input
			bind:this={inputRef}
			bind:value={commandInput}
			onkeydown={handleKeyDown}
			disabled={isExecuting}
			class="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 min-w-0"
			placeholder={isExecuting ? "Executing..." : "Type a command..."}
			type="text"
			autocomplete="off"
			spellcheck="false"
		/>
	</div>
</div>

<style>
	/* 移除原有的全局滚动条样式覆盖，改用 Tailwind 插件或更温和的局部样式（如果项目中已有 scrollbar 插件则不需要这些） */
	/* 这里保留一个极简的 fallback */
	div::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	div::-webkit-scrollbar-track {
		background: transparent;
	}

	div::-webkit-scrollbar-thumb {
		background-color: var(--muted-foreground);
		opacity: 0.2;
		border-radius: 9999px;
	}
	/* 让滚动条颜色更淡一点，适配亮暗模式 */
	:global(.dark) div::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.2);
	}
	div::-webkit-scrollbar-thumb:hover {
		background-color: var(--muted-foreground);
		opacity: 0.5;
	}
</style>
