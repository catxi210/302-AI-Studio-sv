import { type } from "arktype";

export const sandboxLink = type({
	sandboxId: "string",
	threadId: "string",
});
export type SandboxLink = typeof sandboxLink.infer;
export const claudeCodeGlobalConfig = type({
	sandboxLinks: sandboxLink.array(),
});
export type ClaudeCodeGlobalConfig = typeof claudeCodeGlobalConfig.infer;

export const codeAgentType = type("'local' | 'remote'");
export type CodeAgentType = typeof codeAgentType.infer;
export const CodeAgentConfigMetadata = type({
	enabled: "boolean",
	threadId: "string",
	type: codeAgentType,
	currentAgentId: "string",
});
export type CodeAgentConfigMetadata = typeof CodeAgentConfigMetadata.infer;

export const CodeAgentMetadata = type({
	model: "string",
	/**
	 * local agent only
	 */
	currentWorkspacePath: "string",
	workspacePaths: "string[]",
	variables: "string[]",
	/**
	 * remote agent only
	 */
	currentSessionId: "string",
	sessionIds: "string[]",
	sandboxId: "string",
});
export type CodeAgentMetadata = typeof CodeAgentMetadata.infer;

export const CodeAgentCfgs = type({
	baseUrl: "string",
	model: "string",
});
export type CodeAgentCfgs = typeof CodeAgentCfgs.infer;

export const CodeAgentCreateResult = type("'already-exist' | 'success' | 'failed'");
export type CodeAgentCreateResult = typeof CodeAgentCreateResult.infer;

export const CodeAgentSandboxStatus = type("'waiting-for-sandbox' | 'sandbox-created'");
export type CodeAgentSandboxStatus = typeof CodeAgentSandboxStatus.infer;
