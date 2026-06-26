import { Pressable, StyleSheet, Text } from "react-native";
import { uiColors } from "@/constants/Color";

type ButtonTone = "play" | "leaderboard" | "settings" | "neutral" | "danger";

const toneColors: Record<ButtonTone, string> = {
	play: uiColors.play,
	leaderboard: uiColors.leaderboard,
	settings: uiColors.settings,
	neutral: "#3A3A3A",
	danger: "#5A2B22",
};

export default function StylizedButton({
	text,
	onClick,
	backgroundColor,
	centered = true,
	tone = "neutral",
}: {
	text: string;
	onClick?: () => void;
	backgroundColor?: string;
	centered?: boolean;
	borderColor?: string;
	tone?: ButtonTone;
}) {
	return (
		<Pressable
			onPress={onClick}
			style={({ pressed }) => [
				styles.button,
				{ backgroundColor: backgroundColor ?? toneColors[tone] },
				centered ? styles.centered : styles.leftAligned,
				pressed ? styles.pressed : null,
			]}
		>
			<Text style={styles.buttonText}>{text}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		minWidth: 190,
		height: 52,
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
		marginVertical: 7,
		paddingHorizontal: 18,
	},
	centered: {
		alignSelf: "center",
	},
	leftAligned: {
		alignSelf: "flex-start",
	},
	pressed: {
		opacity: 0.82,
		transform: [{ translateY: 1 }],
	},
	buttonText: {
		fontSize: 22,
		lineHeight: 26,
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontWeight: "700",
		textAlign: "center",
		letterSpacing: -0.66,
	},
});
