import SimplePopupView from "./SimplePopupView";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import StylizedButton from "./StylizedButton";
import { GameModeType, useSetAppState } from "@/hooks/useAppState";
import { uiColors } from "@/constants/Color";
import {
	fetchTournamentLeaderboard,
	LeaderboardEntry,
	LeaderboardMode,
	LeaderboardResponse,
} from "@/constants/Leaderboard";

export default function HighScores() {
	const [setAppState, , popAppState] = useSetAppState();
	const [mode, setMode] = useState<LeaderboardMode>("run");
	const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
	const [now, setNow] = useState(Date.now());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		let cancelled = false;

		setLoading(true);
		fetchTournamentLeaderboard()
			.then((value) => {
				if (!cancelled) {
					setLeaderboard(value);
					setError(null);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError("Не удалось загрузить лидерборд");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const entries = leaderboard ? leaderboard[mode] : [];

	return (
		<SimplePopupView style={[styles.panel]}>
			<Text style={styles.title}>Лидерборд</Text>
			<Text style={styles.period}>{getTournamentLabel(leaderboard, now)}</Text>
			<View style={styles.tabs}>
				<LeaderboardTab active={mode === "run"} title="Лучшая игра" onPress={() => setMode("run")} />
				<LeaderboardTab active={mode === "total"} title="Общий счет" onPress={() => setMode("total")} />
			</View>
			{loading ? (
				<Text style={styles.empty}>Собираем таблицу</Text>
			) : error ? (
				<Text style={styles.empty}>Таблица пока не открылась</Text>
			) : entries.length > 0 ? (
				<View style={styles.listArea}>
					<ScrollView
						style={styles.listScroll}
						contentContainerStyle={styles.list}
						showsVerticalScrollIndicator={false}
					>
						{entries.map((entry, idx) => (
							<Score key={`${entry.userId}:${mode}`} rank={idx + 1} entry={entry} />
						))}
					</ScrollView>
				</View>
			) : (
				<Text style={styles.empty}>{getEmptyText(leaderboard, now)}</Text>
			)}
			<View style={styles.actions}>
				<StylizedButton text="Назад" onClick={popAppState} tone="settings" />
				{entries.length === 0 && (
					<StylizedButton text="Играть" onClick={() => setAppState(GameModeType.Classic)} tone="play" />
				)}
			</View>
		</SimplePopupView>
	);
}

function LeaderboardTab({
	active,
	title,
	onPress,
}: {
	active: boolean;
	title: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.tab, active ? styles.tabActive : null]}
		>
			<Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{title}</Text>
		</Pressable>
	);
}

function Score({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
	const active = rank === 1;

	return (
		<View style={styles.scoreRow}>
			<Text style={[styles.rank, { color: active ? uiColors.recordActive : uiColors.recordInactive }]}>
				#{rank}
			</Text>
			<View style={styles.scoreTexts}>
				<Text numberOfLines={1} style={styles.playerName}>{entry.name}</Text>
			</View>
			<Text style={styles.scoreValue}>{entry.score}</Text>
		</View>
	);
}

function getTournamentLabel(leaderboard: LeaderboardResponse | null, now: number): string {
	if (!leaderboard) {
		return "Секунду, сверяем турнир";
	}

	if (now < leaderboard.startAt) {
		return `Старт через ${formatCountdown(leaderboard.startAt - now)}`;
	}

	if (now < leaderboard.endAt) {
		return `До финала ${formatCountdown(leaderboard.endAt - now)}`;
	}

	return "Турнир завершен";
}

function getEmptyText(leaderboard: LeaderboardResponse | null, now: number): string {
	if (leaderboard && now < leaderboard.startAt) {
		return "Рейтинг откроется после старта";
	}

	return "Пока пусто. Забирай первую строчку";
}

function formatCountdown(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");

	if (days > 0) {
		return `${days}д ${time}`;
	}

	return time;
}

const styles = StyleSheet.create({
	panel: {
		justifyContent: "flex-start",
		height: "82%",
	},
	title: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 34,
		lineHeight: 40,
		fontWeight: "700",
		letterSpacing: -1.02,
		textAlign: "center",
	},
	period: {
		color: uiColors.textMuted,
		fontFamily: "GraphikLC-Bold",
		fontSize: 15,
		lineHeight: 20,
		letterSpacing: -0.45,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 14,
	},
	tabs: {
		width: "100%",
		flexDirection: "row",
		columnGap: 8,
		marginBottom: 12,
	},
	tab: {
		flex: 1,
		height: 44,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: uiColors.panel,
		borderWidth: 1,
		borderColor: uiColors.panelLine,
	},
	tabActive: {
		backgroundColor: uiColors.leaderboard,
		borderColor: uiColors.leaderboard,
	},
	tabText: {
		color: uiColors.textMuted,
		fontFamily: "GraphikLC-Bold",
		fontSize: 17,
		lineHeight: 22,
		fontWeight: "700",
		letterSpacing: -0.51,
	},
	tabTextActive: {
		color: uiColors.text,
	},
	listArea: {
		width: "100%",
		flex: 1,
		minHeight: 0,
	},
	listScroll: {
		width: "100%",
		flex: 1,
	},
	list: {
		paddingBottom: 4,
	},
	scoreRow: {
		minHeight: 56,
		flexDirection: "row",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: uiColors.panelLine,
	},
	rank: {
		width: 48,
		fontFamily: "GraphikLC-Bold",
		fontSize: 22,
		fontWeight: "700",
		letterSpacing: -0.66,
	},
	scoreTexts: {
		flex: 1,
		minWidth: 0,
	},
	playerName: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 20,
		lineHeight: 24,
		fontWeight: "700",
		letterSpacing: -0.6,
	},
	scoreValue: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 24,
		lineHeight: 30,
		fontWeight: "700",
		letterSpacing: -0.72,
		marginLeft: 10,
	},
	empty: {
		color: uiColors.text,
		fontFamily: "GraphikLC-Bold",
		fontSize: 22,
		lineHeight: 28,
		textAlign: "center",
		letterSpacing: -0.66,
		marginVertical: 24,
	},
	actions: {
		alignItems: "center",
		marginTop: 20,
	},
});
