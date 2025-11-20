<script lang="ts">
	import { executeSandboxCommand } from "$lib/api/sandbox-command";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { Loader2 } from "@lucide/svelte";
	import { DEFAULT_WORKSPACE_PATH } from "./constants";

	interface Props {
		sandboxId: string;
		sessionId: string | null;
		onExecuteCommand?: (command: string) => void;
	}

	let { sandboxId, sessionId, onExecuteCommand }: Props = $props();

	let commandInput = $state("");
	let terminalState = $derived(
		sandboxId && sessionId ? agentPreviewState.getReactiveState(sandboxId, sessionId) : undefined,
	);
	let outputLines = $derived(terminalState?.terminalHistory || []);
	let currentWorkingDirectory = $derived(
		terminalState?.currentWorkingDirectory || DEFAULT_WORKSPACE_PATH,
	);

	// Use a reactive call to the state manager to get execution status
	// This uses the memory-only store in agentPreviewState
	let isExecuting = $derived(
		sandboxId && sessionId ? agentPreviewState.isExecuting(sandboxId, sessionId) : false,
	);

	let commandHistory = $state<string[]>([]);
	let historyIndex = $state(-1);
	let inputRef = $state<HTMLInputElement | null>(null);
	let outputRef = $state<HTMLDivElement | null>(null);

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

		if (!sandboxId || !sessionId) {
			return;
		}

		// Record the cwd at the time of command execution
		const commandCwd = currentWorkingDirectory;

		// Add command to output with the cwd it was executed in
		agentPreviewState.updateState(sandboxId, sessionId, (state) => ({
			terminalHistory: [
				...(state.terminalHistory || []),
				{ type: "command", content: cmd, cwd: commandCwd },
			],
		}));

		// Set executing state in memory-only store
		agentPreviewState.setExecuting(sandboxId, sessionId, true);

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
				agentPreviewState.updateState(sandboxId, sessionId, (state) => ({
					terminalHistory: [
						...(state.terminalHistory || []),
						{
							type: "error",
							content: result.error || "Failed to execute command",
						},
					],
				}));
				agentPreviewState.setExecuting(sandboxId, sessionId, false);
				return;
			}

			if (result.data && result.data.result) {
				const { stdout, stderr, error, exit_code } = result.data.result;

				// Handle cd command - update cwd if successful
				const cdTarget = parseCdCommand(cmd);
				let newCwd = currentWorkingDirectory;
				if (cdTarget !== null && exit_code === 0 && !stderr && !error) {
					newCwd = cdTarget;
				}

				agentPreviewState.updateState(sandboxId, sessionId, (state) => {
					const newHistory = [...(state.terminalHistory || [])];

					// Display stdout if present
					if (stdout) {
						newHistory.push({ type: "output", content: stdout });
					}

					// Display stderr if present (in red)
					if (stderr) {
						newHistory.push({ type: "error", content: stderr });
					}

					// Display error if present
					if (error) {
						newHistory.push({ type: "error", content: error });
					}

					return {
						terminalHistory: newHistory,
						currentWorkingDirectory: newCwd,
					};
				});
			}

			agentPreviewState.setExecuting(sandboxId, sessionId, false);
		} catch (error) {
			agentPreviewState.updateState(sandboxId, sessionId, (state) => ({
				terminalHistory: [
					...(state.terminalHistory || []),
					{
						type: "error",
						content: error instanceof Error ? error.message : "Unknown error occurred",
					},
				],
			}));
			agentPreviewState.setExecuting(sandboxId, sessionId, false);
		} finally {
			// Focus input after execution if component is still mounted
			if (inputRef) {
				inputRef.focus();
			}
			scrollToBottom();
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
	class="flex h-full flex-col bg-zinc-950 text-zinc-300 font-mono text-xs sm:text-sm group selection:bg-zinc-700 selection:text-zinc-100"
	onclick={(e) => {
		// Only focus input if the user is clicking on the container background
		// and not selecting text or interacting with specific elements
		if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("flex-1")) {
			inputRef?.focus();
		}
	}}
	onkeydown={(e) => {
		if (e.key === "Enter") inputRef?.focus();
	}}
	role="presentation"
>
	<!-- Terminal Content -->
	<div
		bind:this={outputRef}
		class="flex-1 overflow-y-auto p-3 min-h-0 scrollbar-thin scrollbar-thumb-zinc-700/50 scrollbar-track-transparent"
	>
		<!-- Output History -->
		{#each outputLines as line, i (i)}
			<div class="mb-1 whitespace-pre-wrap break-words leading-relaxed">
				{#if line.type === "command"}
					<div class="flex flex-row items-start gap-2 mt-2 mb-1">
						<span class="text-blue-400 font-medium shrink-0 select-none">
							{formatCwdForDisplay(line.cwd || currentWorkingDirectory)}
						</span>
						<span class="text-zinc-100 font-medium">{line.content}</span>
					</div>
				{:else if line.type === "error"}
					<span class="text-red-400 block pl-4 border-l-2 border-red-500/50">{line.content}</span>
				{:else}
					<span class="text-zinc-300 block">{line.content}</span>
				{/if}
			</div>
		{/each}

		<!-- Active Input Line -->
		{#if isExecuting}
			<div class="flex flex-row items-start gap-2 mt-2 mb-1">
				<Loader2 class="h-4 w-4 mt-0.5 animate-spin text-zinc-400" />
			</div>
		{:else}
			<div class="flex flex-row items-start gap-2 mt-2 mb-1">
				<span class="text-blue-400 font-medium shrink-0 select-none mt-0.5">
					{formatCwdForDisplay(currentWorkingDirectory)}
				</span>
				<input
					bind:this={inputRef}
					bind:value={commandInput}
					onkeydown={handleKeyDown}
					disabled={isExecuting}
					class="flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50 min-w-0 p-0 border-none focus:ring-0 h-auto"
					type="text"
					autocomplete="off"
					spellcheck="false"
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Custom scrollbar styles for dark theme enforcement */
	div::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	div::-webkit-scrollbar-track {
		background: transparent;
	}

	div::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.2);
		border-radius: 9999px;
	}

	div::-webkit-scrollbar-thumb:hover {
		background-color: rgba(255, 255, 255, 0.3);
	}
</style>
