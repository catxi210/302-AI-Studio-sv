import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";
import type { Model } from "@302ai/studio-plugin-sdk";
import {
	CodeAgentConfigMetadata,
	type CodeAgentCfgs,
	type CodeAgentSandboxStatus,
	type CodeAgentType,
} from "@shared/storage/code-agent";
import { match } from "ts-pattern";
import { claudeCodeAgentState } from "./claude-code-state.svelte";

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

const INITIAL_CODE_AGENT_CONFIG: CodeAgentConfigMetadata = {
	enabled: false,
	threadId: threadId,
	type: "remote",
	currentAgentId: "claude-code",
};

export const persistedCodeAgentConfigState = new PersistedState<CodeAgentConfigMetadata>(
	"CodeAgentStorage:code-agent-config-state" + "-" + threadId,
	INITIAL_CODE_AGENT_CONFIG,
);

const { updateClaudeCodeSandboxModel } = window.electronAPI.codeAgentService;

class CodeAgentState {
	enabled = $derived.by(() => persistedCodeAgentConfigState.current?.enabled ?? false);
	type = $derived.by(() => persistedCodeAgentConfigState.current?.type ?? "remote");
	currentAgentId = $derived.by(
		() => persistedCodeAgentConfigState.current?.currentAgentId ?? "claude-code",
	);

	isFreshTab = $derived(!chatState.hasMessages);
	inCodeAgentMode = $derived(!this.isFreshTab && this.enabled);

	sandboxStatus = $derived.by<CodeAgentSandboxStatus>(() => {
		return match(this.currentAgentId)
			.with("claude-code", () =>
				claudeCodeAgentState.sandboxId === "" ? "waiting-for-sandbox" : "sandbox-created",
			)
			.otherwise(() => "waiting-for-sandbox");
	});
	canEnable = $derived.by(() =>
		match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.ready)
			.otherwise(() => false),
	);

	private updateState(partial: Partial<CodeAgentConfigMetadata>): void {
		persistedCodeAgentConfigState.current = {
			...(persistedCodeAgentConfigState.current ?? INITIAL_CODE_AGENT_CONFIG),
			...partial,
		};
	}

	updateCurrentAgentId(agentId: string): void {
		this.updateState({ currentAgentId: agentId });
	}

	resetCurrentAgentId(): void {
		this.updateState({ currentAgentId: "" });
	}

	updateType(type: CodeAgentType): void {
		this.updateState({ type });
	}

	updateEnabled(enabled: boolean): void {
		this.updateState({ enabled });
	}

	getCodeAgentCfgs(): CodeAgentCfgs {
		return match(this.currentAgentId)
			.with("claude-code", () => ({
				baseUrl: claudeCodeAgentState.baseUrl,
				model: claudeCodeAgentState.sandboxId,
			}))
			.otherwise(() => ({ baseUrl: "", model: "" }));
	}

	async updateCodeAgentCfgs(): Promise<boolean> {
		if (this.currentAgentId === "claude-code") {
			return claudeCodeAgentState.handleAgentModeEnable();
		}
		return false;
	}

	async updateCurrentSessionId(sessionId: string): Promise<void> {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.updateCurrentSessionId(sessionId);
		}
	}

	async updateSessionRemark(remark: string): Promise<void> {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.updateSessionRemark(remark);
		}
	}

	getCurrentSessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.currentSessionId)
			.otherwise(() => "");
	}

	getSandboxId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.sandboxId)
			.otherwise(() => "");
	}

	get sessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.currentSessionId)
			.otherwise(() => "");
	}

	async handleCodeAgentModelChange(model: Model): Promise<boolean> {
		if (this.currentAgentId === "claude-code") {
			const { isOK } = await updateClaudeCodeSandboxModel(threadId, this.getSandboxId(), model.id);
			return isOK;
		}

		return false;
	}
}

export const codeAgentState = new CodeAgentState();
