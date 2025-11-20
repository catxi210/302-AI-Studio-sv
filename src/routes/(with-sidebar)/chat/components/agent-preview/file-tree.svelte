<script lang="ts">
	import type { SandboxFileInfo } from "$lib/api/sandbox-file";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeAgentState } from "$lib/stores/code-agent";
	import {
		ChevronDown,
		ChevronRight,
		Copy,
		Download,
		File,
		FileCode,
		FilePlus,
		FileUp,
		Folder,
		FolderInput,
		FolderOpen,
		FolderPlus,
		FolderUp,
		Loader2,
		Pencil,
		Scissors,
		Trash2,
		Upload,
	} from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { DEFAULT_WORKSPACE_PATH } from "./constants";
	import { FileTreeState, type TreeNode } from "./file-tree-state.svelte";

	interface Props {
		sandboxId: string;
		onFileSelect?: (file: SandboxFileInfo) => void;
		refreshTrigger?: number;
	}

	let { sandboxId, onFileSelect, refreshTrigger }: Props = $props();

	// Initialize file tree state
	const fileTreeState = new FileTreeState(sandboxId);

	// UI-specific state for rename dialog
	let renamingPath = $state<string | null>(null);
	let renameDialogOpen = $state(false);
	let renameInputValue = $state("");
	let renamingInProgress = $state(false);

	// UI-specific state for create file dialog
	let createFilePath = $state<string | null>(null); // The directory to create file in
	let createFileDialogOpen = $state(false);
	let createFileInputValue = $state("");
	let creatingFileInProgress = $state(false);

	// UI-specific state for create folder dialog
	let createFolderParentPath = $state<string | null>(null);
	let createFolderDialogOpen = $state(false);
	let createFolderInputValue = $state("");
	let createFolderInProgress = $state(false);

	// Validate file name
	function validateFileName(name: string): boolean {
		if (!name || name.trim().length === 0) {
			return false;
		}
		// 不允许包含特殊字符：/ \ : * ? " < > |
		const invalidChars = /[/\\:*?"<>|]/;
		return !invalidChars.test(name);
	}

	// Handle file click
	function handleFileClick(file: SandboxFileInfo) {
		fileTreeState.selectFile(file);
		onFileSelect?.(file);
	}

	// Handle create file start
	function handleCreateFile(parentPath: string = DEFAULT_WORKSPACE_PATH) {
		createFilePath = parentPath;
		createFileInputValue = "";
		createFileDialogOpen = true;
	}

	// Confirm create file
	async function confirmCreateFile() {
		if (!createFilePath) {
			return;
		}

		const fileName = createFileInputValue.trim();
		if (!validateFileName(fileName)) {
			toast.error(m.toast_file_rename_invalid_name()); // Use same error for now or add specific one
			return;
		}

		if (creatingFileInProgress) {
			return;
		}

		creatingFileInProgress = true;
		const newFile = await fileTreeState.createFile(fileName, createFilePath);
		creatingFileInProgress = false;

		if (newFile) {
			createFileDialogOpen = false;
			createFilePath = null;
			createFileInputValue = "";

			// Auto select the new file
			handleFileClick(newFile);
		}
	}

	// Handle rename
	async function handleRename(file: SandboxFileInfo) {
		if (file.type === "dir") {
			return;
		}
		renamingPath = file.path;
		renameInputValue = file.name;
		renameDialogOpen = true;
	}

	// Confirm rename
	async function confirmRename() {
		if (!renamingPath) {
			return;
		}

		const newName = renameInputValue.trim();
		if (!validateFileName(newName)) {
			toast.error(m.toast_file_rename_invalid_name());
			return;
		}

		const oldPath = renamingPath;
		const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
		const newPath = parentDir ? `${parentDir}/${newName}` : `/${newName}`;

		if (oldPath === newPath) {
			renameDialogOpen = false;
			renamingPath = null;
			renameInputValue = "";
			return;
		}

		if (renamingInProgress) {
			return;
		}

		renamingInProgress = true;
		const success = await fileTreeState.renameFile(oldPath, newPath, newName);
		renamingInProgress = false;

		if (success) {
			renameDialogOpen = false;
			renamingPath = null;
			renameInputValue = "";
		}
	}

	// Handle delete
	async function handleDelete(file: SandboxFileInfo) {
		await fileTreeState.deleteFile(file.path);
	}

	// Handle copy
	function handleCopy(file: SandboxFileInfo) {
		fileTreeState.copyFile(file.path);
	}

	// Handle paste
	async function handlePaste(targetDir: SandboxFileInfo) {
		if (!fileTreeState.copiedFilePath) {
			return;
		}
		await fileTreeState.pasteFile(fileTreeState.copiedFilePath, targetDir);
	}

	// Handle download
	async function handleDownload(file: SandboxFileInfo) {
		await fileTreeState.downloadFile(file);
	}

	// Track previous sandboxId and sessionId to detect changes
	let previousSandboxId = $state<string | undefined>(undefined);
	let previousSessionId = $state<string | null>(null);

	// Update state when sandboxId changes
	$effect(() => {
		if (sandboxId !== previousSandboxId) {
			fileTreeState.updateSandboxId(sandboxId);
			previousSandboxId = sandboxId;
		}
	});

	// Initialize or sandboxId/sessionId changes: load from storage
	$effect(() => {
		const currentSessionId = claudeCodeAgentState.currentSessionId;
		const sandboxChanged = sandboxId !== previousSandboxId;
		const sessionChanged = currentSessionId !== previousSessionId;

		const isRealChange =
			(sandboxChanged && previousSandboxId !== undefined) ||
			(sessionChanged && previousSessionId !== null);
		const isComponentRecreation = previousSandboxId === undefined && previousSessionId === null;

		if (sandboxId && currentSessionId) {
			if (sandboxChanged || sessionChanged) {
				console.log("[FileTree] Sandbox or session changed:", {
					sandboxId,
					sessionId: currentSessionId,
					sandboxChanged,
					sessionChanged,
					previousSandboxId,
					previousSessionId,
					isRealChange,
					isComponentRecreation,
				});

				const shouldClear = isRealChange;

				(async () => {
					await fileTreeState.loadFromStorage(shouldClear);

					const shouldLoadFromAPI =
						(isRealChange || isComponentRecreation) && fileTreeState.files.length === 0;

					if (shouldLoadFromAPI) {
						console.log("[FileTree] Loading from API (storage empty)");
						await fileTreeState.refreshFileTree();
					} else {
						console.log(
							"[FileTree] Skipping API load -",
							isComponentRecreation ? "component recreation with cached data" : "using cached data",
						);
					}
				})();

				previousSandboxId = sandboxId;
				previousSessionId = currentSessionId;
			}
		} else if (sandboxChanged && !sandboxId) {
			console.log("[FileTree] Sandbox cleared, keeping current files");
			previousSandboxId = undefined;
		}
	});

	// Watch for refresh trigger changes
	let previousRefreshTrigger = $state<number | undefined>(refreshTrigger);
	$effect(() => {
		if (refreshTrigger !== undefined && refreshTrigger !== previousRefreshTrigger) {
			previousRefreshTrigger = refreshTrigger;

			if (sandboxId && !fileTreeState.isStreaming) {
				console.log("[FileTree] Refresh triggered by parent, refreshing file tree");
				fileTreeState.refreshFileTree();
			} else if (fileTreeState.isStreaming) {
				console.log("[FileTree] Skipping refresh - agent is streaming");
			} else if (!sandboxId) {
				console.log("[FileTree] Skipping refresh - no sandboxId available");
			}
		}
	});

	// File upload
	let fileInput: HTMLInputElement;
	let pendingUploadPath = $state(DEFAULT_WORKSPACE_PATH);

	function triggerFileUpload(path: string = DEFAULT_WORKSPACE_PATH) {
		pendingUploadPath = path;
		fileInput.click();
	}

	async function handleFileUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];
			// Upload to pendingUploadPath
			await fileTreeState.uploadFile(file, pendingUploadPath);

			// Reset input and path
			target.value = "";
			pendingUploadPath = DEFAULT_WORKSPACE_PATH;
		}
	}

	// Folder upload - uses Electron dialog
	async function handleFolderUpload(targetPath: string = DEFAULT_WORKSPACE_PATH) {
		await fileTreeState.uploadFolder(targetPath);
	}

	// Handle create folder
	function handleCreateFolder(parentPath: string = DEFAULT_WORKSPACE_PATH) {
		createFolderParentPath = parentPath;
		createFolderInputValue = "";
		createFolderDialogOpen = true;
	}

	// Confirm create folder
	async function confirmCreateFolder() {
		if (!createFolderParentPath) {
			return;
		}

		const folderName = createFolderInputValue.trim();
		if (!validateFileName(folderName)) {
			toast.error(m.toast_file_rename_invalid_name());
			return;
		}

		if (createFolderInProgress) {
			return;
		}

		createFolderInProgress = true;
		const success = await fileTreeState.createFolder(createFolderParentPath, folderName);
		createFolderInProgress = false;

		if (success) {
			createFolderDialogOpen = false;
			createFolderParentPath = null;
			createFolderInputValue = "";
		}
	}
</script>

{#snippet contextMenuContent(node: TreeNode)}
	{@const isFile = node.type === "file"}
	{@const isDir = node.type === "dir"}
	{@const isOperating = fileTreeState.operatingPaths.has(node.path)}
	{@const isDownloading = fileTreeState.downloadingPaths.has(node.path)}
	{@const isPasteOperating = fileTreeState.copiedFilePath
		? fileTreeState.operatingPaths.has(fileTreeState.copiedFilePath)
		: false}

	<ContextMenu.Content>
		{#if isFile}
			<!-- Create File -->
			<ContextMenu.Item
				onSelect={() => handleCreateFile(isDir ? node.path : undefined)}
				disabled={isOperating || fileTreeState.isStreaming}
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<FilePlus class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.label_file_tree_create_file()}</span>
			</ContextMenu.Item>

			<!-- Rename -->
			<ContextMenu.Item
				onSelect={() => handleRename(node)}
				disabled={isOperating || fileTreeState.isStreaming}
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<Pencil class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.title_button_rename()}</span>
			</ContextMenu.Item>
		{/if}

		<!-- Copy -->
		<ContextMenu.Item
			onSelect={() => handleCopy(node)}
			disabled={isOperating || fileTreeState.isStreaming}
		>
			<Copy class="mr-2 h-4 w-4" />
			<span>{m.common_copy()}</span>
		</ContextMenu.Item>

		{#if isDir}
			<!-- Paste -->
			<ContextMenu.Item
				onSelect={() => handlePaste(node)}
				disabled={!fileTreeState.copiedFilePath || isPasteOperating || fileTreeState.isStreaming}
			>
				{#if isPasteOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<Scissors class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.label_file_tree_paste()}</span>
			</ContextMenu.Item>

			<!-- New Folder -->
			<ContextMenu.Item
				onSelect={() => handleCreateFolder(node.path)}
				disabled={isOperating || fileTreeState.isStreaming}
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<FolderPlus class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.label_file_tree_new_folder()}</span>
			</ContextMenu.Item>

			<!-- Create File -->
			<ContextMenu.Item
				onSelect={() => handleCreateFile(node.path)}
				disabled={isOperating || fileTreeState.isStreaming}
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<FilePlus class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.label_file_tree_create_file()}</span>
			</ContextMenu.Item>

			<!-- Upload File -->
			<ContextMenu.Item
				onSelect={() => triggerFileUpload(node.path)}
				disabled={isOperating || fileTreeState.isStreaming}
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<Upload class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.label_file_tree_upload_file()}</span>
			</ContextMenu.Item>

			<!-- Upload Folder -->
			<ContextMenu.Item
				onSelect={() => handleFolderUpload(node.path)}
				disabled={isOperating || fileTreeState.isStreaming}
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<FolderInput class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.label_file_tree_upload_folder()}</span>
			</ContextMenu.Item>
		{/if}

		<ContextMenu.Separator />

		<!-- Download -->
		<ContextMenu.Item onSelect={() => handleDownload(node)} disabled={isDownloading}>
			{#if isDownloading}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
			{:else}
				<Download class="mr-2 h-4 w-4" />
			{/if}
			<span>{m.label_file_tree_download()}</span>
		</ContextMenu.Item>

		<!-- Delete -->
		{#if !isDir}
			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => handleDelete(node)}
				disabled={isOperating || fileTreeState.isStreaming}
				class="text-destructive focus:text-destructive"
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}
					<Trash2 class="mr-2 h-4 w-4" />
				{/if}
				<span>{m.text_button_delete()}</span>
			</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
{/snippet}

{#snippet treeNodeItem(node: TreeNode)}
	{#if node.type === "dir"}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<button
					type="button"
					onclick={() => fileTreeState.toggleDir(node.path)}
					class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted transition-colors"
					style="padding-left: {node.depth * 20 + 12}px"
				>
					<div class="flex items-center gap-1.5 flex-1 min-w-0">
						{#if fileTreeState.loadingDirs.has(node.path)}
							<Loader2 class="h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground" />
							<Folder class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
						{:else if fileTreeState.expandedDirs.has(node.path)}
							<ChevronDown
								class="h-3 w-3 flex-shrink-0 text-muted-foreground transition-transform"
							/>
							<FolderOpen class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
						{:else}
							<ChevronRight
								class="h-3 w-3 flex-shrink-0 text-muted-foreground transition-transform"
							/>
							<Folder class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
						{/if}
						<span class="truncate text-xs font-medium">{node.name}</span>
					</div>
				</button>
			</ContextMenu.Trigger>
			{@render contextMenuContent(node)}
		</ContextMenu.Root>
		{#if fileTreeState.expandedDirs.has(node.path) && node.children.length > 0}
			{#each node.children as childNode (childNode.path)}
				{@render treeNodeItem(childNode)}
			{/each}
		{/if}
	{:else}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<button
					type="button"
					onclick={() => handleFileClick(node)}
					class={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted transition-colors ${
						fileTreeState.selectedFile === node.path ? "bg-muted" : ""
					}`}
					style="padding-left: {node.depth * 20 + 12}px"
				>
					<div class="flex items-center gap-1.5 flex-1 min-w-0">
						<span class="h-3 w-3 flex-shrink-0"></span>

						<File class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
						<span class="truncate text-xs">{node.name}</span>
					</div>
				</button>
			</ContextMenu.Trigger>
			{@render contextMenuContent(node)}
		</ContextMenu.Root>
	{/if}
{/snippet}

<div class="flex h-full flex-col bg-background">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border px-3 py-2 gap-2">
		<div class="flex items-center gap-1">
			<!-- Create File -->
			<button
				type="button"
				onclick={() => handleCreateFile()}
				class="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.title_button_create_file()}
			>
				<FileCode class="h-3.5 w-3.5" />
			</button>

			<!-- Create Folder -->
			<button
				type="button"
				onclick={() => handleCreateFolder()}
				class="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.title_button_new_folder()}
			>
				<Folder class="h-3.5 w-3.5" />
			</button>

			<!-- Upload File -->
			<button
				type="button"
				onclick={() => triggerFileUpload()}
				class="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.label_file_tree_upload_file()}
			>
				<FileUp class="h-3.5 w-3.5" />
			</button>
			<input bind:this={fileInput} type="file" class="hidden" onchange={handleFileUpload} />

			<!-- Upload Folder -->
			<button
				type="button"
				onclick={() => handleFolderUpload()}
				class="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.label_file_tree_upload_folder()}
			>
				<FolderUp class="h-3.5 w-3.5" />
			</button>

			<button
				type="button"
				onclick={() => {
					fileTreeState.downloadFile({
						path: DEFAULT_WORKSPACE_PATH,
						name: "workspace",
						type: "dir",
					});
				}}
				class="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.label_file_tree_download_all()}
			>
				<FolderInput class="h-3.5 w-3.5" />
			</button>
		</div>

		<!-- Refresh Button -->
		<button
			type="button"
			onclick={() => fileTreeState.refreshFileTree()}
			class="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
			disabled={fileTreeState.loading || fileTreeState.isStreaming}
			title={m.label_file_tree_refresh()}
		>
			<Loader2 class={`h-3.5 w-3.5 ${fileTreeState.loading ? "animate-spin" : ""}`} />
		</button>
	</div>

	<!-- File List -->
	<div class="flex-1 overflow-y-auto">
		{#if fileTreeState.error}
			<div class="m-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
				{fileTreeState.error}
			</div>
		{/if}

		{#if fileTreeState.loading && fileTreeState.treeNodes.length === 0}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
			</div>
		{:else if fileTreeState.treeNodes.length === 0}
			<div class="py-8 text-center text-xs text-muted-foreground">{m.label_file_tree_empty()}</div>
		{:else}
			<div class="p-1">
				{#each fileTreeState.treeNodes as node (node.path)}
					{@render treeNodeItem(node)}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Rename Dialog -->
	<Dialog.Root
		bind:open={renameDialogOpen}
		onOpenChange={(open) => {
			if (!open && !renamingInProgress) {
				renamingPath = null;
				renameInputValue = "";
				renamingInProgress = false;
			}
		}}
	>
		<Dialog.Content class="min-w-[400px]">
			<Dialog.Header>
				<Dialog.Title>{m.title_button_rename()}</Dialog.Title>
				<Dialog.Description>{m.text_description_rename_file()}</Dialog.Description>
			</Dialog.Header>

			<Input
				bind:value={renameInputValue}
				class="border-border !bg-background"
				placeholder={m.placeholder_input_rename()}
				disabled={renamingInProgress}
				onkeydown={(e) => {
					if (e.key === "Enter" && !renamingInProgress) {
						confirmRename();
					} else if (e.key === "Escape" && !renamingInProgress) {
						renameDialogOpen = false;
						renamingPath = null;
						renameInputValue = "";
						renamingInProgress = false;
					}
				}}
			/>

			<Dialog.Footer class="flex sm:justify-between">
				<Button
					variant="secondary"
					onclick={() => {
						renameDialogOpen = false;
						renamingPath = null;
						renameInputValue = "";
						renamingInProgress = false;
					}}
					disabled={renamingInProgress}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					variant="default"
					onclick={confirmRename}
					disabled={renamingInProgress ||
						!renameInputValue.trim() ||
						!validateFileName(renameInputValue.trim())}
				>
					{#if renamingInProgress}
						<Loader2 class=" h-4 w-4 animate-spin" />
					{/if}
					{m.text_button_save()}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Create File Dialog -->
	<Dialog.Root
		bind:open={createFileDialogOpen}
		onOpenChange={(open) => {
			if (!open && !creatingFileInProgress) {
				createFilePath = null;
				createFileInputValue = "";
				creatingFileInProgress = false;
			}
		}}
	>
		<Dialog.Content class="min-w-[400px]">
			<Dialog.Header>
				<Dialog.Title>{m.title_button_create_file()}</Dialog.Title>
				<Dialog.Description>{m.text_description_create_file()}</Dialog.Description>
			</Dialog.Header>

			<Input
				bind:value={createFileInputValue}
				class="border-border !bg-background"
				placeholder={m.placeholder_input_create_file()}
				disabled={creatingFileInProgress}
				onkeydown={(e) => {
					if (e.key === "Enter" && !creatingFileInProgress) {
						confirmCreateFile();
					} else if (e.key === "Escape" && !creatingFileInProgress) {
						createFileDialogOpen = false;
						createFilePath = null;
						createFileInputValue = "";
						creatingFileInProgress = false;
					}
				}}
			/>

			<Dialog.Footer class="flex sm:justify-between">
				<Button
					variant="secondary"
					onclick={() => {
						createFileDialogOpen = false;
						createFilePath = null;
						createFileInputValue = "";
						creatingFileInProgress = false;
					}}
					disabled={creatingFileInProgress}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					variant="default"
					onclick={confirmCreateFile}
					disabled={creatingFileInProgress ||
						!createFileInputValue.trim() ||
						!validateFileName(createFileInputValue.trim())}
				>
					{#if creatingFileInProgress}
						<Loader2 class=" h-4 w-4 animate-spin" />
					{/if}
					{m.label_button_confirm()}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Create Folder Dialog -->
	<Dialog.Root
		bind:open={createFolderDialogOpen}
		onOpenChange={(open) => {
			if (!open && !createFolderInProgress) {
				createFolderParentPath = null;
				createFolderInputValue = "";
				createFolderInProgress = false;
			}
		}}
	>
		<Dialog.Content class="min-w-[400px]">
			<Dialog.Header>
				<Dialog.Title>{m.title_button_new_folder()}</Dialog.Title>
				<Dialog.Description>{m.text_description_new_folder()}</Dialog.Description>
			</Dialog.Header>

			<Input
				bind:value={createFolderInputValue}
				class="border-border !bg-background"
				placeholder={m.placeholder_input_folder_name()}
				disabled={createFolderInProgress}
				onkeydown={(e) => {
					if (e.key === "Enter" && !createFolderInProgress) {
						confirmCreateFolder();
					} else if (e.key === "Escape" && !createFolderInProgress) {
						createFolderDialogOpen = false;
						createFolderParentPath = null;
						createFolderInputValue = "";
						createFolderInProgress = false;
					}
				}}
			/>

			<Dialog.Footer class="flex sm:justify-between">
				<Button
					variant="secondary"
					onclick={() => {
						createFolderDialogOpen = false;
						createFolderParentPath = null;
						createFolderInputValue = "";
						createFolderInProgress = false;
					}}
					disabled={createFolderInProgress}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					variant="default"
					onclick={confirmCreateFolder}
					disabled={createFolderInProgress ||
						!createFolderInputValue.trim() ||
						!validateFileName(createFolderInputValue.trim())}
				>
					{#if createFolderInProgress}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					{m.text_button_create()}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
