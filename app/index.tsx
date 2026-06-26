import {
	Platform,
	StyleSheet,
} from "react-native";
import { useFonts } from "expo-font";
import Animated, {
	FadeIn,
	FadeOut,
	ReanimatedLogLevel,
	configureReanimatedLogger,
} from "react-native-reanimated";
import Game from "@/components/game/Game";
import { AppState, GameModeType } from '@/hooks/useAppState';
import React, { useEffect } from "react";
import OptionsMenu from "@/components/OptionsMenu";
import { MenuStateType, useAppState } from "@/hooks/useAppState";
import MainMenu from "@/components/MainMenu";
import HighScores from "@/components/HighScoresMenu";
import LoadingScreen from "@/components/LoadingScreen";
import { uiColors } from "@/constants/Color";
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";

configureReanimatedLogger({
	level: ReanimatedLogLevel.warn,
	strict: false,
});

export default function App() {
	const telegram = useTelegramWebApp();

	const [loaded] = useFonts({
		GraphikLCBold: require("../assets/fonts/GraphikLC-Bold.otf"),
		"GraphikLC-Bold": Platform.OS === "web"
			? require("../assets/fonts/GraphikLC-Bold.woff2")
			: require("../assets/fonts/GraphikLC-Bold.otf"),
	});

	const [ appState, setAppState, , popAppState ] = useAppState();

	useEffect(() => {
		const backButton = telegram.webApp?.BackButton;
		if (!backButton) {
			return;
		}

		const currentGameMode = isGameMode(appState.current) ? appState.current : null;
		const shouldShowBack = currentGameMode != null || appState.prev != null;
		const handleBack = () => {
			if (currentGameMode != null) {
				setAppState(new AppState(MenuStateType.MENU, new AppState(currentGameMode)));
				return;
			}

			if (appState.prev) {
				popAppState();
			}
		};

		if (shouldShowBack) {
			backButton.show();
			backButton.onClick?.(handleBack);
		} else {
			backButton.hide();
		}

		return () => {
			backButton.offClick?.(handleBack);
		};
	}, [appState, popAppState, setAppState, telegram.webApp]);

	if (!loaded) return <LoadingScreen />;

	const gameModeSearch = appState.containsGameMode();
	const gameMode = gameModeSearch ? gameModeSearch.current as GameModeType : undefined;
	const showMenu =
		appState.current === MenuStateType.MENU ||
		(!gameMode && appState.containsState(MenuStateType.MENU));
	
	return (
		<Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
			{ gameMode && <Game gameMode={gameMode}></Game> }
			{ showMenu && (
				<MainMenu />
			) }
			{ appState.containsState(MenuStateType.OPTIONS) && <OptionsMenu></OptionsMenu> }
			{ appState.containsState(MenuStateType.HIGH_SCORES) && <HighScores></HighScores>}
		</Animated.View>
	);
}

function isGameMode(value: unknown): value is GameModeType {
	return Object.values(GameModeType).includes(value as GameModeType);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: uiColors.background,
		alignItems: "center",
		justifyContent: "center",
		width: '100%',
		height: '100%',
		touchAction: "none",
		overscrollBehavior: "none",
		userSelect: "none",
		WebkitUserSelect: "none",
		WebkitTouchCallout: "none",
	} as any,
});
