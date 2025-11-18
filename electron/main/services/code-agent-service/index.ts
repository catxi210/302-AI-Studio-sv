import {
	createClaudeCodeSandbox,
	listClaudeCodeSandboxes,
	updateClaudeCodeSandbox,
} from "@electron/main/apis/code-agent";
import type { CodeAgentCreateResult } from "@shared/storage/code-agent";
import type { IpcMainInvokeEvent } from "electron";
import {
	claudeCodeSandboxStorage,
	claudeCodeStorage,
	codeAgentStorage,
} from "../storage-service/code-agent";

export class CodeAgentService {
	private codeAgentStorage;
	private claudeCodeStorage;
	private claudeCodeSandboxStorage;

	constructor() {
		this.codeAgentStorage = codeAgentStorage;
		this.claudeCodeStorage = claudeCodeStorage;
		this.claudeCodeSandboxStorage = claudeCodeSandboxStorage;

		this.updateClaudeCodeSandboxes();
	}

	private async _updateClaudeCodeSandboxes(): Promise<void> {
		try {
			const { isOK, sandboxes: existingSandboxes } =
				await this.claudeCodeSandboxStorage.getClaudeCodeSandboxes();
			const isFirstInit = !isOK || existingSandboxes.length === 0;

			const response = await listClaudeCodeSandboxes();
			if (response.success) {
				const list = response.list.map((sandbox) => {
					const existingSandbox = existingSandboxes.find((s) => s.sandboxId === sandbox.sandbox_id);

					return {
						sandboxId: sandbox.sandbox_id,
						status: sandbox.status,
						llmModel: sandbox.llm_model,
						createdAt: sandbox.created_at,
						updatedAt: sandbox.updated_at,
						deletedAt: sandbox.deleted_at,
						sessionInfos: isFirstInit ? [] : (existingSandbox?.sessionInfos ?? []),
					};
				});
				await this.claudeCodeSandboxStorage.setClaudeCodeSandboxes(list);
			}
		} catch (error) {
			console.error("Error listing Claude code sandboxes:", error);
		}
	}

	async updateClaudeCodeSandboxes(): Promise<void> {
		await this._updateClaudeCodeSandboxes();
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await this.codeAgentStorage.removeCodeAgentState(threadId);
	}

	async createClaudeCodeSandbox(
		threadId: string,
		llm_model?: string,
	): Promise<{ createdResult: CodeAgentCreateResult; sandboxId: string }> {
		const { isOK, sandboxId } = await this.claudeCodeStorage.getClaudeCodeSandboxId(threadId);
		if (isOK && sandboxId !== "") {
			return { createdResult: "already-exist", sandboxId };
		}

		const response = await createClaudeCodeSandbox(llm_model);
		if (response.success) {
			const sandboxId = response.data.sandbox_id;
			await this.claudeCodeStorage.setClaudeCodeSandboxId(threadId, sandboxId);
			return { createdResult: "success", sandboxId };
		}
		return { createdResult: "failed", sandboxId: "" };
	}

	// ******************************* IPC Methods ******************************* //
	async updateClaudeCodeSandbox(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandbox_id: string,
		llm_model: string,
	): Promise<{ isOK: boolean; llm_model: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, llm_model);
			if (response.success) {
				await this.claudeCodeStorage.setClaudeCodeModel(threadId, llm_model);
				return { isOK: true, llm_model };
			}
			return { isOK: false, llm_model: "" };
		} catch (error) {
			console.error("Error updating Claude code sandbox:", error);
			return { isOK: false, llm_model: "" };
		}
	}

	async checkClaudeCodeSandbox(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
	): Promise<{ isOK: boolean; valid: boolean }> {
		try {
			const response = await listClaudeCodeSandboxes();
			if (response.success) {
				const sandbox = response.list.find((sandbox) => sandbox.sandbox_id === sandboxId);
				return { isOK: true, valid: !!sandbox };
			}
			return { isOK: false, valid: false };
		} catch (error) {
			console.error("Error checking Claude code sandbox:", error);
			return { isOK: false, valid: false };
		}
	}

	async updateClaudeCodeSandboxesByIpc(_event: IpcMainInvokeEvent): Promise<{ isOK: boolean }> {
		try {
			await this.updateClaudeCodeSandboxes();
			return { isOK: true };
		} catch (error) {
			console.error("Error updating Claude code sandboxes:", error);
			return { isOK: false };
		}
	}
}

export const codeAgentService = new CodeAgentService();
