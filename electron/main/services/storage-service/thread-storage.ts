import {
	prefixStorage,
	type ThreadData,
	type ThreadMetadata,
	type ThreadParmas,
} from "@shared/types";
import { storageService, StorageService } from ".";
import { emitter } from "../broadcast-service";

export class ThreadStorage extends StorageService<ThreadMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "ThreadStorage");
	}

	private async getThreadMetadata(): Promise<ThreadMetadata | null> {
		const maxRetries = 3;
		const delayMs = 50;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const result = await this.getItemInternal("thread-metadata");
			if (result !== null) {
				return result;
			}

			if (attempt < maxRetries - 1) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return null;
	}

	async addThread(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata && !metadata.threadIds.includes(threadId)) {
			metadata.threadIds.push(threadId);
			await this.setItemInternal("thread-metadata", metadata);
		}
	}

	async removeThread(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata) {
			const threadIndex = metadata.threadIds.indexOf(threadId);
			if (threadIndex > -1) {
				metadata.threadIds.splice(threadIndex, 1);
			}

			const favoriteIndex = metadata.favorites.indexOf(threadId);
			if (favoriteIndex > -1) {
				metadata.favorites.splice(favoriteIndex, 1);
			}

			await this.setItemInternal("thread-metadata", metadata);
		}
	}

	async deleteThread(threadId: string): Promise<void> {
		try {
			// Remove from metadata first
			await this.removeThread(threadId);

			// Delete the actual thread data file
			const threadKey = "app-thread:" + threadId;
			await storageService.removeItemInternal(threadKey);
			await storageService.removeItemInternal("app-chat-messages:" + threadId);
			emitter.emit("thread:thread-deleted", { threadId });
		} catch (error) {
			console.error(`Failed to delete thread ${threadId}:`, error);
			throw error;
		}
	}

	async renameThread(threadId: string, newName: string): Promise<void> {
		try {
			const threadKey = "app-thread:" + threadId;
			await storageService.setItemInternal(threadKey, {
				...((await storageService.getItemInternal(threadKey)) as ThreadParmas),
				title: newName,
				updatedAt: new Date(),
			});
		} catch (error) {
			console.error(`Failed to rename thread ${threadId}:`, error);
			throw error;
		}
	}

	async addFavorite(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata && !metadata.favorites.includes(threadId)) {
			metadata.favorites.push(threadId);
			await this.setItemInternal("thread-metadata", metadata);
		}
	}

	async removeFavorite(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata) {
			const index = metadata.favorites.indexOf(threadId);
			if (index > -1) {
				metadata.favorites.splice(index, 1);
				await this.setItemInternal("thread-metadata", metadata);
			}
		}
	}

	async getThread(threadId: string): Promise<ThreadData | null> {
		try {
			const metadata = await this.getThreadMetadata();
			if (!metadata || !metadata.threadIds.includes(threadId)) {
				return null;
			}

			const thread = (await storageService.getItemInternal(
				"app-thread:" + threadId,
			)) as ThreadParmas;
			if (!thread || !thread.updatedAt) {
				return null;
			}

			return {
				threadId,
				thread,
				isFavorite: metadata.favorites.includes(threadId),
			};
		} catch (error) {
			console.error("Failed to get thread:", error);
			return null;
		}
	}

	async getThreadsData(): Promise<Array<ThreadData> | null> {
		try {
			const metadata = await this.getThreadMetadata();
			if (!metadata) {
				return null;
			}

			const allThreads: Array<ThreadData> = [];

			for (const threadId of metadata.threadIds) {
				try {
					const thread = (await storageService.getItemInternal(
						"app-thread:" + threadId,
					)) as ThreadParmas;
					if (thread) {
						allThreads.push({
							threadId,
							thread,
							isFavorite: metadata.favorites.includes(threadId),
						});
					}
				} catch (error) {
					console.warn(`Failed to load thread ${threadId}:`, error);
				}
			}

			allThreads.sort((a, b) => {
				if (a.isFavorite && !b.isFavorite) return -1;
				if (!a.isFavorite && b.isFavorite) return 1;

				const dateA = new Date(a.thread.updatedAt).getTime();
				const dateB = new Date(b.thread.updatedAt).getTime();
				return dateB - dateA;
			});

			return allThreads;
		} catch (error) {
			console.error("Failed to get threads:", error);
			return null;
		}
	}

	/**
	 * Delete all threads that have a specific apiKeyHash
	 * Used when logging out to clean up sessions associated with a specific account
	 * @param apiKeyHash - The hash of the API key to match
	 * @returns Object containing count of deleted threads and their IDs
	 */
	async deleteThreadsByApiKeyHash(
		apiKeyHash: string,
	): Promise<{ deletedCount: number; deletedThreadIds: string[] }> {
		try {
			const allThreads = await this.getThreadsData();
			if (!allThreads) return { deletedCount: 0, deletedThreadIds: [] };

			const deletedThreadIds: string[] = [];
			for (const threadData of allThreads) {
				if (threadData.thread.apiKeyHash === apiKeyHash) {
					try {
						await this.deleteThread(threadData.threadId);
						// Also delete messages
						await storageService.removeItemInternal("app-chat-messages:" + threadData.threadId);
						deletedThreadIds.push(threadData.threadId);
						console.log(
							`[ThreadStorage] Deleted thread ${threadData.threadId} with matching apiKeyHash`,
						);
					} catch (error) {
						console.error(`Failed to delete thread ${threadData.threadId}:`, error);
					}
				}
			}

			return { deletedCount: deletedThreadIds.length, deletedThreadIds };
		} catch (error) {
			console.error("Failed to delete threads by apiKeyHash:", error);
			return { deletedCount: 0, deletedThreadIds: [] };
		}
	}

	/**
	 * Clear selectedModel references from all threads for deleted models
	 * Used when models are deleted to prevent stale references
	 * @param deletedModelIds - Set of model IDs that were deleted
	 * @returns Number of threads that had their selectedModel cleared
	 */
	async clearDeletedModelReferences(deletedModelIds: Set<string>): Promise<number> {
		try {
			const metadata = await this.getThreadMetadata();
			if (!metadata) return 0;

			let clearedCount = 0;

			for (const threadId of metadata.threadIds) {
				try {
					const threadKey = "app-thread:" + threadId;
					const thread = (await storageService.getItemInternal(threadKey)) as ThreadParmas;
					if (thread && thread.selectedModel && deletedModelIds.has(thread.selectedModel.id)) {
						// Clear the selectedModel reference
						await storageService.setItemInternal(threadKey, {
							...thread,
							selectedModel: null,
						});
						clearedCount++;
						console.log(
							`[ThreadStorage] Cleared selectedModel reference for deleted model ${thread.selectedModel.id} in thread ${threadId}`,
						);
					}
				} catch (error) {
					console.warn(`Failed to clear model reference in thread ${threadId}:`, error);
				}
			}

			return clearedCount;
		} catch (error) {
			console.error("Failed to clear deleted model references:", error);
			return 0;
		}
	}
}

export const threadStorage = new ThreadStorage();
