import { getTelegramWebApp } from "@/constants/Telegram";

export type LeaderboardMode = "run" | "total";

export interface LeaderboardEntry {
	userId: string;
	name: string;
	score: number;
	games: number;
	updatedAt: number;
}

export interface LeaderboardResponse {
	active: boolean;
	testActive: boolean;
	startAt: number;
	endAt: number;
	run: LeaderboardEntry[];
	total: LeaderboardEntry[];
}

export interface TournamentRun {
	started: boolean;
	runId: string;
	startedAt: number;
	active: boolean;
	testActive: boolean;
	startAt: number;
	endAt: number;
}

const API_BASE = "/construct/api";

function getTelegramPayload() {
	const webApp = getTelegramWebApp();
	const user = webApp?.initDataUnsafe?.user;

	return {
		initData: webApp?.initData ?? "",
		user: user
			? {
					id: user.id,
					first_name: user.first_name,
					last_name: user.last_name,
					username: user.username,
				}
			: null,
	};
}

export async function fetchTournamentLeaderboard(): Promise<LeaderboardResponse> {
	const response = await fetch(`${API_BASE}/leaderboard`, {
		headers: {
			accept: "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Leaderboard request failed: ${response.status}`);
	}

	return response.json() as Promise<LeaderboardResponse>;
}

export async function startTournamentRun(): Promise<TournamentRun | null> {
	const payload = getTelegramPayload();
	const response = await fetch(`${API_BASE}/run/start`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Run start failed: ${response.status}`);
	}

	const run = (await response.json()) as Partial<TournamentRun>;
	if (!run.started || !run.runId || !Number.isFinite(run.startedAt)) {
		return null;
	}

	return run as TournamentRun;
}

export async function submitTournamentScore(score: number, run: TournamentRun | null): Promise<void> {
	if (!Number.isFinite(score) || score <= 0) {
		return;
	}

	const payload = getTelegramPayload();
	const response = await fetch(`${API_BASE}/score`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json",
		},
		body: JSON.stringify({
			score: Math.floor(score),
			runId: run?.runId,
			startedAt: run?.startedAt,
			finishedAt: Date.now(),
			...payload,
		}),
	});

	if (!response.ok) {
		throw new Error(`Score submit failed: ${response.status}`);
	}
}
