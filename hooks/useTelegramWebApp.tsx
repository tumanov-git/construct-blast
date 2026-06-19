import { useEffect, useState } from "react";
import {
	TelegramWebApp,
	getTelegramUserLabel,
	initializeTelegramWebApp,
	isTelegramMiniApp,
} from "@/constants/Telegram";

export function useTelegramWebApp() {
	const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let alive = true;

		initializeTelegramWebApp().then((telegramWebApp) => {
			if (!alive) {
				return;
			}

			setWebApp(telegramWebApp);
			setReady(true);
		});

		return () => {
			alive = false;
		};
	}, []);

	return {
		ready,
		webApp,
		isTelegramMiniApp: isTelegramMiniApp(webApp),
		userLabel: getTelegramUserLabel(webApp),
		initData: webApp?.initData ?? "",
	};
}
