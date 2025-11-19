import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { UserInfo, UserState } from "@shared/storage/user";
import { API_BASE_URL } from "$lib/constants/api";
import { m } from "$lib/paraglide/messages.js";

const getDefaults = (): UserState => ({
	token: null,
	userInfo: null,
	isLoggedIn: false,
});

const persistedUserState = new PersistedState<UserState>("UserStorage:state", getDefaults());

class UserStateManager {
	get state(): UserState {
		return persistedUserState.current;
	}

	get token(): string | null {
		return persistedUserState.current.token;
	}

	get userInfo(): UserInfo | null {
		return persistedUserState.current.userInfo;
	}

	get isLoggedIn(): boolean {
		return persistedUserState.current.isLoggedIn;
	}

	setToken(token: string): void {
		persistedUserState.current = {
			...persistedUserState.current,
			token,
			isLoggedIn: true,
		};
	}

	setUserInfo(userInfo: UserInfo): void {
		persistedUserState.current = {
			...persistedUserState.current,
			userInfo,
		};
	}

	async fetchUserInfo(): Promise<{ success: boolean; error?: string }> {
		const token = this.token;
		if (!token) {
			return { success: false, error: m.error_no_token() };
		}

		try {
			const res = await fetch(`${API_BASE_URL}/user/info`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					authorization: token,
					isgpt: "1",
					lang: "zh-CN",
					tz: "Asia/Shanghai",
					origin: "https://302.ai",
					referer: "https://302.ai/",
				},
			});

			const data = await res.json();
			if (data.code === 0 || data.code === 200) {
				this.setUserInfo(data.data);
				return { success: true };
			} else {
				return { success: false, error: data.msg || m.error_fetch_user_info_failed() };
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : m.network_error(),
			};
		}
	}

	logout(): void {
		persistedUserState.current = getDefaults();
	}

	update(partial: Partial<UserState>): void {
		persistedUserState.current = { ...persistedUserState.current, ...partial };
	}
}

export const userState = new UserStateManager();
