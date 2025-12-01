import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { match } from "ts-pattern";
import { claudeCodeAgentState } from "./claude-code-state.svelte";

export const persistedClaudeCodeSandboxState = new PersistedState<ClaudeCodeSandboxInfo[]>(
	"CodeAgentStorage:claude-code-sandbox-state",
	[],
);

const newSessionItem = {
	key: "new",
	label: m.select_session_new(),
	value: "new",
};

const {
	updateClaudeCodeSandboxesByIpc,
	updateClaudeCodeSessions,
	deleteClaudeCodeSandboxByIpc,
	updateClaudeCodeSandboxRemark,
} = window.electronAPI.codeAgentService;

class ClaudeCodeSandboxState {
	sandboxRemarkMap = $state(new Map<string, string>());

	sandboxes = $derived.by(() => {
		const _sanboxes = persistedClaudeCodeSandboxState.current;
		return [
			{
				key: "auto",
				label: m.select_sandbox_auto(),
				value: "auto",
			},
			...persistedClaudeCodeSandboxState.current.map((sandbox) => {
				this.sandboxRemarkMap.set(sandbox.sandboxId, sandbox.sandboxRemark);
				return {
					key: sandbox.sandboxId,
					label: `${sandbox.sandboxId} (${m.remark()}: ${sandbox.sandboxRemark === "" ? m.remark_null() : sandbox.sandboxRemark})`,
					value: sandbox.sandboxId,
				};
			}),
		];
	});

	sessions = $derived.by(() => {
		const sanboxes = persistedClaudeCodeSandboxState.current;

		return match(claudeCodeAgentState.selectedSandboxId)
			.with("auto", () => {
				const allSessionInfos = sanboxes.flatMap((sandbox) => sandbox.sessionInfos);
				return [
					newSessionItem,
					...allSessionInfos.map((session) => {
						return {
							key: session.workspacePath,
							label: session.note && session.note !== "" ? session.note : session.sessionId,
							value: session.sessionId,
						};
					}),
				];
			})
			.otherwise(() => {
				const targetSandbox = sanboxes.find(
					(sandbox) => sandbox.sandboxId === claudeCodeAgentState.selectedSandboxId,
				);
				if (!targetSandbox) {
					return [newSessionItem];
				}
				return [
					newSessionItem,
					...targetSandbox.sessionInfos.map((session) => {
						return {
							key: session.workspacePath,
							label: session.note && session.note !== "" ? session.note : session.sessionId,
							value: session.sessionId,
						};
					}),
				];
			});
	});

	/**
	 * Get the workspace path for the current session
	 * Returns the session's workspacePath if available, empty string otherwise
	 */
	currentSessionWorkspacePath = $derived.by(() => {
		const sandboxId = claudeCodeAgentState.sandboxId;
		const sessionId = claudeCodeAgentState.currentSessionId;

		console.log("[ClaudeCodeSandboxState] Computing currentSessionWorkspacePath:", {
			sandboxId,
			sessionId,
			sandboxCount: persistedClaudeCodeSandboxState.current.length,
		});

		const sandbox = persistedClaudeCodeSandboxState.current.find(
			(sandbox) => sandbox.sandboxId === sandboxId,
		);
		if (!sandbox) {
			console.log("[ClaudeCodeSandboxState] Sandbox not found for ID:", sandboxId);
			return "";
		}

		console.log(
			"[ClaudeCodeSandboxState] Found sandbox, sessionInfos count:",
			sandbox.sessionInfos.length,
		);

		const session = sandbox.sessionInfos.find((s) => s.sessionId === sessionId);
		const workspacePath = session?.workspacePath || "";

		console.log("[ClaudeCodeSandboxState] Session workspace path:", {
			sessionId,
			foundSession: !!session,
			workspacePath,
		});

		return workspacePath;
	});

	async refreshSandboxes(): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxesByIpc();
		if (!isOK) {
			toast.error(m.refresh_failed());
		}

		toast.success(m.refresh_success());
		return isOK;
	}

	async refreshSessions(sandboxId: string): Promise<boolean> {
		console.log("[ClaudeCodeSandboxState] refreshSessions called with sandboxId:", sandboxId);

		const { isOK } = await updateClaudeCodeSessions(sandboxId);

		console.log("[ClaudeCodeSandboxState] refreshSessions result:", {
			isOK,
			sandboxId,
		});

		if (!isOK) {
			toast.error(m.refresh_sessions_failed());
		} else {
			// Force refresh from storage to get the updated session data
			// This is needed because the main process updated the storage
			// and the sync to renderer might not have completed yet
			// await persistedClaudeCodeSandboxState.refresh();

			// Log the updated session data
			const sandbox = persistedClaudeCodeSandboxState.current.find(
				(s) => s.sandboxId === sandboxId,
			);
			console.log("[ClaudeCodeSandboxState] After refresh, sandbox sessionInfos:", {
				sandboxId,
				sessionInfos: sandbox?.sessionInfos,
			});

			const stillExisting = this.sessions.some(
				(session) => session.value === claudeCodeAgentState.customSessionId,
			);
			if (!stillExisting) {
				claudeCodeAgentState.customSessionId =
					this.sessions.length > 0 ? this.sessions[0].value : "";
			}
		}

		return isOK;
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		const { isOK, error } = await deleteClaudeCodeSandboxByIpc(sandboxId);
		if (isOK) {
			toast.success(m.delete_sandbox_success());
		} else {
			const errorMessage = error
				? `${m.delete_sandbox_failed()}: ${error}`
				: m.delete_sandbox_failed();
			toast.error(errorMessage);
		}
		return isOK;
	}

	async updateSandboxRemark(sandboxId: string, remark: string): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxRemark(sandboxId, remark);
		if (isOK) {
			toast.success(m.update_remark_success());
			await this.refreshSandboxes();
		} else {
			toast.error(m.update_remark_failed());
		}
		return isOK;
	}

	async handleSessionSelected(sessionId: string): Promise<void> {
		if (sessionId !== "new") {
			const sandboxList = persistedClaudeCodeSandboxState.current;
			const targetSandboxId = sandboxList.find((sandbox) =>
				sandbox.sessionInfos.find((sessionInfo) => sessionInfo.sessionId === sessionId),
			);
			if (targetSandboxId) {
				claudeCodeAgentState.selectedSandboxId = targetSandboxId.sandboxId;
			}
		}

		claudeCodeAgentState.selectedSessionId = sessionId;
	}

	async handleSelectSandbox(sandboxId: string): Promise<void> {
		if (sandboxId === "auto") {
			claudeCodeAgentState.selectedSessionId = "new";
		}

		claudeCodeAgentState.selectedSandboxId = sandboxId;
	}

	async updateSessionRemark(
		sandboxId: string,
		sessionId: string,
		remark: string,
	): Promise<boolean> {
		const { isOK } = await window.electronAPI.codeAgentService.updateClaudeCodeSessionRemark(
			sandboxId,
			sessionId,
			remark,
		);
		if (isOK) {
			toast.success(m.update_session_remark_success());
		} else {
			toast.error(m.update_session_remark_failed());
		}
		return isOK;
	}

	async deleteSession(sandboxId: string, sessionId: string): Promise<boolean> {
		const { isOK } = await window.electronAPI.codeAgentService.deleteClaudeCodeSession(
			sandboxId,
			sessionId,
		);
		if (isOK) {
			toast.success(m.delete_session_success());
		} else {
			toast.error(m.delete_session_failed());
		}
		return isOK;
	}
}

export const claudeCodeSandboxState = new ClaudeCodeSandboxState();
