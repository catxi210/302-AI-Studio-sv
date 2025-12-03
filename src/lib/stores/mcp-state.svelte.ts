import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { McpServer } from "@shared/storage/mcp";

const persistedMcpState = new PersistedState<McpServer[]>("app-mcp-servers", []);

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedMcpState.current;
	});
});

class McpState {
	servers = $derived(persistedMcpState.current);
	isHydrated = $derived(persistedMcpState.isHydrated);
	enabledServers = $derived(this.servers.filter((s) => s.enabled));

	getServer(id: string): McpServer | null {
		return this.servers.find((s) => s.id === id) || null;
	}

	getServerByName(name: string): McpServer | undefined {
		return this.servers.find((s) => s.name === name);
	}

	addServer(server: McpServer) {
		persistedMcpState.current = [...persistedMcpState.current, server];
	}

	updateServer(id: string, updates: Partial<McpServer>) {
		persistedMcpState.current = persistedMcpState.current.map((s) =>
			s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s,
		);
	}

	removeServer(id: string) {
		persistedMcpState.current = persistedMcpState.current.filter((s) => s.id !== id);
	}

	toggleEnabled(id: string): boolean {
		const server = this.getServer(id);
		if (!server) return false;

		this.updateServer(id, { enabled: !server.enabled });
		return true;
	}

	reorderServers(newOrder: McpServer[]) {
		persistedMcpState.current = [...newOrder];
	}

	getSortedServers(): McpServer[] {
		return [...this.servers].sort((a, b) => a.order - b.order);
	}

	/**
	 * Add multiple MCP servers, skipping those with names that already exist.
	 * @param servers - Array of MCP servers to add
	 * @returns Object with count of added and skipped servers
	 */
	addServersIfNotExists(servers: McpServer[]): { added: number; skipped: number } {
		let added = 0;
		let skipped = 0;

		const serversToAdd: McpServer[] = [];

		for (const server of servers) {
			const existingServer = this.getServerByName(server.name);
			if (existingServer) {
				skipped++;
				console.log(`[MCP] Skipped server "${server.name}" - already exists`);
			} else {
				serversToAdd.push(server);
				added++;
			}
		}

		if (serversToAdd.length > 0) {
			persistedMcpState.current = [...persistedMcpState.current, ...serversToAdd];
			console.log(`[MCP] Added ${added} new servers`);
		}

		return { added, skipped };
	}
}

export const mcpState = new McpState();
