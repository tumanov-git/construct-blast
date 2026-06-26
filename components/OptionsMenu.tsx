import { AppState, GameModeType, MenuStateType, useAppState } from "@/hooks/useAppState";
import { StyleSheet, Switch, Text, View } from "react-native";
import SimplePopupView from "./SimplePopupView";
import StylizedButton from "./StylizedButton";
import { useSettings } from "@/hooks/useSettings";
import { uiColors } from "@/constants/Color";
import type { ReactNode } from "react";

export default function OptionsMenu() {
	const [appState, setAppState, , popAppState] = useAppState();
	const [settings, setSettings] = useSettings();
	const gameState = appState.containsGameMode();

	const exitToMenu = () => {
		if (gameState) {
			setAppState(new AppState(MenuStateType.MENU, new AppState(gameState.current as GameModeType)));
			return;
		}

		setAppState(MenuStateType.MENU);
	};

	return (
		<SimplePopupView>
			<Text style={styles.title}>Настройки</Text>
			<SettingRow title="Вибрация">
				<Switch
					value={settings.hapticsEnabled}
					trackColor={{ false: "#444444", true: uiColors.settings }}
					thumbColor={uiColors.text}
					onValueChange={(value) => {
						setSettings((current) => ({ ...current, hapticsEnabled: value }));
					}}
				/>
			</SettingRow>
			<View style={styles.actions}>
				<StylizedButton onClick={popAppState} text="Назад" tone="settings" />
				{gameState && (
					<StylizedButton onClick={exitToMenu} text="Выйти" tone="play" />
				)}
			</View>
		</SimplePopupView>
	);
}

function SettingRow({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View style={styles.settingRow}>
			<Text style={styles.settingTitle}>{title}</Text>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	title: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 34,
		lineHeight: 40,
		fontWeight: "700",
		letterSpacing: -1.02,
		textAlign: "center",
		marginBottom: 18,
	},
	settingRow: {
		minHeight: 64,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderBottomWidth: 1,
		borderBottomColor: uiColors.panelLine,
	},
	settingTitle: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 22,
		lineHeight: 26,
		fontWeight: "700",
		letterSpacing: -0.66,
	},
	actions: {
		alignItems: "center",
		marginTop: 20,
	},
});
