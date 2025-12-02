<script lang="ts">
	import SessionDeletedIcon from "$lib/assets/icons/code-agent/sessionDeleted.svg";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { threadsState } from "$lib/stores/threads-state.svelte";

	async function handleStartNewSession() {
		await tabBarState.handleNewTab(m.title_new_chat());
	}

	async function handleDeleteCurrentConversation() {
		// Get current tab ID from window.tab
		const currentTabId = window.tab?.id;

		// First close the current tab (if exists)
		if (currentTabId) {
			await tabBarState.handleTabClose(currentTabId);
		}

		// Then delete the thread
		await threadsState.deleteThread(chatState.id);
	}
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
	<img src={SessionDeletedIcon} alt="Session deleted" class="h-40 w-40" />
	<p class="text-sm font-medium">{m.text_session_deleted()}</p>

	<div class="flex flex-col gap-3 mt-2">
		<button
			onclick={handleStartNewSession}
			class="px-6 py-2 rounded-lg text-sm font-medium text-white bg-[#8E47F0] hover:bg-[#7C3DD6] transition-colors"
		>
			{m.button_start_new_session()}
		</button>
		<button
			onclick={handleDeleteCurrentConversation}
			class="px-6 py-2 rounded-lg text-sm font-medium text-[#FF4D4F] bg-[#FFF1F0] hover:bg-[#FFE4E4] transition-colors"
		>
			{m.button_delete_current_conversation()}
		</button>
	</div>
</div>
