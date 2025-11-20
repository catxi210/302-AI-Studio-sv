import type { SandboxFileInfo } from "$lib/api/sandbox-file";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { CodeAgentType } from "@shared/storage/code-agent";
import { SvelteDate } from "svelte/reactivity";

/**
 * Get threadId from window.tab or default to "shell"
 */
function getThreadId(): string {
	const tab = window.tab;
	if (tab && typeof tab === "object" && "threadId" in tab && typeof tab.threadId === "string") {
		return tab.threadId;
	}
	return "shell";
}

export type HtmlPreviewMode = "preview" | "edit";

export interface FileContentCache {
	content: string;
	modifiedTime?: string; // File's modified_time when cached
	cachedAt: string; // When the content was cached
	ttl?: number; // Time to live in milliseconds
}

export interface TerminalHistoryLine {
	type: "command" | "output" | "error";
	content: string;
	cwd?: string;
}

export interface AgentPreviewStorage {
	fileList: SandboxFileInfo[];
	fileContents: Record<string, FileContentCache>; // filePath -> FileContentCache
	lastUpdated: string; // ISO timestamp
	// Deployment information
	deployedUrl?: string;
	deploymentId?: string;
	deployedAt?: string;
	// Selected file information
	selectedFilePath?: string;
	// Terminal current working directory
	currentWorkingDirectory?: string;
	// Terminal history (commands and outputs with their cwd)
	terminalHistory?: TerminalHistoryLine[];
	type?: CodeAgentType;
}

// Main storage structure: [sandboxId:sessionId] -> AgentPreviewStorage
export interface AgentPreviewStorageMap {
	[key: string]: AgentPreviewStorage;
}

// Helper function to get ISO timestamp string
function getISOString(): string {
	return new Date().toISOString();
}

// Get storage key for a sandbox + session combination
function getStorageKey(sandboxId: string, sessionId: string): string {
	return `${sandboxId}:${sessionId}`;
}

// Get threadId from window.tab or default to "shell"
const threadId = getThreadId();

// Initialize PersistedState with empty map (per-thread storage)
const persistedAgentPreviewStorage = new PersistedState<AgentPreviewStorageMap>(
	"AgentPreviewStorage:agent-preview-data-" + threadId,
	{},
);

export class AgentPreviewState {
	isVisible = $state(false);
	isPinned = $state(false);
	mode = $state<HtmlPreviewMode>("preview");
	sandBoxId = $state<string | undefined>(undefined);
	// context = $state<HtmlPreviewContext | null>(null);

	/**
	 * Get the storage map (reactive)
	 */
	private get storageMap(): AgentPreviewStorageMap {
		return persistedAgentPreviewStorage.current;
	}

	/**
	 * Load file list and contents from storage
	 */
	async loadFromStorage(sandboxId: string, sessionId: string): Promise<AgentPreviewStorage | null> {
		if (!sandboxId || !sessionId) {
			return null;
		}

		const key = getStorageKey(sandboxId, sessionId);
		const storage = this.storageMap[key];
		return storage || null;
	}

	/**
	 * Save file list and contents to storage
	 */
	async saveToStorage(
		sandboxId: string,
		sessionId: string,
		data: AgentPreviewStorage,
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const key = getStorageKey(sandboxId, sessionId);
		persistedAgentPreviewStorage.current = {
			...this.storageMap,
			[key]: {
				...data,
				lastUpdated: getISOString(),
			},
		};
	}

	/**
	 * Get file content from storage
	 * @param currentModifiedTime - Current file's modified_time to check if cache is stale
	 */
	async getFileContent(
		sandboxId: string,
		sessionId: string,
		filePath: string,
		currentModifiedTime?: string,
	): Promise<string | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		if (!storage) {
			return null;
		}

		const cached = storage.fileContents[filePath];
		if (!cached) {
			return null;
		}

		// Handle backward compatibility: old format stored content as string directly
		if (typeof cached === "string") {
			return null; // Force reload to update to new format
		}

		// Check cache TTL (time to live)
		if (cached.ttl) {
			const cacheAge = Date.now() - new SvelteDate(cached.cachedAt).getTime();
			if (cacheAge > cached.ttl) {
				return null; // Cache expired
			}
		}

		// If file was modified after caching, cache is stale
		if (currentModifiedTime && cached.modifiedTime && currentModifiedTime !== cached.modifiedTime) {
			return null; // Force reload from API
		}

		return cached.content;
	}

	/**
	 * Save file content to storage
	 */
	async setFileContent(
		sandboxId: string,
		sessionId: string,
		filePath: string,
		content: string,
		modifiedTime?: string,
	): Promise<void> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: {
				...(storage?.fileContents || {}),
				[filePath]: {
					content,
					modifiedTime,
					cachedAt: getISOString(),
				},
			},
			lastUpdated: getISOString(),
			// Preserve deployment info when saving file content
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: storage?.selectedFilePath,
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	/**
	 * Clear file contents cache (but keep file list)
	 * Useful when refreshing file list to ensure users see latest content
	 */
	async clearFileContents(sandboxId: string, sessionId: string): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		if (storage) {
			await this.saveToStorage(sandboxId, sessionId, {
				fileList: storage.fileList,
				fileContents: {}, // Clear all file contents
				lastUpdated: getISOString(),
				type: storage.type,
			});
		}
	}

	/**
	 * Set deployment information for a sandbox session
	 */
	async setDeploymentInfo(
		sandboxId: string,
		sessionId: string,
		url: string,
		deploymentId: string,
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: url,
			deploymentId: deploymentId,
			deployedAt: getISOString(),
			selectedFilePath: storage?.selectedFilePath, // Preserve selected file path
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	/**
	 * Get deployment information for a sandbox session
	 */
	async getDeploymentInfo(
		sandboxId: string,
		sessionId: string,
	): Promise<{ url: string; deploymentId: string; deployedAt: string } | null> {
		if (!sandboxId || !sessionId) {
			return null;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		if (!storage || !storage.deployedUrl || !storage.deploymentId) {
			return null;
		}

		return {
			url: storage.deployedUrl,
			deploymentId: storage.deploymentId,
			deployedAt: storage.deployedAt || storage.lastUpdated,
		};
	}

	/**
	 * Set selected file path for a sandbox session
	 */
	async setSelectedFilePath(sandboxId: string, sessionId: string, filePath: string): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: filePath,
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	/**
	 * Get selected file path for a sandbox session
	 */
	async getSelectedFilePath(sandboxId: string, sessionId: string): Promise<string | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		return storage?.selectedFilePath || null;
	}

	/**
	 * Get current working directory for a sandbox session
	 */
	async getCurrentWorkingDirectory(sandboxId: string, sessionId: string): Promise<string | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		return storage?.currentWorkingDirectory || null;
	}

	/**
	 * Set current working directory for a sandbox session
	 */
	async setCurrentWorkingDirectory(
		sandboxId: string,
		sessionId: string,
		cwd: string,
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: storage?.selectedFilePath,
			currentWorkingDirectory: cwd,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	/**
	 * Get terminal history for a sandbox session
	 */
	async getTerminalHistory(
		sandboxId: string,
		sessionId: string,
	): Promise<TerminalHistoryLine[] | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		return storage?.terminalHistory || null;
	}

	/**
	 * Set terminal history for a sandbox session
	 */
	async setTerminalHistory(
		sandboxId: string,
		sessionId: string,
		history: TerminalHistoryLine[],
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: storage?.selectedFilePath,
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: history,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	openPreview(sandBoxId: string) {
		// this.context = {
		// 	messageId: payload.messageId,
		// 	messagePartIndex: payload.messagePartIndex,
		// 	blockId: payload.blockId,
		// 	meta: payload.meta,
		// };
		this.sandBoxId = sandBoxId;
		this.mode = "preview";
		this.isVisible = true;
	}

	closePreview() {
		this.isVisible = false;
		this.isPinned = false;
		this.mode = "preview";
	}

	togglePreview() {}

	setMode(mode: HtmlPreviewMode) {
		this.mode = mode;
	}

	togglePin() {
		this.isPinned = !this.isPinned;
	}
}

export const agentPreviewState = new AgentPreviewState();
