import StylizedButton from "@/components/StylizedButton";
import { StyleSheet, Text, View } from "react-native";
import { uiColors } from "@/constants/Color";

export default function GameOverOverlay({
	score,
	onRestart,
	onMenu,
}: {
	score: number;
	onRestart: () => void;
	onMenu: () => void;
}) {
	return (
		<View style={styles.overlay}>
			<View style={styles.panel}>
				<Text style={styles.title}>Игра окончена</Text>
				<Text style={styles.score}>{score}</Text>
				<View style={styles.actions}>
					<StylizedButton text="Еще раз" onClick={onRestart} tone="play" />
					<StylizedButton text="В меню" onClick={onMenu} tone="settings" />
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		zIndex: 2000,
		backgroundColor: uiColors.overlay,
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
	},
	panel: {
		width: "100%",
		maxWidth: 420,
		borderRadius: 8,
		backgroundColor: uiColors.panel,
		alignItems: "center",
		padding: 24,
	},
	title: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 28,
		lineHeight: 34,
		fontWeight: "700",
		letterSpacing: -0.84,
		textAlign: "center",
	},
	score: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 70,
		lineHeight: 78,
		fontWeight: "700",
		letterSpacing: -2.1,
		marginTop: 12,
	},
	actions: {
		alignItems: "center",
		marginTop: 8,
	},
});
