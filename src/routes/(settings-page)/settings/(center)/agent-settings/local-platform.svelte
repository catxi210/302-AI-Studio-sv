<script lang="ts">
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { m } from "$lib/paraglide/messages";
</script>

<!-- Local Platform Empty State -->
<Empty.Root>
	<Empty.Content class="h-[200px] flex flex-col items-center justify-start pt-8">
		<Empty.Description>
			{m.unsupport()}
		</Empty.Description>
	</Empty.Content>
</Empty.Root>
