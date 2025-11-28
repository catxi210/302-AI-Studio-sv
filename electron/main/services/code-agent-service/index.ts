import {
	createClaudeCodeSandbox,
	deleteClaudeCodeSandbox,
	listClaudeCodeSandboxes,
	listClaudeCodeSessions,
	updateClaudeCodeSandbox,
} from "@electron/main/apis/code-agent";
import type {
	CodeAgentCreateResult,
	CreateClaudeCodeSandboxRequest,
} from "@shared/storage/code-agent";
import type { ThreadParmas } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { broadcastService } from "../broadcast-service";
import { storageService } from "../storage-service";
import {
	claudeCodeSandboxStorage,
	claudeCodeStorage,
	codeAgentStorage,
} from "../storage-service/code-agent";

export class CodeAgentService {
	constructor() {
		this.updateClaudeCodeSandboxes();
	}

	private async _updateClaudeCodeSandboxes(): Promise<void> {
		try {
			const { isOK, sandboxes: existingSandboxes } =
				await claudeCodeSandboxStorage.getClaudeCodeSandboxes();
			const isFirstInit = !isOK || existingSandboxes.length === 0;

			const response = await listClaudeCodeSandboxes();
			if (response.success) {
				const list = response.list.map((sandbox) => {
					const existingSandbox = existingSandboxes.find((s) => s.sandboxId === sandbox.sandbox_id);

					return {
						sandboxId: sandbox.sandbox_id,
						sandboxRemark: sandbox.sandbox_name,
						diskTotal: existingSandbox?.diskTotal ?? "",
						diskUsed: existingSandbox?.diskUsed ?? "",
						diskUsage: existingSandbox?.diskUsage ?? "pending",
						status: sandbox.status,
						llmModel: sandbox.llm_model,
						createdAt: sandbox.created_at,
						updatedAt: sandbox.updated_at,
						deletedAt: sandbox.deleted_at,
						sessionInfos: isFirstInit ? [] : (existingSandbox?.sessionInfos ?? []),
					};
				});
				await claudeCodeSandboxStorage.setClaudeCodeSandboxes(list);
			}
		} catch (error) {
			console.error("Error listing Claude code sandboxes:", error);
		}
	}

	private async _createClaudeCodeSandbox(
		threadId: string,
		sandboxCfg: CreateClaudeCodeSandboxRequest,
	): Promise<{ createdResult: CodeAgentCreateResult; sandboxId: string }> {
		const { isOK, sandboxId } = await claudeCodeStorage.getClaudeCodeSandboxId(threadId);
		if (isOK && sandboxId !== "") {
			this.notifySandboxUpdated(threadId, sandboxId);
			return { createdResult: "already-exist", sandboxId };
		}

		const response = await createClaudeCodeSandbox(sandboxCfg);
		if (response.success) {
			const { sandbox_id: sandboxId, sandbox_name: sandboxRemark } = response.data;

			this.notifySandboxUpdated(threadId, sandboxId);
			await claudeCodeStorage.setClaudeCodeSandboxInfo(threadId, sandboxId, sandboxRemark);

			return { createdResult: "success", sandboxId };
		}
		return { createdResult: "failed", sandboxId: "" };
	}

	async updateClaudeCodeSandboxes(): Promise<void> {
		await this._updateClaudeCodeSandboxes();
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await codeAgentStorage.removeCodeAgentState(threadId);
	}

	async createClaudeCodeSandbox(
		threadId: string,
		sandboxCfg: CreateClaudeCodeSandboxRequest,
	): Promise<{ createdResult: CodeAgentCreateResult; sandboxId: string }> {
		return this._createClaudeCodeSandbox(threadId, sandboxCfg);
	}

	// ******************************* IPC Methods ******************************* //
	async updateClaudeCodeSandboxModel(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandbox_id: string,
		llm_model: string,
	): Promise<{ isOK: boolean; llm_model: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, llm_model);
			if (response.success) {
				await claudeCodeStorage.setClaudeCodeModel(threadId, llm_model);
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

	async updateClaudeCodeSessions(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
	): Promise<{ isOK: boolean }> {
		try {
			const { success, session_list } = await listClaudeCodeSessions(sandboxId);
			if (!success) {
				return { isOK: false };
			}
			const list = session_list.map((session) => ({
				sessionId: session.session_id,
				workspacePath: session.workspace_path,
				note: session.note ?? "",
			}));
			await claudeCodeSandboxStorage.setClaudeCodeSessions(sandboxId, list);
			return { isOK: true };
		} catch (error) {
			console.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}

	private notifySandboxUpdated(threadId: string, sandboxId: string): void {
		broadcastService.broadcastChannelToAll("code-agent:sandbox-updated", {
			threadId,
			sandboxId,
		});
	}

	async updateClaudeCodeCurrentSessionIdByThreadId(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sessionId: string,
	): Promise<{ isOK: boolean }> {
		try {
			await claudeCodeStorage.updateClaudeCodeCurrentSessionIdByThreadId(threadId, sessionId);
			return { isOK: true };
		} catch (error) {
			console.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeSandboxRemark(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
		remark: string,
	): Promise<{ isOK: boolean; remark: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, undefined, remark);
			if (response.success) {
				return { isOK: true, remark };
			}
			return { isOK: false, remark: "" };
		} catch (error) {
			console.error("Error updating Claude code sandbox:", error);
			return { isOK: false, remark: "" };
		}
	}

	async createClaudeCodeSandboxByIpc(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandboxName: string,
	): Promise<{ isOK: boolean; sandboxId: string }> {
		try {
			const targetThread = await storageService.getItemInternal("app-thread:" + threadId);
			if (!targetThread) {
				return { isOK: false, sandboxId: "" };
			}
			const cfg: CreateClaudeCodeSandboxRequest = {
				llm_model: (targetThread as ThreadParmas).selectedModel?.id ?? "claude-sonnet-4-5-20250929",
				sandbox_name: sandboxName,
			};

			const { createdResult, sandboxId } = await this._createClaudeCodeSandbox(threadId, cfg);
			const isOK = createdResult === "success";
			if (isOK) {
				this._updateClaudeCodeSandboxes();
			}
			return { isOK, sandboxId };
		} catch (error) {
			console.error("Error creating Claude code sandbox:", error);
			return { isOK: false, sandboxId: "" };
		}
	}

	async deleteClaudeCodeSandboxByIpc(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
	): Promise<{ isOK: boolean; error?: string }> {
		try {
			const response = await deleteClaudeCodeSandbox(sandbox_id);
			if (response.success) {
				await this.updateClaudeCodeSandboxes();
				return { isOK: true };
			}
			return { isOK: false };
		} catch (error) {
			return { isOK: false, error: error instanceof Error ? error.message : "Unknown error" };
		}
	}
}

export const codeAgentService = new CodeAgentService();
