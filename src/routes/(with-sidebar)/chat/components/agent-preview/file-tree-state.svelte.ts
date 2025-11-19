import {
	copySandboxFile,
	deleteSandboxFile,
	downloadSandboxFile,
	listSandboxFiles,
	renameSandboxFile,
	type SandboxFileInfo,
} from "$lib/api/sandbox-file";
import { m } from "$lib/paraglide/messages";
import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";
import { claudeCodeAgentState } from "$lib/stores/code-agent";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
import { toast } from "svelte-sonner";
import { SvelteDate, SvelteMap, SvelteSet } from "svelte/reactivity";
import { DEFAULT_WORKSPACE_PATH } from "./constants";
import { handleError, validatePath, validateSandboxId, withRetry } from "./utils";

export interface TreeNode extends SandboxFileInfo {
	children: TreeNode[];
	depth: number;
	isExpanded?: boolean;
}

interface TreeCache {
	files: SandboxFileInfo[];
	nodes: TreeNode[];
	expandedDirs: SvelteSet<string>;
}

/**
 * Path utility functions
 */
const pathUtils = {
	getParentDir: (path: string): string => path.substring(0, path.lastIndexOf("/")),
	getFileName: (path: string): string => path.split("/").pop() || "file",
	join: (...parts: string[]): string => parts.filter(Boolean).join("/"),
	normalize: (path: string): string => (path.startsWith("/") ? path : `/${path}`),
};

/**
 * Set utility functions for SvelteSet
 */
function addToSet<T>(set: SvelteSet<T>, item: T): SvelteSet<T> {
	const newSet = new SvelteSet(set);
	newSet.add(item);
	return newSet;
}

function removeFromSet<T>(set: SvelteSet<T>, item: T): SvelteSet<T> {
	const newSet = new SvelteSet(set);
	newSet.delete(item);
	return newSet;
}

export class FileTreeState {
	// State properties
	sandboxId = $state<string>("");
	files = $state<SandboxFileInfo[]>([]);
	treeNodes = $state<TreeNode[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	expandedDirs = $state(new SvelteSet([DEFAULT_WORKSPACE_PATH]));
	selectedFile = $state<string | null>(null);
	loadedDirs = $state(new SvelteSet<string>());
	loadingDirs = $state(new SvelteSet<string>());
	downloadingPaths = $state(new SvelteSet<string>());
	operatingPaths = $state(new SvelteSet<string>());
	copiedFilePath = $state<string | null>(null);
	treeNodesCache = $state<TreeCache | null>(null);

	// Derived state
	isStreaming = $derived(chatState.isStreaming);

	constructor(sandboxId: string) {
		this.sandboxId = sandboxId;
	}

	updateSandboxId(sandboxId: string) {
		this.sandboxId = sandboxId;
	}

	/**
	 * Get 302.AI provider API key
	 */
	private get302ApiKey(): string {
		const provider = persistedProviderState.current.find((p) => p.name === "302.AI" && p.enabled);
		const key = provider?.apiKey || "";
		if (key) {
			console.log("[FileTree] API key found (length:", key.length, ")");
		}
		return key;
	}

	/**
	 * Build tree structure with memoization
	 */
	buildTreeStructure(fileList: SandboxFileInfo[]): TreeNode[] {
		if (!fileList || fileList.length === 0) {
			console.log("[FileTree] buildTreeStructure: empty file list");
			return [];
		}

		// Check cache
		if (
			this.treeNodesCache &&
			this.treeNodesCache.files.length === fileList.length &&
			this.treeNodesCache.expandedDirs.size === this.expandedDirs.size &&
			JSON.stringify(this.treeNodesCache.files.map((f) => f.path).sort()) ===
				JSON.stringify(fileList.map((f) => f.path).sort()) &&
			JSON.stringify([...this.treeNodesCache.expandedDirs].sort()) ===
				JSON.stringify([...this.expandedDirs].sort())
		) {
			console.log("[FileTree] Using cached tree structure");
			return this.treeNodesCache.nodes;
		}

		// Create path to node mapping
		const nodeMap = new SvelteMap<string, TreeNode>();
		const rootNodes: TreeNode[] = [];

		// Sort by path depth to ensure parent nodes are processed before children
		const sortedFiles = [...fileList].sort((a, b) => {
			const aDepth = a.path.split("/").filter(Boolean).length;
			const bDepth = b.path.split("/").filter(Boolean).length;
			if (aDepth !== bDepth) return aDepth - bDepth;
			return a.path.localeCompare(b.path);
		});

		// Find minimum depth for relative depth calculation
		const minDepth = Math.min(...sortedFiles.map((f) => f.path.split("/").filter(Boolean).length));

		console.log("[FileTree] buildTreeStructure: processing", sortedFiles.length, "files");

		for (const file of sortedFiles) {
			const pathParts = file.path.split("/").filter(Boolean);
			const absoluteDepth = pathParts.length;
			const depth = absoluteDepth - minDepth; // Relative depth

			const node: TreeNode = {
				...file,
				children: [],
				depth,
				isExpanded: this.expandedDirs.has(file.path),
			};

			nodeMap.set(file.path, node);

			// Find parent node
			const parentPath = pathParts.slice(0, -1).join("/");
			const fullParentPath = parentPath ? `/${parentPath}` : "";

			if (fullParentPath && nodeMap.has(fullParentPath)) {
				const parentNode = nodeMap.get(fullParentPath)!;
				parentNode.children.push(node);
			} else {
				rootNodes.push(node);
			}
		}

		console.log("[FileTree] buildTreeStructure: created", rootNodes.length, "root nodes");

		// Update cache
		this.treeNodesCache = {
			files: [...fileList],
			nodes: rootNodes,
			expandedDirs: new SvelteSet(this.expandedDirs),
		};

		return rootNodes;
	}

	/**
	 * Rebuild tree structure (invalidates cache and rebuilds)
	 */
	rebuildTree(): void {
		this.treeNodesCache = null;
		this.treeNodes = this.buildTreeStructure(this.files);
	}

	/**
	 * Infer loaded directories from file list
	 */
	private inferLoadedDirsFromFiles(fileList: SandboxFileInfo[]): SvelteSet<string> {
		const dirs = new SvelteSet<string>();
		for (const file of fileList) {
			const parentDir = pathUtils.getParentDir(file.path);
			if (parentDir) {
				dirs.add(parentDir);
			}
		}
		return dirs;
	}

	/**
	 * Check if directory has direct children
	 */
	hasDirectChildren(dirPath: string): boolean {
		const normalizedDir = pathUtils.normalize(dirPath);
		const normalizedDirPath = normalizedDir.endsWith("/")
			? normalizedDir.slice(0, -1)
			: normalizedDir;

		return this.files.some((file) => {
			const fileDir = pathUtils.getParentDir(file.path);
			return fileDir === normalizedDirPath;
		});
	}

	/**
	 * Save file list to storage, preserving existing data
	 */
	private async saveToStorage(
		updates?: Partial<{ selectedFilePath: string | null }>,
	): Promise<void> {
		const sessionId = claudeCodeAgentState.currentSessionId;
		if (!sessionId) {
			return;
		}

		const existingStorage = await agentPreviewState.loadFromStorage(this.sandboxId, sessionId);
		await agentPreviewState.saveToStorage(this.sandboxId, sessionId, {
			fileList: this.files,
			fileContents: existingStorage?.fileContents || {},
			deployedUrl: existingStorage?.deployedUrl,
			deploymentId: existingStorage?.deploymentId,
			deployedAt: existingStorage?.deployedAt,
			selectedFilePath:
				updates?.selectedFilePath ?? this.selectedFile ?? existingStorage?.selectedFilePath,
			lastUpdated: new SvelteDate().toISOString(),
		});
	}

	/**
	 * Load file list from storage
	 */
	async loadFromStorage(clearIfNotFound: boolean = false): Promise<void> {
		if (!this.sandboxId) {
			return;
		}

		const sessionId = claudeCodeAgentState.currentSessionId;
		if (!sessionId) {
			console.log("[FileTree] No sessionId available");
			return;
		}

		try {
			const storage = await agentPreviewState.loadFromStorage(this.sandboxId, sessionId);
			if (storage && storage.fileList.length > 0) {
				this.files = storage.fileList;
				this.treeNodes = this.buildTreeStructure(this.files);
				this.loadedDirs = this.inferLoadedDirsFromFiles(this.files);
				console.log(
					"[FileTree] Loaded from storage:",
					this.files.length,
					"files,",
					this.loadedDirs.size,
					"directories inferred as loaded, last updated:",
					storage.lastUpdated,
				);
			} else if (clearIfNotFound) {
				console.log("[FileTree] No data in storage for this sandbox/session, clearing files");
				this.files = [];
				this.treeNodes = [];
				this.loadedDirs = new SvelteSet();
			} else {
				console.log("[FileTree] No data in storage, keeping existing files");
			}
		} catch (e) {
			console.error("[FileTree] Failed to load from storage:", e);
			if (clearIfNotFound) {
				this.files = [];
				this.treeNodes = [];
				this.loadedDirs = new SvelteSet();
			}
		}
	}

	/**
	 * Load files from API
	 */
	async loadFiles(path: string = DEFAULT_WORKSPACE_PATH, merge: boolean = false): Promise<void> {
		if (!this.sandboxId) {
			console.log("[FileTree] No sandboxId provided");
			return;
		}

		if (!validateSandboxId(this.sandboxId)) {
			handleError(new Error("Invalid sandbox ID format"), "Load files");
			return;
		}

		if (!validatePath(path)) {
			handleError(new Error("Invalid path format"), "Load files");
			return;
		}

		// Do not load files while agent is streaming
		if (this.isStreaming) {
			console.log("[FileTree] Skipping file load - agent is streaming");
			return;
		}

		// Skip if already loaded (for lazy loading)
		if (merge && this.loadedDirs.has(path)) {
			console.log("[FileTree] Directory already loaded:", path);
			return;
		}

		// Skip if currently loading
		if (this.loadingDirs.has(path)) {
			console.log("[FileTree] Directory already loading:", path);
			return;
		}

		this.loadingDirs = addToSet(this.loadingDirs, path);

		if (!merge) {
			this.loading = true;
		}
		this.error = null;
		console.log(
			"[FileTree] Loading files for sandbox:",
			this.sandboxId,
			"path:",
			path,
			"merge:",
			merge,
		);

		try {
			const apiKey = this.get302ApiKey();
			if (!apiKey) {
				this.error = "302.AI API key not found";
				handleError(new Error(this.error), "Load files");
				return;
			}

			const response = await withRetry(
				() => listSandboxFiles(this.sandboxId, path, apiKey, undefined, 2),
				3,
				1000,
			);
			console.log("[FileTree] Response:", response);

			if (response.success && response.filelist) {
				if (merge) {
					// Merge new files into existing files array, avoiding duplicates
					const existingPaths = new SvelteSet(this.files.map((f) => f.path));
					const newFiles = response.filelist.filter((f) => !existingPaths.has(f.path));
					this.files = [...this.files, ...newFiles];
					console.log(
						"[FileTree] Merged",
						newFiles.length,
						"new files into existing",
						this.files.length - newFiles.length,
						"files",
					);
				} else {
					// Replace all files (initial load or refresh)
					this.files = response.filelist;
					console.log("[FileTree] Loaded files:", this.files.length);
				}

				// Mark directory as loaded
				this.loadedDirs = addToSet(this.loadedDirs, path);

				// Rebuild tree
				this.rebuildTree();
				console.log("[FileTree] Built tree nodes:", this.treeNodes.length);

				// Save to storage
				await this.saveToStorage();
				console.log("[FileTree] Saved file list, preserved file contents cache");
			} else {
				console.log("[FileTree] No files in response");
				if (!merge) {
					this.files = [];
					this.treeNodes = [];
				}
			}
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to load files";
			handleError(e, "Load sandbox files", false);
			if (!merge) {
				this.files = [];
				this.treeNodes = [];
				this.treeNodesCache = null;
			}
		} finally {
			this.loadingDirs = removeFromSet(this.loadingDirs, path);
			if (!merge) {
				this.loading = false;
			}
		}
	}

	/**
	 * Refresh file tree (reset and reload from root)
	 */
	async refreshFileTree(): Promise<void> {
		this.loadedDirs = new SvelteSet();
		this.treeNodesCache = null;
		this.expandedDirs = new SvelteSet([DEFAULT_WORKSPACE_PATH]);
		await this.loadFiles(DEFAULT_WORKSPACE_PATH, false);
	}

	/**
	 * Toggle directory expansion
	 */
	async toggleDir(path: string): Promise<void> {
		const isExpanding = !this.expandedDirs.has(path);

		if (isExpanding) {
			// Expanding: fetch folder contents if not already loaded and no direct children exist
			if (!this.loadedDirs.has(path) && !this.hasDirectChildren(path)) {
				console.log("[FileTree] Expanding and loading directory:", path);
				await this.loadFiles(path, true); // Merge mode
			} else if (!this.loadedDirs.has(path) && this.hasDirectChildren(path)) {
				// We have children from storage, mark as loaded without fetching
				console.log("[FileTree] Directory has children from storage, marking as loaded:", path);
				this.loadedDirs = addToSet(this.loadedDirs, path);
			}

			this.expandedDirs = addToSet(this.expandedDirs, path);
		} else {
			// Collapsing: just remove from expanded set
			this.expandedDirs = removeFromSet(this.expandedDirs, path);
		}

		// Rebuild tree to update expanded state
		this.rebuildTree();
	}

	/**
	 * Validate operation prerequisites
	 */
	private validateOperation(path: string): { valid: boolean; apiKey: string | null } {
		if (!this.sandboxId) {
			toast.error(m.toast_file_operation_sandbox_id_not_available());
			return { valid: false, apiKey: null };
		}

		if (this.isStreaming) {
			toast.error(m.toast_file_operation_streaming());
			return { valid: false, apiKey: null };
		}

		if (this.operatingPaths.has(path)) {
			return { valid: false, apiKey: null };
		}

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_file_operation_api_key_not_found());
			return { valid: false, apiKey: null };
		}

		return { valid: true, apiKey };
	}

	/**
	 * Update files and rebuild tree
	 */
	private async updateFilesAndRebuild(
		newFiles: SandboxFileInfo[],
		selectedPathUpdate?: string | null,
	): Promise<void> {
		this.files = newFiles;
		if (selectedPathUpdate !== undefined) {
			this.selectedFile = selectedPathUpdate;
		}
		await this.saveToStorage({ selectedFilePath: this.selectedFile });
		this.rebuildTree();
	}

	/**
	 * Rename file
	 */
	async renameFile(oldPath: string, newPath: string, newName: string): Promise<boolean> {
		const validation = this.validateOperation(oldPath);
		if (!validation.valid || !validation.apiKey) {
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, oldPath);
		const toastId = toast.loading(m.toast_file_renaming());

		try {
			const response = await renameSandboxFile(this.sandboxId, oldPath, newPath, validation.apiKey);

			if (response.success) {
				toast.success(m.toast_file_rename_success(), { id: toastId });

				// Update file in list
				const fileIndex = this.files.findIndex((f) => f.path === oldPath);
				if (fileIndex !== -1) {
					this.files[fileIndex] = {
						...this.files[fileIndex],
						path: newPath,
						name: newName,
					};

					// Update selected file if it was renamed
					if (this.selectedFile === oldPath) {
						this.selectedFile = newPath;
					}

					await this.updateFilesAndRebuild(this.files, this.selectedFile);
				}
				return true;
			} else {
				const errorMsg = response.error || m.toast_file_rename_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_rename_failed();
			toast.error(errorMsg, { id: toastId });
			console.error("[FileTree] Failed to rename:", oldPath, e);
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, oldPath);
		}
	}

	/**
	 * Delete file or folder
	 */
	async deleteFile(path: string): Promise<boolean> {
		const validation = this.validateOperation(path);
		if (!validation.valid || !validation.apiKey) {
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, path);
		const toastId = toast.loading(m.toast_file_deleting());

		try {
			const response = await deleteSandboxFile(this.sandboxId, path, validation.apiKey);

			if (response.success) {
				toast.success(m.toast_file_delete_success(), { id: toastId });

				// Remove deleted file/folder and all children
				const newFiles = this.files.filter((f) => {
					if (f.path === path) {
						return false;
					}
					if (path.endsWith("/")) {
						return !f.path.startsWith(path);
					}
					return !f.path.startsWith(`${path}/`);
				});

				// Clear selected file if it was deleted
				const selectedPathUpdate =
					this.selectedFile === path || this.selectedFile?.startsWith(`${path}/`)
						? null
						: this.selectedFile;

				await this.updateFilesAndRebuild(newFiles, selectedPathUpdate);
				return true;
			} else {
				const errorMsg = response.error || m.toast_file_delete_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_delete_failed();
			toast.error(errorMsg, { id: toastId });
			console.error("[FileTree] Failed to delete:", path, e);
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, path);
		}
	}

	/**
	 * Copy file path
	 */
	copyFile(path: string): void {
		this.copiedFilePath = path;
		toast.success(m.toast_file_copy_success());
	}

	/**
	 * Paste file or folder
	 */
	async pasteFile(sourcePath: string, targetDir: SandboxFileInfo): Promise<boolean> {
		if (!this.sandboxId || !sourcePath) {
			return false;
		}

		if (targetDir.type !== "dir") {
			toast.error(m.toast_file_paste_target_not_dir());
			return false;
		}

		const validation = this.validateOperation(sourcePath);
		if (!validation.valid || !validation.apiKey) {
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, sourcePath);

		// Find source file
		const sourceFile = this.files.find((f) => f.path === sourcePath);
		if (!sourceFile) {
			toast.error(m.toast_file_paste_failed());
			this.operatingPaths = removeFromSet(this.operatingPaths, sourcePath);
			return false;
		}

		// Build destination path
		const sourceName = pathUtils.getFileName(sourcePath);
		const destPath = `${targetDir.path}/${sourceName}`;

		const toastId = toast.loading(m.toast_file_pasting());

		try {
			const response = await copySandboxFile(
				this.sandboxId,
				sourcePath,
				destPath,
				validation.apiKey,
			);

			if (response.success) {
				toast.success(m.toast_file_paste_success(), { id: toastId });

				// Update file list
				if (sourceFile.type === "file") {
					// File paste: add new file entry
					const newFile: SandboxFileInfo = {
						...sourceFile,
						path: destPath,
						name: sourceName,
					};
					if (!this.files.some((f) => f.path === destPath)) {
						this.files = [...this.files, newFile];
					}
				} else {
					// Folder paste: load target path contents
					try {
						const listResponse = await withRetry(
							() =>
								listSandboxFiles(this.sandboxId, destPath, validation.apiKey || "", undefined, 1),
							3,
							1000,
						);

						if (listResponse.success && listResponse.filelist) {
							const existingPaths = new SvelteSet(this.files.map((f) => f.path));
							const newFiles = listResponse.filelist.filter((f) => !existingPaths.has(f.path));
							this.files = [...this.files, ...newFiles];
							this.loadedDirs = addToSet(this.loadedDirs, destPath);
						}
					} catch (e) {
						console.error("[FileTree] Failed to load pasted folder contents:", e);
						// Even if loading fails, add folder itself
						const newFolder: SandboxFileInfo = {
							...sourceFile,
							path: destPath,
							name: sourceName,
						};
						if (!this.files.some((f) => f.path === destPath)) {
							this.files = [...this.files, newFolder];
						}
					}
				}

				// Expand target directory
				if (!this.expandedDirs.has(targetDir.path)) {
					this.expandedDirs = addToSet(this.expandedDirs, targetDir.path);
				}

				await this.updateFilesAndRebuild(this.files);
				return true;
			} else {
				const errorMsg = response.error || m.toast_file_paste_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_paste_failed();
			toast.error(errorMsg, { id: toastId });
			console.error("[FileTree] Failed to paste:", sourcePath, e);
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, sourcePath);
		}
	}

	/**
	 * Download file or folder
	 */
	async downloadFile(file: SandboxFileInfo): Promise<void> {
		if (!this.sandboxId) {
			toast.error(m.toast_download_sandbox_id_not_available());
			return;
		}

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_download_api_key_not_found());
			return;
		}

		// Prevent duplicate downloads
		if (this.downloadingPaths.has(file.path)) {
			return;
		}

		this.downloadingPaths = addToSet(this.downloadingPaths, file.path);

		const fileName = file.name || pathUtils.getFileName(file.path);
		const downloadToastId = toast.loading(m.toast_downloading_file({ fileName }));

		try {
			const response = await downloadSandboxFile(this.sandboxId, file.path, apiKey);

			console.log("[FileTree] Download API response:", JSON.stringify(response, null, 2));

			if (!response.result || response.result.length === 0) {
				toast.error(m.toast_download_no_info(), { id: downloadToastId });
				return;
			}

			toast.loading(m.toast_downloading_file({ fileName }), {
				id: downloadToastId,
			});

			// Process each result (file or folder)
			for (const result of response.result) {
				console.log("[FileTree] Processing result:", result);
				if (!result.file_list || result.file_list.length === 0) {
					console.warn("[FileTree] No file_list in result:", result);
					continue;
				}

				if (result.path_type === "dir") {
					// Folder download: download files one by one
					await this.downloadFolder(result, file.path, downloadToastId);
				} else {
					// Single file download
					await this.downloadSingleFile(result, file, response, downloadToastId);
				}
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_download_failed();
			toast.error(errorMsg, { id: downloadToastId });
			console.error("[FileTree] Failed to download:", file.path, e);
		} finally {
			this.downloadingPaths = removeFromSet(this.downloadingPaths, file.path);
		}
	}

	/**
	 * Download folder (helper method)
	 */
	private async downloadFolder(
		result: { file_list: Array<{ upload_url?: string; sandbox_path: string }> },
		basePath: string,
		toastId: string | number,
	): Promise<void> {
		let successCount = 0;
		let failCount = 0;

		toast.loading(m.toast_downloading_folder(), {
			id: toastId,
		});

		for (let i = 0; i < result.file_list.length; i++) {
			const fileItem = result.file_list[i];
			console.log("[FileTree] Processing file item:", fileItem);
			if (!fileItem.upload_url || fileItem.upload_url.trim() === "") {
				console.warn("[FileTree] Empty upload_url for:", fileItem.sandbox_path);
				failCount++;
				continue;
			}

			try {
				const fileResponse = await fetch(fileItem.upload_url);
				if (!fileResponse.ok) {
					failCount++;
					continue;
				}

				const relativePath = fileItem.sandbox_path.replace(basePath, "").replace(/^\//, "");
				const fileName = relativePath || pathUtils.getFileName(fileItem.sandbox_path);
				const blob = await fileResponse.blob();

				this.downloadBlob(blob, fileName);
				successCount++;

				toast.loading(m.toast_downloading_folder(), {
					id: toastId,
				});
			} catch (e) {
				console.error("[FileTree] Failed to download file:", fileItem.sandbox_path, e);
				failCount++;

				toast.loading(m.toast_downloading_folder(), {
					id: toastId,
				});
			}
		}

		// Show result
		if (successCount > 0) {
			const failedText = failCount > 0 ? m.toast_download_folder_success_failed({ failCount }) : "";
			toast.success(
				m.toast_download_folder_success({
					count: successCount,
					plural: successCount > 1 ? m.toast_download_folder_success_plural() : "",
					failedText,
				}),
				{ id: toastId },
			);
		} else {
			toast.error(
				m.toast_download_folder_failed({
					failCount,
					plural: failCount > 1 ? "s" : "",
				}),
				{ id: toastId },
			);
		}
	}

	/**
	 * Download single file (helper method)
	 */
	private async downloadSingleFile(
		result: {
			file_list: Array<{ upload_url?: string; sandbox_path: string }>;
		},
		file: SandboxFileInfo,
		response: {
			result: Array<{ file_list: Array<{ upload_url?: string; sandbox_path: string }> }>;
			_directContent?: string;
			_blobContent?: Blob;
			_contentType?: string;
		},
		toastId: string | number,
	): Promise<void> {
		const fileItem = result.file_list[0];
		console.log("[FileTree] Processing single file:", fileItem);

		try {
			let blob: Blob;
			let downloadFileName = file.name || pathUtils.getFileName(fileItem.sandbox_path);

			toast.loading(m.toast_downloading_file({ fileName: downloadFileName }), {
				id: toastId,
			});

			// Check for direct content or upload_url
			if (response._blobContent) {
				console.log("[FileTree] Using blob content from API response");
				blob = response._blobContent;

				const isZip = response._contentType?.includes("application/zip");

				if ((file.type === "dir" || isZip) && !downloadFileName.endsWith(".zip")) {
					downloadFileName += ".zip";
				}
			} else if (
				(!fileItem.upload_url || fileItem.upload_url.trim() === "") &&
				response._directContent
			) {
				console.log("[FileTree] Using direct content from API response");
				const contentType = response._contentType || "text/plain";
				blob = new Blob([response._directContent], { type: contentType });
			} else if (fileItem.upload_url && fileItem.upload_url.trim() !== "") {
				console.log("[FileTree] Downloading from upload_url:", fileItem.upload_url);
				toast.loading(m.toast_downloading_file({ fileName: downloadFileName }), {
					id: toastId,
				});
				const fileResponse = await fetch(fileItem.upload_url);
				if (!fileResponse.ok) {
					throw new Error(m.toast_download_file_failed({ error: fileResponse.statusText }));
				}
				blob = await fileResponse.blob();
			} else {
				throw new Error(m.toast_download_no_url_or_content());
			}

			toast.loading(m.toast_downloading_file({ fileName: downloadFileName }), {
				id: toastId,
			});

			this.downloadBlob(blob, downloadFileName);

			toast.success(m.toast_download_file_success({ fileName: downloadFileName }), {
				id: toastId,
			});
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_download_failed();
			toast.error(errorMsg, { id: toastId });
			console.error("[FileTree] Failed to download file:", file.path, e);
		}
	}

	/**
	 * Download blob helper
	 */
	private downloadBlob(blob: Blob, fileName: string): void {
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	/**
	 * Select file
	 */
	selectFile(file: SandboxFileInfo): void {
		if (file.type === "file") {
			this.selectedFile = file.path;
		}
	}
}
