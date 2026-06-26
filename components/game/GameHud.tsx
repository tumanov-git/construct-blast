import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { SharedValue, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from "react-native-reanimated";
import { GameModeType } from "@/hooks/useAppState";
import { getHighScores } from "@/constants/Storage";
import { uiColors } from "@/constants/Color";

interface GameHudProps {
	score: SharedValue<number>;
	compact?: boolean;
}

export function StatsGameHud({ score, compact = false }: GameHudProps) {
	const [scoreText, setScoreText] = useState("0");
	const scoreAnimValue = useSharedValue(0);

	useAnimatedReaction(
		() => score.value,
		(current) => {
			scoreAnimValue.value = withTiming(current, { duration: 160 });
		},
	);

	useAnimatedReaction(
		() => scoreAnimValue.value,
		(current) => {
			runOnJS(setScoreText)(String(Math.floor(current)));
		},
	);

	return (
		<View style={[styles.scoreBlock, compact && styles.compactScoreBlock]}>
			<Text style={[styles.score, compact && styles.compactScore]}>{scoreText}</Text>
		</View>
	);
}

export function StickyGameHud({
	gameMode,
	score,
	compact = false,
}: {
	gameMode: GameModeType;
	score: SharedValue<number>;
	compact?: boolean;
}) {
	const [highestScore, setHighestScore] = useState(0);
	const [scoreState, setScoreState] = useState(score.value);

	useEffect(() => {
		getHighScores(gameMode, true, true).then((highScores) => {
			if (highScores.length > 0) {
				setHighestScore(highScores[0].score);
			}
		});
	}, [gameMode]);

	useAnimatedReaction(
		() => score.value,
		(current) => {
			runOnJS(setScoreState)(current);
		},
	);

	const active = scoreState >= highestScore;
	const record = Math.max(scoreState, highestScore);

	return (
		<Animated.View style={[styles.recordRow, compact && styles.compactRecordRow]}>
			<Image
				source={
					active
						? require("@/assets/icons/crown_active.svg")
						: require("@/assets/icons/crown_inactive.svg")
				}
				resizeMode="contain"
				style={[styles.crown, compact && styles.compactCrown]}
			/>
			<Text style={[styles.record, compact && styles.compactRecord, { color: active ? uiColors.recordActive : uiColors.recordInactive }]}>
				{record}
			</Text>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	recordRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 78,
		marginBottom: 12,
	},
	compactRecordRow: {
		marginTop: 54,
		marginBottom: 6,
	},
	crown: {
		width: 34,
		height: 34,
		marginRight: 10,
	},
	compactCrown: {
		width: 30,
		height: 30,
		marginRight: 8,
	},
	record: {
		fontFamily: "GraphikLC-Bold",
		fontSize: 25,
		lineHeight: 30,
		fontWeight: "700",
		letterSpacing: -0.75,
	},
	compactRecord: {
		fontSize: 23,
		lineHeight: 28,
		letterSpacing: -0.69,
	},
	scoreBlock: {
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 26,
		minHeight: 62,
	},
	compactScoreBlock: {
		marginBottom: 12,
		minHeight: 54,
	},
	score: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 58,
		lineHeight: 64,
		fontWeight: "700",
		letterSpacing: -1.74,
	},
	compactScore: {
		fontSize: 52,
		lineHeight: 56,
		letterSpacing: -1.56,
	},
});
