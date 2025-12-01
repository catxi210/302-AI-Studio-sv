import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { type CodeAgentMetadata } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";

const { checkClaudeCodeSandbox, createClaudeCodeSandboxByIpc } =
	window.electronAPI.codeAgentService;

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
		sandboxRemark: "",
	};
	return initialData;
}

export const persistedClaudeCodeAgentState = new PersistedState<CodeAgentMetadata>(
	"CodeAgentStorage:claude-code-agent-state" + "-" + threadId,
	getInitialData(),
);

class ClaudeCodeAgentState {
	baseUrl = "https://api.302.ai/302/claude-code/v1";

	customSessionId = $state("");
	customSandboxName = $state("");

	selectedSessionId = $state("new");
	selectedSandboxId = $state("auto");

	model = $derived(persistedClaudeCodeAgentState.current?.model ?? "");
	currentSessionId = $derived(persistedClaudeCodeAgentState.current?.currentSessionId ?? "");
	sessionIds = $derived(persistedClaudeCodeAgentState.current?.sessionIds ?? []);
	sandboxId = $derived(persistedClaudeCodeAgentState.current?.sandboxId ?? "");
	sandboxRemark = $derived(persistedClaudeCodeAgentState.current?.sandboxRemark ?? "");

	// ready = $derived.by(() =>
	// 	match(this.agentMode)
	// 		.with("existing", () => this.customSessionId !== "" && this.selectedSandboxId !== "")
	// 		.with("new", () => true)
	// 		.otherwise(() => false),
	// );

	agentMode = $derived.by(() => {
		return this.selectedSessionId === "new" ? "new" : "existing";
	});

	private updateState(partial: Partial<CodeAgentMetadata>): void {
		persistedClaudeCodeAgentState.current = {
			...(persistedClaudeCodeAgentState.current ?? getInitialData()),
			...partial,
		};
	}

	addSessionId(sessionId: string): void {
		this.updateState({ sessionIds: [...this.sessionIds, sessionId] });
	}

	updateCurrentSessionId(sessionId: string): void {
		this.updateState({ currentSessionId: sessionId });
	}

	updateSandboxId(sandboxId: string): void {
		this.updateState({ sandboxId });
	}

	updateSandboxRemark(sandboxRemark: string): void {
		this.updateState({ sandboxRemark });
	}

	async handleAgentModeEnable(): Promise<boolean> {
		if (this.agentMode === "existing") {
			const { isOK, valid, sandboxInfo } = await checkClaudeCodeSandbox(this.selectedSandboxId);
			if (!isOK || !valid) {
				toast.error(m.error_verify_sandbox());
				return false;
			}

			this.updateState({
				sandboxId: this.selectedSandboxId,
				sandboxRemark: sandboxInfo?.sandboxRemark,
				model: sandboxInfo?.llmModel,
			});
		} else if (this.agentMode === "new") {
			this.updateState({
				currentSessionId: this.selectedSessionId,
				sandboxRemark: "",
			});
		}
		return true;
	}

	async handleCreateNewSandbox(): Promise<boolean> {
		const { isOK, sandboxId } = await createClaudeCodeSandboxByIpc(
			threadId,
			this.customSandboxName,
		);
		if (!isOK) {
			toast.error(m.error_create_sandbox());
			return false;
		}

		this.selectedSandboxId = sandboxId;
		toast.success(m.success_create_sandbox());
		return true;
	}
}

export const claudeCodeAgentState = new ClaudeCodeAgentState();
