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

	let { open = $bindable(false), onSwitchToLogin } = $props<{
		open: boolean;
		onSwitchToLogin?: () => void;
	}>();

	// Email registration fields
	let username = $state("");
	let inviteCode = $state("");
	let email = $state("");
	let password = $state("");
	let passwordConfirm = $state("");
	let captchaCode = $state("");
	let captchaKey = $state("");

	// Phone registration fields
	let phoneNumber = $state("");
	let phonePassword = $state("");
	let phonePasswordConfirm = $state("");
	let smsCode = $state("");
	let countryCode = $state("+86");
	let phoneCaptchaCode = $state("");
	let phoneCaptchaKey = $state("");

	let isLoading = $state(false);
	let smsCodeSending = $state(false);
	let smsCodeCountdown = $state(0);

	const countryOptions = [
		{ value: "+86", label: "🇨🇳 +86" },
		{ value: "+1", label: "🇺🇸 +1" },
		{ value: "+44", label: "🇬🇧 +44" },
		{ value: "+81", label: "🇯🇵 +81" },
	];

	// Format phone number for API
	function formatPhoneNumber(phone: string, countryCode: string): string {
		const digits = phone.replace(/\D/g, "");
		if (digits.length === 11) {
			return `${countryCode} ${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
		}
		return `${countryCode} ${digits}`;
	}

	// Validate email format
	function isValidEmail(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	// Validate password format (8-20 characters, letters and numbers)
	function isValidPassword(password: string): boolean {
		const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/;
		return passwordRegex.test(password);
	}

	// Start countdown timer
	function startCountdown() {
		const countdown = 60;
		smsCodeCountdown = countdown;
		const timer = setInterval(() => {
			smsCodeCountdown--;
			if (smsCodeCountdown <= 0) {
				clearInterval(timer);
			}
		}, 1000);
	}

	// Get SMS verification code
	const handleGetSmsCode = async () => {
		if (!phoneNumber) {
			toast.error(m.register_error_phone_empty());
			return;
		}
		if (!phoneCaptchaCode) {
			toast.error(m.login_error_captcha_not_loaded());
			return;
		}

		smsCodeSending = true;
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
					captcha: phoneCaptchaCode,
					code: phoneCaptchaKey,
				}),
			});

			const data = await res.json();
			if (data.code === 200 || data.code === 0) {
				toast.success(m.login_verification_code_sent());
				startCountdown();
			} else {
				toast.error(getErrorMessage(data.code) || data.message || m.login_send_failed());
			}
		} catch (_e) {
			toast.error(m.network_error());
		} finally {
			smsCodeSending = false;
		}
	};

	// Email registration
	const handleEmailRegister = async () => {
		// Validation
		if (!username.trim()) {
			toast.error(m.register_error_username_empty());
			return;
		}
		if (!email.trim()) {
			toast.error(m.register_error_email_empty());
			return;
		}
		if (!isValidEmail(email)) {
			toast.error(m.register_error_email_invalid());
			return;
		}
		if (!password) {
			toast.error(m.register_error_password_empty());
			return;
		}
		if (!isValidPassword(password)) {
			toast.error(m.register_error_password_invalid());
			return;
		}
		if (password !== passwordConfirm) {
			toast.error(m.register_error_password_mismatch());
			return;
		}
		if (!captchaCode) {
			toast.error(m.login_error_captcha_not_loaded());
			return;
		}

		isLoading = true;
		try {
			// Build URL with query parameters
			const params = new URLSearchParams({
				ref: "",
				name: username.trim(),
				email: email.trim(),
				password: password,
				confirmPassword: passwordConfirm,
				from_invite_code: inviteCode.trim(),
				captcha: captchaCode,
				code: captchaKey,
				invite_code: "",
			});

			const url = `${API_BASE_URL}/user/register?${params.toString()}`;
			console.log("邮箱注册请求 URL:", url);
			console.log("邮箱注册参数:", {
				ref: "",
				name: username.trim(),
				email: email.trim(),
				password: password,
				confirmPassword: passwordConfirm,
				from_invite_code: inviteCode.trim(),
				captcha: captchaCode,
				code: captchaKey,
				invite_code: "",
			});

			const res = await fetch(url, {
				method: "POST",
				headers: {
					accept: "application/json, text/plain, */*",
					authorization: "Basic null",
					isgpt: "1",
					lang: "zh-CN",
					tz: "Asia/Shanghai",
					origin: "https://302.ai",
					referer: "https://302.ai/",
					"content-length": "0",
				},
			});

			const data = await res.json();
			console.log("邮箱注册响应:", data);
			if (data.code === 200 || data.code === 0) {
				// Show the message from server (e.g., "查看邮箱获取激活链接")
				toast.info(data.msg || m.register_email_sent(), {
					duration: 5000,
					description: email.trim(),
				});
				open = false;
			} else {
				toast.error(getErrorMessage(data.code) || data.message || m.register_failed());
			}
		} catch (_e) {
			toast.error(m.network_error());
		} finally {
			isLoading = false;
		}
	};

	// Phone registration
	const handlePhoneRegister = async () => {
		// Validation
		if (!username.trim()) {
			toast.error(m.register_error_username_empty());
			return;
		}
		if (!phoneNumber) {
			toast.error(m.register_error_phone_empty());
			return;
		}
		if (!phonePassword) {
			toast.error(m.register_error_password_empty());
			return;
		}
		if (!isValidPassword(phonePassword)) {
			toast.error(m.register_error_password_invalid());
			return;
		}
		if (phonePassword !== phonePasswordConfirm) {
			toast.error(m.register_error_password_mismatch());
			return;
		}
		if (!smsCode) {
			toast.error(m.register_error_sms_code_empty());
			return;
		}

		isLoading = true;
		try {
			const formattedPhone = formatPhoneNumber(phoneNumber, countryCode);
			const res = await fetch(`${API_BASE_URL}/user/register/phone`, {
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
					name: username.trim(),
					phone_number: formattedPhone,
					password: phonePassword,
					confirmPassword: phonePasswordConfirm,
					sms_code: smsCode,
					from_invite_code: inviteCode.trim(),
				}),
			});

			const data = await res.json();
			if (data.code === 200 || data.code === 0) {
				toast.success(m.register_success());
				// Auto login after phone registration
				const token = data.data?.token;
				if (token) {
					userState.setToken(token);
					const result = await userState.fetchUserInfo();
					if (result.success) {
						open = false;
					}
				}
			} else {
				toast.error(getErrorMessage(data.code) || data.message || m.register_failed());
			}
		} catch (_e) {
			toast.error(m.network_error());
		} finally {
			isLoading = false;
		}
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

			<!-- Register Tabs -->
			<Tabs.Root value="email" class="w-full space-y-4">
				<div class="relative w-full border-b border-border">
					<Tabs.List class="flex h-auto w-full justify-start gap-0 bg-transparent p-0">
						<Tabs.Trigger
							value="email"
							class="relative h-auto rounded-none border-transparent bg-transparent px-4 pb-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:-bottom-px data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-px data-[state=active]:after:bg-primary dark:data-[state=active]:bg-transparent"
						>
							{m.register_email_tab()}
						</Tabs.Trigger>
						<Tabs.Trigger
							value="phone"
							class="relative h-auto rounded-none border-transparent bg-transparent px-4 pb-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:-bottom-px data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-px data-[state=active]:after:bg-primary dark:data-[state=active]:bg-transparent"
						>
							{m.register_phone_tab()}
						</Tabs.Trigger>
					</Tabs.List>
				</div>

				<!-- Email Registration Tab -->
				<Tabs.Content value="email" class="space-y-4 -mb-0">
					<!-- Username -->
					<div class="space-y-2">
						<Label for="username" class="font-bold">{m.register_username()}</Label>
						<Input
							id="username"
							bind:value={username}
							placeholder={m.register_username_placeholder()}
						/>
					</div>

					<!-- Invite Code -->
					<div class="space-y-2">
						<Label for="invite-code" class="font-bold">{m.register_invite_code()}</Label>
						<Input
							id="invite-code"
							bind:value={inviteCode}
							placeholder={m.register_invite_code_placeholder()}
						/>
					</div>

					<!-- Email -->
					<div class="space-y-2">
						<Label for="email" class="font-bold">{m.register_email()}</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder={m.register_email_placeholder()}
						/>
					</div>

					<!-- Password -->
					<div class="space-y-2">
						<Label for="password" class="font-bold">{m.register_password()}</Label>
						<Input
							id="password"
							type="password"
							bind:value={password}
							placeholder={m.register_password_placeholder()}
						/>
					</div>

					<!-- Confirm Password -->
					<div class="space-y-2">
						<Label for="password-confirm" class="font-bold">{m.register_password_confirm()}</Label>
						<Input
							id="password-confirm"
							type="password"
							bind:value={passwordConfirm}
							placeholder={m.register_password_confirm_placeholder()}
						/>
					</div>

					<!-- Captcha -->
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

					<!-- Register Button -->
					<Button class="w-full" onclick={handleEmailRegister} disabled={isLoading}>
						{isLoading ? m.register_button_registering() : m.register_button()}
					</Button>
				</Tabs.Content>

				<!-- Phone Registration Tab -->
				<Tabs.Content value="phone" class="space-y-4 -mb-0">
					<!-- Username -->
					<div class="space-y-2">
						<Label for="phone-username" class="font-bold">{m.register_username()}</Label>
						<Input
							id="phone-username"
							bind:value={username}
							placeholder={m.register_username_placeholder()}
						/>
					</div>

					<!-- Invite Code -->
					<div class="space-y-2">
						<Label for="phone-invite-code" class="font-bold">{m.register_invite_code()}</Label>
						<Input
							id="phone-invite-code"
							bind:value={inviteCode}
							placeholder={m.register_invite_code_placeholder()}
						/>
					</div>

					<!-- Phone Number -->
					<div class="space-y-2">
						<Label for="phone" class="font-bold">{m.register_phone()}</Label>
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

					<!-- Password -->
					<div class="space-y-2">
						<Label for="phone-password" class="font-bold">{m.register_password()}</Label>
						<Input
							id="phone-password"
							type="password"
							bind:value={phonePassword}
							placeholder={m.register_password_placeholder()}
						/>
					</div>

					<!-- Confirm Password -->
					<div class="space-y-2">
						<Label for="phone-password-confirm" class="font-bold"
							>{m.register_password_confirm()}</Label
						>
						<Input
							id="phone-password-confirm"
							type="password"
							bind:value={phonePasswordConfirm}
							placeholder={m.register_password_confirm_placeholder()}
						/>
					</div>

					<!-- Captcha -->
					<div class="space-y-2">
						<Label for="phone-captcha" class="font-bold">{m.login_captcha_label()}</Label>
						<div class="flex gap-2">
							<Input
								id="phone-captcha"
								type="text"
								bind:value={phoneCaptchaCode}
								placeholder={m.login_captcha_placeholder()}
								class="flex-1"
							/>
							<Captcha bind:code={phoneCaptchaKey} />
						</div>
					</div>

					<!-- SMS Code -->
					<div class="space-y-2">
						<Label for="sms-code" class="font-bold">{m.login_verification_code()}</Label>
						<div class="flex gap-2">
							<Input
								id="sms-code"
								bind:value={smsCode}
								placeholder={m.login_enter_verification_code()}
								class="flex-1"
							/>
							<Button
								variant="default"
								class="w-32 shrink-0"
								onclick={handleGetSmsCode}
								disabled={smsCodeSending || smsCodeCountdown > 0}
							>
								{#if smsCodeCountdown > 0}
									{smsCodeCountdown}s
								{:else}
									{m.login_get_code()}
								{/if}
							</Button>
						</div>
					</div>

					<!-- Register Button -->
					<Button class="w-full" onclick={handlePhoneRegister} disabled={isLoading}>
						{isLoading ? m.register_button_registering() : m.register_button()}
					</Button>
				</Tabs.Content>
			</Tabs.Root>

			<!-- Login Link -->
			<div class="text-center text-xs text-muted-foreground">
				{m.register_already_have_account()}
				<button
					onclick={() => {
						open = false;
						onSwitchToLogin?.();
					}}
					class="text-primary hover:text-primary/80"
				>
					{m.register_go_to_login()}
				</button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
