import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { ClaudeCodeGlobalConfig, SandboxLink } from "@shared/storage/code-agent";

export const persistedClaudeCodeGlobalState = new PersistedState<ClaudeCodeGlobalConfig>(
	"CodeAgentStorage:claude-code-global-config",
	{
		sandboxLinks: [],
	},
);

class ClaudeCodeGlobalState {
	private updateState(partial: Partial<ClaudeCodeGlobalConfig>): void {
		persistedClaudeCodeGlobalState.current = {
			...persistedClaudeCodeGlobalState.current,
			...partial,
		};
	}

	addSandboxLink(sandboxLink: SandboxLink): void {
		this.updateState({
			sandboxLinks: [...persistedClaudeCodeGlobalState.current.sandboxLinks, sandboxLink],
		});
	}

	removeSandboxLink(sandboxLink: SandboxLink): void {
		this.updateState({
			sandboxLinks: persistedClaudeCodeGlobalState.current.sandboxLinks.filter(
				(link) => link.sandboxId !== sandboxLink.sandboxId,
			),
		});
	}
}

export const claudeCodeGlobalState = new ClaudeCodeGlobalState();
