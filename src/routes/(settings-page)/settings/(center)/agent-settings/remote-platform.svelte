<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";
	import { RotateCw, Search } from "@lucide/svelte";
</script>

<!-- Agent Sandbox List Section -->
<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-base font-medium">{m.title_agent_sandbox_list()}</h2>
		<Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-foreground">
			<RotateCw class="h-4 w-4" />
		</Button>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			placeholder={m.placeholder_search_agent()}
			class="pl-9 bg-muted/50 border-transparent focus-visible:ring-0 focus-visible:bg-background"
		/>
	</div>

	<!-- Sandbox List Item (Mock) -->
	<div
		class="flex items-center justify-between rounded-lg bg-muted/50 p-4 hover:bg-muted/70 transition-colors cursor-pointer"
	>
		<div class="flex flex-col gap-1">
			<span class="font-medium text-sm">name</span>
			<span class="text-xs text-muted-foreground">302-sandbox-xxxxxxx</span>
		</div>
		<div class="flex flex-col items-end gap-1">
			<span class="text-xs text-muted-foreground"
				>{m.label_agent_sandbox_count({ count: "3" })}</span
			>
			<span class="text-xs text-muted-foreground">12:33</span>
		</div>
	</div>
</div>
