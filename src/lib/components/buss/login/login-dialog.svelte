<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import * as Select from "$lib/components/ui/select";
	import * as Tabs from "$lib/components/ui/tabs";
	import { API_BASE_URL } from "$lib/constants/api";
	import { getErrorMessage } from "$lib/constants/error-codes";
	import { m } from "$lib/paraglide/messages.js";
	import { userState } from "$lib/stores/user-state.svelte";
	import { toast } from "svelte-sonner";
	import Captcha from "./captcha.svelte";

	let { open = $bindable(false) } = $props();

	let phoneNumber = $state("");
	let verificationCode = $state("");
	let password = $state("");
	let countryCode = $state("+86");
	let captchaCode = $state("");
	let captchaKey = $state("");
	let isLoading = $state(false);

	// Format phone number for API
	function formatPhoneNumber(phone: string, countryCode: string): string {
		// Remove all non-digit characters
		const digits = phone.replace(/\D/g, "");
		// Format: +86 187 5963 2113 (groups of 3-4-4)
		if (digits.length === 11) {
			return `${countryCode} ${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
		}
		return `${countryCode} ${digits}`;
	}

	const countryOptions = [
		{ value: "+86", label: "🇨🇳 +86" },
		{ value: "+1", label: "🇺🇸 +1" },
		{ value: "+44", label: "🇬🇧 +44" },
		{ value: "+81", label: "🇯🇵 +81" },
	];

	const handleSmsLogin = async () => {
		if (!phoneNumber || !verificationCode) {
			toast.error(m.login_error_missing_phone_code());
			return;
		}
		isLoading = true;
		try {
			const formattedPhone = formatPhoneNumber(phoneNumber, countryCode);

			const formData = new FormData();
			formData.append("phone_number", formattedPhone);
			formData.append("sms_code", verificationCode);
			formData.append("captcha", captchaCode);
			formData.append("code", captchaKey);
			formData.append("email", "");
			formData.append("id_token", "");
			formData.append("ref", "");
			formData.append("event", "");
			formData.append("login_from", "web");

			const res = await fetch(`${API_BASE_URL}/user/sms/phone`, {
				method: "POST",
				headers: {
					authorization: "Basic null",
					isgpt: "1",
					lang: "zh-CN",
					tz: "Asia/Shanghai",
					origin: "https://302.ai",
					referer: "https://302.ai/",
				},
				body: formData,
			});
			const data = await res.json();
			if (data.code === 200 || data.code === 0) {
				// Save token
				const token = data.data?.token;
				if (token) {
					userState.setToken(token);

					// Fetch user info
					const result = await userState.fetchUserInfo();
					if (result.success) {
						toast.success("登录成功");
						open = false;
					} else {
						toast.error("获取用户信息失败");
					}
				} else {
					toast.error("登录响应缺少 token");
				}
			} else {
				toast.error(getErrorMessage(data.code) || data.message || "登录失败");
			}
		} catch (_e) {
			toast.error("网络错误");
		} finally {
			isLoading = false;
		}
	};

	const handlePasswordLogin = async () => {
		if (!phoneNumber || !password || !captchaCode) {
			toast.error(m.login_error_missing_phone_password_captcha());
			return;
		}
		if (!captchaKey) {
			toast.error(m.login_error_captcha_not_loaded());
			return;
		}
		isLoading = true;
		try {
			const formattedPhone = formatPhoneNumber(phoneNumber, countryCode);
			const res = await fetch(`${API_BASE_URL}/user/login/phone`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authorization: "Basic null",
					isgpt: "1",
					lang: "zh-CN",
					tz: "Asia/Shanghai",
					origin: "https://302.ai",
					referer: "https://302.ai/",
				},
				body: JSON.stringify({
					phone: formattedPhone,
					password: password,
					captcha: captchaCode,
					code: captchaKey,
					email: "",
					ref: "",
					event: "",
					login_from: "web",
				}),
			});
			const data = await res.json();
			if (data.code === 200 || data.code === 0) {
				// Save token
				const token = data.data?.token;
				if (token) {
					userState.setToken(token);

					// Fetch user info
					const result = await userState.fetchUserInfo();
					if (result.success) {
						toast.success("登录成功");
						open = false;
					} else {
						toast.error("获取用户信息失败");
					}
				} else {
					toast.error("登录响应缺少 token");
				}
			} else {
				toast.error(getErrorMessage(data.code) || data.message || "登录失败");
			}
		} catch (_e) {
			toast.error("网络错误");
		} finally {
			isLoading = false;
		}
	};

	const handleGetVerificationCode = async () => {
		if (!phoneNumber || !captchaCode) {
			toast.error(m.login_error_missing_phone_captcha());
			return;
		}
		if (!captchaKey) {
			toast.error(m.login_error_captcha_not_loaded());
			return;
		}

		console.log("发送验证码请求:", {
			mobile: formatPhoneNumber(phoneNumber, countryCode),
			captcha: captchaCode,
			code: captchaKey,
		});

		isLoading = true;
		try {
			const formattedPhone = formatPhoneNumber(phoneNumber, countryCode);
			const res = await fetch(`${API_BASE_URL}/user/sms/rny`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authorization: "Basic null",
					isgpt: "1",
					lang: "zh-CN",
					tz: "Asia/Shanghai",
					origin: "https://302.ai",
					referer: "https://302.ai/",
				},
				body: JSON.stringify({
					mobile: formattedPhone,
					captcha: captchaCode,
					code: captchaKey,
				}),
			});
			const data = await res.json();
			if (data.code === 200 || data.code === 0) {
				toast.success(m.login_verification_code_sent());
			} else {
				toast.error(getErrorMessage(data.code) || data.message || m.login_send_failed());
			}
		} catch (_e) {
			toast.error(m.network_error());
		} finally {
			isLoading = false;
		}
	};

	const handleQuickLogin = () => {
		console.log("Quick login");
	};

	const handleGoogleLogin = () => {
		console.log("Google login");
	};

	const handleGithubLogin = () => {
		console.log("Github login");
	};

	const handleRegister = () => {
		console.log("Register");
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content data-login-dialog>
		<div class="flex flex-col items-center gap-4 py-6">
			<!-- Logo -->
			<div class="flex items-center gap-3">
				<svg class="size-12" viewBox="0 0 24 24">
					<title>302.AI</title>
					<path
						d="M13.086 23.25c5.614 0 10.164-4.559 10.164-10.182 0-5.624-4.55-10.182-10.164-10.182-5.613 0-10.163 4.558-10.163 10.182 0 5.623 4.55 10.182 10.163 10.182z"
						fill="#3F3FAA"
					></path>
					<path
						d="M10.914 21.114c5.613 0 10.163-4.559 10.163-10.182S16.527.75 10.914.75C5.3.75.75 5.309.75 10.932S5.3 21.114 10.914 21.114z"
						fill="#8E47FF"
					></path>
					<path
						d="M10.755 17.708c-.722 0-1.416-.24-1.995-.69a3.25 3.25 0 01-1.23-2.177 3.248 3.248 0 01-.006-.782c-.201.04-.407.056-.618.056a3.265 3.265 0 01-3.261-3.262A3.27 3.27 0 017.65 7.67a3.27 3.27 0 013.241-3.638 3.266 3.266 0 013.242 3.577 3.269 3.269 0 012.694 5.693 3.227 3.227 0 01-2.365.782 3.26 3.26 0 01-.466-.066c0 .008.005.014.005.02a3.254 3.254 0 01-.664 2.41 3.235 3.235 0 01-2.583 1.259zm-1.808-4.313c-.228.397-.32.847-.263 1.304a2.092 2.092 0 002.335 1.826 2.086 2.086 0 001.398-.791 2.08 2.08 0 00.425-1.548 2.091 2.091 0 00-.405-1.004 3.253 3.253 0 01-.39-.462.58.58 0 11.947-.675c.044.062.088.117.137.173a.61.61 0 01.111.101l.056.071a2.096 2.096 0 003.49-1.405 2.096 2.096 0 00-1.93-2.248 2.076 2.076 0 00-1.251.304.579.579 0 01-.648.061.59.59 0 01-.233-.796A2.102 2.102 0 0010.888 5.2 2.1 2.1 0 009.14 8.457l.03.056c.61.594.993 1.42.993 2.339A3.273 3.273 0 018.947 13.4v-.005zM6.901 8.752a2.098 2.098 0 00-2.092 2.1c0 1.16.936 2.101 2.092 2.101a2.1 2.1 0 000-4.201z"
						fill="#fff"
					></path>
				</svg>
				<svg class="h-6 text-foreground" viewBox="0 0 80 24" fill="currentColor">
					<title>302.AI</title>
					<path
						clip-rule="evenodd"
						d="M2 18.092c0-.626.54-1.082 1.271-1.082.54 0 .955.285 1.272.826.666 1.167 1.78 1.937 3.654 1.937 2.352 0 3.718-1.423 3.718-3.446 0-2.137-1.557-3.56-3.973-3.56h-.221c-.826 0-1.303-.455-1.303-1.11 0-.654.477-1.11 1.303-1.11h.19c2.098 0 3.592-1.224 3.592-3.247 0-1.852-1.302-3.076-3.463-3.076-1.781 0-2.767.797-3.307 1.852-.286.541-.7.826-1.24.826-.731 0-1.24-.427-1.24-1.053 0-.171.064-.427.126-.598.666-1.738 2.606-3.247 5.754-3.247 3.782 0 6.103 2.165 6.103 5.185 0 2.051-1.27 3.446-2.67 4.214v.057c1.4.512 3.082 2.222 3.082 4.843 0 3.361-2.67 5.697-6.451 5.697-3.307 0-5.276-1.48-6.102-3.36A1.6 1.6 0 012 18.098v-.007zM17.51 11.997c0-4.556.221-5.583.476-6.323C18.846 3.309 20.91 2 23.897 2c2.988 0 5.054 1.31 5.911 3.674.255.74.476 1.767.476 6.323 0 4.556-.221 5.583-.476 6.323-.857 2.364-2.923 3.674-5.91 3.674-2.988 0-5.055-1.31-5.912-3.674-.255-.74-.476-1.767-.476-6.323zm6.39 7.777c1.59 0 2.766-.655 3.273-1.938.221-.598.35-1.423.35-5.84 0-4.415-.127-5.24-.35-5.838-.51-1.281-1.686-1.938-3.274-1.938s-2.766.655-3.273 1.938c-.221.597-.35 1.423-.35 5.839s.126 5.241.35 5.839c.51 1.28 1.685 1.938 3.273 1.938zM33.974 19.031l7.375-8.43c.985-1.14 1.495-2.138 1.495-3.333 0-1.767-1.303-3.048-3.402-3.048-1.907 0-2.957.91-3.433 2.336-.221.626-.7.94-1.24.94-.795 0-1.336-.428-1.336-1.11 0-.114.032-.314.065-.428C34.008 3.964 35.945 2 39.538 2c3.592 0 6.039 2.25 6.039 5.27 0 1.738-.762 3.19-2.13 4.7l-6.612 7.434v.056h7.661c.826 0 1.302.456 1.302 1.11 0 .655-.476 1.11-1.302 1.11H34.483c-.826 0-1.302-.455-1.302-1.053 0-.512.221-.91.795-1.596h-.002zM50.312 18.372c.986 0 1.812.784 1.812 1.721s-.826 1.721-1.812 1.721c-.985 0-1.811-.784-1.811-1.72 0-.938.826-1.722 1.811-1.722zM55.237 20.085l6.645-16.491c.35-.91.89-1.423 1.842-1.423.953 0 1.557.512 1.907 1.423l6.547 16.49c.064.171.126.37.126.57 0 .712-.605 1.167-1.335 1.167-.636 0-1.145-.313-1.367-.91l-1.462-3.732h-8.867L57.81 20.91c-.222.598-.731.91-1.367.91-.73 0-1.335-.454-1.335-1.166 0-.2.064-.399.126-.57h.002zm11.984-5.242l-3.433-8.801h-.095l-3.497 8.801h7.025zM75.33 3.935c0-1.127.571-1.813 1.335-1.813s1.336.686 1.336 1.813V20.01c0 1.127-.572 1.813-1.336 1.813-.764 0-1.335-.686-1.335-1.813V3.935z"
					></path>
				</svg>
			</div>

			<!-- Login Tabs -->
			<Tabs.Root value="sms" class="w-full space-y-4">
				<div class="relative w-full border-b border-border">
					<Tabs.List class="flex h-auto w-full justify-start gap-0 bg-transparent p-0">
						<Tabs.Trigger
							value="sms"
							class="relative h-auto rounded-none border-transparent bg-transparent px-4 pb-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:-bottom-px data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-px data-[state=active]:after:bg-primary dark:data-[state=active]:bg-transparent"
						>
							{m.login_sms()}
						</Tabs.Trigger>
						<Tabs.Trigger
							value="password"
							class="relative h-auto rounded-none border-transparent bg-transparent px-4 pb-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:-bottom-px data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-px data-[state=active]:after:bg-primary dark:data-[state=active]:bg-transparent"
						>
							{m.login_password()}
						</Tabs.Trigger>
					</Tabs.List>
				</div>

				<!-- SMS Login Tab -->
				<Tabs.Content value="sms" class="space-y-4 -mb-0">
					<!-- Phone Number -->
					<div class="space-y-2">
						<Label for="phone" class="font-bold">{m.login_phone_number()}</Label>
						<div class="flex gap-2">
							<Select.Root type="single" bind:value={countryCode}>
								<Select.Trigger class="w-28">
									{countryOptions.find((o) => o.value === countryCode)?.label || countryCode}
								</Select.Trigger>
								<Select.Content>
									{#each countryOptions as option (option.value)}
										<Select.Item value={option.value} label={option.label} />
									{/each}
								</Select.Content>
							</Select.Root>
							<Input
								id="phone"
								type="tel"
								bind:value={phoneNumber}
								placeholder={countryCode}
								class="flex-1"
							/>
						</div>
					</div>

					<!-- Verification Code -->
					<div class="space-y-2">
						<Label for="captcha" class="font-bold">{m.login_captcha_label()}</Label>
						<div class="flex gap-2">
							<Input
								id="captcha"
								type="text"
								bind:value={captchaCode}
								placeholder={m.login_captcha_placeholder()}
								class="flex-1"
							/>
							<Captcha bind:code={captchaKey} />
						</div>
					</div>

					<!-- Verification Code -->
					<div class="space-y-2">
						<Label for="code" class="font-bold">{m.login_verification_code()}</Label>
						<div class="flex gap-2">
							<Input
								id="code"
								type="text"
								bind:value={verificationCode}
								placeholder={m.login_enter_verification_code()}
								class="flex-1"
							/>
							<Button
								variant="default"
								class="w-32 shrink-0"
								onclick={handleGetVerificationCode}
								disabled={isLoading}
							>
								{m.login_get_code()}
							</Button>
						</div>
					</div>

					<!-- Login Button -->
					<Button class="w-full" onclick={handleSmsLogin} disabled={isLoading}>
						{m.login_now()}
					</Button>
				</Tabs.Content>

				<!-- Password Login Tab -->
				<Tabs.Content value="password" class="space-y-4">
					<!-- Phone Number -->
					<div class="space-y-2">
						<Label for="phone-password" class="font-bold">{m.login_phone_number()}</Label>
						<div class="flex gap-2">
							<Select.Root type="single" bind:value={countryCode}>
								<Select.Trigger class="w-28">
									{countryOptions.find((o) => o.value === countryCode)?.label || countryCode}
								</Select.Trigger>
								<Select.Content>
									{#each countryOptions as option (option.value)}
										<Select.Item value={option.value} label={option.label} />
									{/each}
								</Select.Content>
							</Select.Root>
							<Input
								id="phone-password"
								type="tel"
								bind:value={phoneNumber}
								placeholder={countryCode}
								class="flex-1"
							/>
						</div>
					</div>

					<!-- Password -->
					<div class="space-y-2">
						<Label for="password" class="font-bold">{m.login_password_label()}</Label>
						<Input
							id="password"
							type="password"
							bind:value={password}
							placeholder={m.login_enter_password()}
						/>
					</div>

					<!-- Captcha -->
					<div class="space-y-2">
						<Label for="captcha-password" class="font-bold">{m.login_captcha_label()}</Label>
						<div class="flex gap-2">
							<Input
								id="captcha-password"
								type="text"
								bind:value={captchaCode}
								placeholder={m.login_captcha_placeholder()}
								class="flex-1"
							/>
							<Captcha bind:code={captchaKey} />
						</div>
					</div>

					<!-- Login Button -->
					<Button class="w-full" onclick={handlePasswordLogin} disabled={isLoading}>
						{m.login_now()}
					</Button>
				</Tabs.Content>
			</Tabs.Root>

			<!-- Quick Login -->
			<Button variant="outline" class="w-full" onclick={handleQuickLogin}>
				{m.login_quick_login()}
			</Button>

			<!-- Register Link -->
			<div class="text-xs text-muted-foreground">
				{m.login_no_account()}
				<button onclick={handleRegister} class="text-primary hover:text-primary/80">
					{m.login_register_now()}
				</button>
			</div>

			<!-- Third-party Login Hint -->
			<div class="flex w-full items-center gap-3 mt-4">
				<div class="h-px flex-1 bg-border"></div>
				<p class="text-xs text-muted-foreground">{m.login_auto_register_hint()}</p>
				<div class="h-px flex-1 bg-border"></div>
			</div>

			<!-- Third-party Login Buttons -->
			<div class="flex gap-6">
				<button
					onclick={handleGoogleLogin}
					class="flex size-12 items-center justify-center rounded-full transition-colors hover:bg-accent"
					aria-label="Google Login"
				>
					<svg class="size-8" viewBox="0 0 24 24">
						<path
							fill="#4285F4"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="#34A853"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="#FBBC05"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="#EA4335"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
				</button>

				<button
					onclick={handleGithubLogin}
					class="flex size-12 items-center justify-center rounded-full transition-colors hover:bg-accent"
					aria-label="Github Login"
				>
					<svg class="size-8" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
						/>
					</svg>
				</button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
