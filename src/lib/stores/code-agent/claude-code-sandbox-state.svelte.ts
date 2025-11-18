import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";

export const persistedClaudeCodeSandboxState = new PersistedState<ClaudeCodeSandboxInfo[]>(
	"CodeAgentStorage:claude-code-sandbox-state",
	[],
);

const { updateClaudeCodeSandboxesByIpc } = window.electronAPI.codeAgentService;

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

	async refreshSandboxes(): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxesByIpc();
		if (!isOK) {
			toast.error(m.refresh_sandboxes_failed());
		}

		return isOK;
	}
}

export const claudeCodeSandboxState = new ClaudeCodeSandboxState();
