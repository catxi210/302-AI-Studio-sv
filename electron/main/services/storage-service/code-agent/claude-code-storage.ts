import type {
	ClaudeCodeSandboxInfo,
	ClaudeCodeSessionInfo,
	CodeAgentMetadata,
} from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { nanoid } from "nanoid";
import { StorageService } from "..";

class ClaudeCodeStorage extends StorageService<CodeAgentMetadata> {
	private prefix = "claude-code-agent-state";
	private defaultModel = "claude-sonnet-4-5-20250929";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	private async ensureMetadata(key: string): Promise<CodeAgentMetadata> {
		const existingMetadata = await this.getItemInternal(key);
		if (!isNull(existingMetadata)) {
			return existingMetadata;
		}

		const sessionId = nanoid();
		const initialMetadata: CodeAgentMetadata = {
			model: this.defaultModel,
			currentWorkspacePath: "",
			workspacePaths: [],
			variables: [],
			currentSessionId: sessionId,
			sessionIds: [sessionId],
			sandboxId: "",
			sandboxRemark: "",
		};

		await this.setItemInternal(key, initialMetadata);
		return initialMetadata;
	}

	async setClaudeCodeSandboxId(threadId: string, sandboxId: string): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);

			if (isNull(codeAgentMetadata)) return { isOK: false };

			codeAgentMetadata.sandboxId = sandboxId;
			await this.setItemInternal(key, codeAgentMetadata);
			return { isOK: true };
		} catch (error) {
			console.error("Error setting Claude code sandbox ID:", error);
			return { isOK: false };
		}
	}

	async getClaudeCodeSandboxId(threadId: string): Promise<{ isOK: boolean; sandboxId: string }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);
			if (isNull(codeAgentMetadata)) return { isOK: false, sandboxId: "" };
			return { isOK: true, sandboxId: codeAgentMetadata.sandboxId };
		} catch (error) {
			console.error("Error getting Claude code sandbox ID:", error);
			return { isOK: false, sandboxId: "" };
		}
	}

	async setClaudeCodeModel(threadId: string, llm_model: string): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);
			if (isNull(codeAgentMetadata)) return { isOK: false };
			codeAgentMetadata.model = llm_model;
			await this.setItemInternal(key, codeAgentMetadata);
			return { isOK: true };
		} catch (error) {
			console.error("Error setting Claude code model:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeCurrentSessionIdByThreadId(
		threadId: string,
		sessionId: string,
	): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);
			if (isNull(codeAgentMetadata)) return { isOK: false };
			if (codeAgentMetadata.sandboxId !== "") {
				codeAgentMetadata.currentSessionId = sessionId;
			}
			await this.setItemInternal(key, codeAgentMetadata);
			return { isOK: true };
		} catch (error) {
			console.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}
}

class ClaudeCodeSandboxStorage extends StorageService<ClaudeCodeSandboxInfo[]> {
	private prefix = "claude-code-sandbox-state";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async getClaudeCodeSandboxes(): Promise<{ isOK: boolean; sandboxes: ClaudeCodeSandboxInfo[] }> {
		try {
			const sandboxes = await this.getItemInternal(this.prefix);
			if (isNull(sandboxes)) return { isOK: false, sandboxes: [] };
			return { isOK: true, sandboxes };
		} catch (error) {
			console.error("Error getting Claude code sandboxes:", error);
			return { isOK: false, sandboxes: [] };
		}
	}

	async setClaudeCodeSandboxes(list: ClaudeCodeSandboxInfo[]): Promise<{ isOK: boolean }> {
		try {
			await this.setItemInternal(this.prefix, list);
			return { isOK: true };
		} catch (error) {
			console.error("Error setting Claude code sandboxes:", error);
			return { isOK: false };
		}
	}

	async setClaudeCodeSessions(
		sandboxId: string,
		sessions: ClaudeCodeSessionInfo[],
	): Promise<{ isOK: boolean }> {
		try {
			const { isOK, sandboxes } = await this.getClaudeCodeSandboxes();
			if (!isOK) return { isOK: false };

			const sandbox = sandboxes.find((s) => s.sandboxId === sandboxId);
			if (!sandbox) return { isOK: false };

			sandbox.sessionInfos = sessions;

			await this.setItemInternal(this.prefix, sandboxes);
			return { isOK: true };
		} catch (error) {
			console.error("Error setting Claude code sessions:", error);
			return { isOK: false };
		}
	}
}

export const claudeCodeStorage = new ClaudeCodeStorage();
export const claudeCodeSandboxStorage = new ClaudeCodeSandboxStorage();
