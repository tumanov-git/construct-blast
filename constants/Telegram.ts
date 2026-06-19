export type TelegramWebAppUser = {
	id: number;
	first_name?: string;
	last_name?: string;
	username?: string;
	language_code?: string;
	is_premium?: boolean;
};

export type TelegramWebApp = {
	initData: string;
	initDataUnsafe?: {
		query_id?: string;
		user?: TelegramWebAppUser;
		start_param?: string;
		auth_date?: number;
		hash?: string;
	};
	colorScheme?: "light" | "dark";
	isExpanded?: boolean;
	ready: () => void;
	expand: () => void;
	setHeaderColor?: (color: string) => void;
	setBackgroundColor?: (color: string) => void;
	enableClosingConfirmation?: () => void;
	disableVerticalSwipes?: () => void;
	BackButton?: {
		hide: () => void;
	};
	MainButton?: {
		hide: () => void;
	};
};

declare global {
	interface Window {
		Telegram?: {
			WebApp?: TelegramWebApp;
		};
	}
}

let telegramSdkPromise: Promise<TelegramWebApp | null> | null = null;

function getExistingTelegramWebApp(): TelegramWebApp | null {
	if (typeof window === "undefined") {
		return null;
	}

	return window.Telegram?.WebApp ?? null;
}

export function getTelegramWebApp(): TelegramWebApp | null {
	return getExistingTelegramWebApp();
}

export function loadTelegramSdk(): Promise<TelegramWebApp | null> {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return Promise.resolve(null);
	}

	const existing = getExistingTelegramWebApp();
	if (existing) {
		return Promise.resolve(existing);
	}

	if (telegramSdkPromise) {
		return telegramSdkPromise;
	}

	telegramSdkPromise = new Promise((resolve) => {
		const finish = () => resolve(getExistingTelegramWebApp());
		const existingScript = document.querySelector<HTMLScriptElement>(
			'script[src="https://telegram.org/js/telegram-web-app.js"]',
		);

		if (existingScript) {
			existingScript.addEventListener("load", finish, { once: true });
			existingScript.addEventListener("error", () => resolve(null), { once: true });
			window.setTimeout(finish, 1200);
			return;
		}

		const script = document.createElement("script");
		script.src = "https://telegram.org/js/telegram-web-app.js";
		script.async = true;
		script.onload = finish;
		script.onerror = () => resolve(null);
		document.head.appendChild(script);
		window.setTimeout(finish, 1500);
	});

	return telegramSdkPromise;
}

export async function initializeTelegramWebApp(): Promise<TelegramWebApp | null> {
	const webApp = await loadTelegramSdk();

	if (!webApp) {
		return null;
	}

	try {
		webApp.ready();
		webApp.expand();
		webApp.disableVerticalSwipes?.();
		webApp.setHeaderColor?.("#050505");
		webApp.setBackgroundColor?.("#050505");
		webApp.BackButton?.hide();
		webApp.MainButton?.hide();
	} catch (error) {
		console.warn("Telegram WebApp initialization failed", error);
	}

	return webApp;
}

export function isTelegramMiniApp(webApp: TelegramWebApp | null): boolean {
	return Boolean(webApp?.initData || webApp?.initDataUnsafe?.user);
}

export function getTelegramUserLabel(webApp: TelegramWebApp | null): string | null {
	const user = webApp?.initDataUnsafe?.user;

	if (!user) {
		return null;
	}

	if (user.username) {
		return `@${user.username}`;
	}

	const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
	return name || null;
}
