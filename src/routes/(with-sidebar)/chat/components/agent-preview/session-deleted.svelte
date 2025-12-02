<script lang="ts">
	import { Trash2 } from "@lucide/svelte";
	import { m } from "$lib/paraglide/messages";
</script>

<div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
	<Trash2 class="h-8 w-8" />
	<p class="text-sm font-medium">{m.text_session_deleted()}</p>
</div>
