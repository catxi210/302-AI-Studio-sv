import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { claudeCodeAgentState } from "./claude-code-state.svelte";

export const persistedClaudeCodeSandboxState = new PersistedState<ClaudeCodeSandboxInfo[]>(
	"CodeAgentStorage:claude-code-sandbox-state",
	[],
);

const { updateClaudeCodeSandboxesByIpc, updateClaudeCodeSessions } =
	window.electronAPI.codeAgentService;

class ClaudeCodeSandboxState {
	sandboxRemarkMap = $state(new Map<string, string>());

	sandboxes = $derived.by(() => {
		const _sanboxes = persistedClaudeCodeSandboxState.current;
		return persistedClaudeCodeSandboxState.current.map((sandbox) => {
			this.sandboxRemarkMap.set(sandbox.sandboxId, sandbox.sandboxRemark);
			return {
				key: sandbox.sandboxId,
				label: `${sandbox.sandboxId} (${m.remark()}: ${sandbox.sandboxRemark === "" ? m.remark_null() : sandbox.sandboxRemark})`,
				value: sandbox.sandboxId,
			};
		});
	});

	sessions = $derived.by(() => {
		const sandbox = persistedClaudeCodeSandboxState.current.find(
			(sandbox) => sandbox.sandboxId === claudeCodeAgentState.customSandboxId,
		);
		if (!sandbox) return [];
		const sessionOpts = sandbox.sessionInfos.map((session) => {
			return {
				key: session.sessionId,
				label: session.note && session.note !== "" ? session.note : session.sessionId,
				value: session.sessionId,
			};
		});
		return sessionOpts;
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
			toast.error(m.refresh_sandboxes_failed());
		}

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
			await persistedClaudeCodeSandboxState.flush();

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
}

export const claudeCodeSandboxState = new ClaudeCodeSandboxState();
