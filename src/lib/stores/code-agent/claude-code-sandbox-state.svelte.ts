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
	sandboxes = $derived.by(() =>
		persistedClaudeCodeSandboxState.current.map((sandbox) => {
			return {
				key: sandbox.sandboxId,
				label: sandbox.sandboxId,
				value: sandbox.sandboxId,
			};
		}),
	);
	sessions = $derived.by(() => {
		const sandbox = persistedClaudeCodeSandboxState.current.find(
			(sandbox) => sandbox.sandboxId === claudeCodeAgentState.customSandboxId,
		);
		if (!sandbox) return [];
		const sessionOpts = sandbox.sessionInfos.map((session) => ({
			key: session.sessionId,
			label: session.sessionId,
			value: session.sessionId,
		}));
		return sessionOpts;
	});

	async refreshSandboxes(): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxesByIpc();
		if (!isOK) {
			toast.error(m.refresh_sandboxes_failed());
		}

		return isOK;
	}

	async refreshSessions(sandboxId: string): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSessions(sandboxId);
		if (!isOK) {
			toast.error(m.refresh_sessions_failed());
		} else {
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
