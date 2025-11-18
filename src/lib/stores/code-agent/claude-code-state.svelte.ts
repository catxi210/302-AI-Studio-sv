import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { type CodeAgentMetadata } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { match } from "ts-pattern";

const { checkClaudeCodeSandbox } = window.electronAPI.codeAgentService;

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

function getInitialData() {
	const initialData = {
		model: "claude-sonnet-4-5-20250929",
		currentWorkspacePath: "",
		workspacePaths: [],
		variables: [],
		currentSessionId: "",
		sessionIds: [],
		sandboxId: "",
	};
	return initialData;
}

export const persistedClaudeCodeAgentState = new PersistedState<CodeAgentMetadata>(
	"CodeAgentStorage:claude-code-agent-state" + "-" + threadId,
	getInitialData(),
);

class ClaudeCodeAgentState {
	baseUrl = "https://api.302.ai/302/claude-code/v1";

	sessionMode = $state<"select-existing-agent" | "new-agent">("new-agent");
	customSessionId = $state("");
	customSandboxId = $state("");

	model = $derived(persistedClaudeCodeAgentState.current.model);
	currentSessionId = $derived(persistedClaudeCodeAgentState.current.currentSessionId);
	sessionIds = $derived(persistedClaudeCodeAgentState.current.sessionIds);
	sandboxId = $derived(persistedClaudeCodeAgentState.current.sandboxId);

	ready = $derived.by(() =>
		match(this.sessionMode)
			.with(
				"select-existing-agent",
				() => this.customSessionId !== "" && this.customSandboxId !== "",
			)
			.with("new-agent", () => this.customSessionId !== "")
			.otherwise(() => false),
	);

	private updateState(partial: Partial<CodeAgentMetadata>): void {
		persistedClaudeCodeAgentState.current = {
			...persistedClaudeCodeAgentState.current,
			...partial,
		};
	}

	addSessionId(sessionId: string): void {
		this.updateState({ sessionIds: [...this.sessionIds, sessionId] });
	}

	removeSessionId(sessionId: string): void {
		this.updateState({ sessionIds: this.sessionIds.filter((id) => id !== sessionId) });
	}

	updateCurrentSessionId(sessionId: string): void {
		this.updateState({ currentSessionId: sessionId });
	}

	updateSandboxId(sandboxId: string): void {
		this.updateState({ sandboxId });
	}

	async handleAgentModeEnable(): Promise<boolean> {
		if (this.sessionMode === "select-existing-agent") {
			const { isOK, valid } = await checkClaudeCodeSandbox(this.customSandboxId);
			if (!isOK || !valid) {
				toast.error(m.error_verify_sandbox());
				return false;
			}
			this.updateState({
				sessionIds: [this.customSessionId],
				currentSessionId: this.customSessionId,
				sandboxId: this.customSandboxId,
			});
		} else if (this.sessionMode === "new-agent") {
			this.updateState({
				sessionIds: [this.customSessionId],
				currentSessionId: this.customSessionId,
			});
		}
		return true;
	}
}

export const claudeCodeAgentState = new ClaudeCodeAgentState();
