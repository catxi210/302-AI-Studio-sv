import { m } from "$lib/paraglide/messages.js";
import { open302SsoLogin } from "$lib/utils/sso";
import { toast } from "svelte-sonner";
import { providerState } from "./provider-state.svelte";
import { userState } from "./user-state.svelte";

class SsoStateManager {
	isLoading = $state(false);
	hasError = $state(false);
	isSuccess = $state(false);

	async login() {
		if (this.isLoading) return;

		this.isLoading = true;
		this.hasError = false;
		this.isSuccess = false;

		try {
			const result = await open302SsoLogin();

			if (result.success && result.apiKey) {
				// Set the API key as token with Basic prefix
				const token = result.apiKey.startsWith("Basic ") ? result.apiKey : `Basic ${result.apiKey}`;
				userState.setToken(token);

				// Update 302.AI provider if key is missing (Fresh install scenario)
				const provider = providerState.getProvider("302AI");
				if (provider && !provider.apiKey) {
					let rawApiKey = result.apiKey;
					if (rawApiKey.startsWith("Basic ")) {
						rawApiKey = rawApiKey.slice(6).trim();
					}
					await providerState.updateProvider("302AI", { apiKey: rawApiKey });
					// Fetch models using the updated provider (need to get fresh reference or rely on internal state)
					// fetchModelsForProvider uses getProvider internally so passing the old object works if ID is same
					await providerState.fetchModelsForProvider(provider);
				}

				// Fetch user info
				const fetchResult = await userState.fetchUserInfo();
				if (fetchResult.success) {
					this.isSuccess = true;
					toast.success(m.login_success());

					// Reset success state after 3 seconds
					setTimeout(() => {
						this.isSuccess = false;
					}, 3000);
				} else {
					this.hasError = true;
					toast.error(fetchResult.error || m.sso_error());
				}
			} else {
				this.hasError = true;
				if (result.error && !result.error.includes("closed") && !result.error.includes("timeout")) {
					toast.error(result.error);
				}
			}
		} catch (_error) {
			this.hasError = true;
			toast.error(m.sso_error());
		} finally {
			this.isLoading = false;
		}
	}

	reset() {
		this.isLoading = false;
		this.hasError = false;
		this.isSuccess = false;
	}
}

export const ssoState = new SsoStateManager();
