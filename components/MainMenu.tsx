import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { uiColors } from "@/constants/Color";
import { GameModeType, MenuStateType, useAppState } from "@/hooks/useAppState";

export default function MainMenu() {
	const [appState, setAppState, appendAppState] = useAppState();
	const pausedGameState = appState.current === MenuStateType.MENU ? appState.containsGameMode() : undefined;

	const startOrResumeGame = () => {
		if (pausedGameState) {
			setAppState(pausedGameState);
			return;
		}

		appendAppState(GameModeType.Classic);
	};

	return (
		<View style={styles.screen}>
			<Image
				source={require("@/assets/icons/construct-logo.png")}
				resizeMode="contain"
				style={styles.logo}
			/>
			<View style={styles.buttonStack}>
				<MenuButton
					title="Играть"
					color={uiColors.play}
					onPress={startOrResumeGame}
				/>
				<MenuButton
					title="Лидерборд"
					color={uiColors.leaderboard}
					onPress={() => appendAppState(MenuStateType.HIGH_SCORES)}
				/>
				<MenuButton
					title="Настройки"
					color={uiColors.settings}
					onPress={() => appendAppState(MenuStateType.OPTIONS)}
				/>
			</View>
		</View>
	);
}

function MenuButton({ title, color, onPress }: { title: string; color: string; onPress: () => void }) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [styles.button, { backgroundColor: color }, pressed ? styles.pressed : null]}
		>
			<Text style={styles.buttonText}>{title}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		width: "100%",
		backgroundColor: uiColors.background,
		alignItems: "center",
		justifyContent: "center",
	},
	logo: {
		width: 124,
		maxWidth: "38%",
		height: 120,
		marginBottom: 42,
	},
	buttonStack: {
		width: 354,
		maxWidth: "78%",
		alignItems: "stretch",
		justifyContent: "center",
	},
	button: {
		height: 79,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 21,
	},
	pressed: {
		opacity: 0.82,
		transform: [{ translateY: 1 }],
	},
	buttonText: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 34,
		lineHeight: 40,
		fontWeight: "700",
		letterSpacing: -1.02,
		textAlign: "center",
	},
});
