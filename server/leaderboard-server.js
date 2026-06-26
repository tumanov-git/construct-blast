/* eslint-env node */
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8022);
const DATA_FILE = process.env.DATA_FILE || "/var/lib/construct-blast/leaderboard.json";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_AUTH_MAX_AGE_SECONDS = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
const OFFICIAL_START_MS = Date.UTC(2026, 5, 25, 21, 0, 0);
const END_MS = Date.UTC(2026, 6, 2, 21, 0, 0);
const TEST_START_MS = Number(process.env.TEST_START_MS || 0);
const LIMIT = 50;
const MAX_NAME_LENGTH = 64;
const RUN_TOKEN_BYTES = 18;
const MIN_RUN_DURATION_MS = Number(process.env.MIN_RUN_DURATION_MS || 1500);
const MIN_SUBMIT_GAP_MS = Number(process.env.MIN_SUBMIT_GAP_MS || 3000);
const SUBMIT_WINDOW_MS = Number(process.env.SUBMIT_WINDOW_MS || 10 * 60 * 1000);
const MAX_SUBMITS_PER_WINDOW = Number(process.env.MAX_SUBMITS_PER_WINDOW || 6);
const DUPLICATE_HIGH_SCORE_MS = Number(process.env.DUPLICATE_HIGH_SCORE_MS || 10 * 60 * 1000);
const HIGH_SCORE_DUPLICATE_THRESHOLD = Number(process.env.HIGH_SCORE_DUPLICATE_THRESHOLD || 50000);
const RUN_TTL_MS = Number(process.env.RUN_TTL_MS || 6 * 60 * 60 * 1000);

function readStore() {
	try {
		return normalizeStore(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
	} catch (_error) {
		return normalizeStore({ users: {}, runs: [], runSessions: {}, cheaters: [] });
	}
}

function normalizeStore(store) {
	store.users ||= {};
	store.runs ||= [];
	store.runSessions ||= {};
	store.cheaters ||= [];
	return store;
}

function writeStore(store) {
	normalizeStore(store);
	fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
	const tempFile = `${DATA_FILE}.tmp`;
	fs.writeFileSync(tempFile, JSON.stringify(store, null, 2));
	fs.renameSync(tempFile, DATA_FILE);
}

function sendJson(response, statusCode, payload) {
	response.writeHead(statusCode, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"access-control-allow-origin": "*",
		"access-control-allow-methods": "GET, POST, OPTIONS",
		"access-control-allow-headers": "content-type",
	});
	response.end(JSON.stringify(payload));
}

function readBody(request) {
	return new Promise((resolve, reject) => {
		let body = "";
		request.on("data", (chunk) => {
			body += chunk;
			if (body.length > 64 * 1024) {
				request.destroy();
				reject(new Error("Request body too large"));
			}
		});
		request.on("end", () => resolve(body));
		request.on("error", reject);
	});
}

function parseTelegramUserFromInitData(initData) {
	if (!initData || !TELEGRAM_BOT_TOKEN) {
		return null;
	}

	const params = new URLSearchParams(initData);
	const hash = params.get("hash");
	if (!hash) {
		return null;
	}

	params.delete("hash");
	const dataCheckString = [...params.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");

	const secret = crypto
		.createHmac("sha256", "WebAppData")
		.update(TELEGRAM_BOT_TOKEN)
		.digest();
	const calculatedHash = crypto
		.createHmac("sha256", secret)
		.update(dataCheckString)
		.digest("hex");

	const hashBuffer = Buffer.from(hash, "hex");
	const calculatedHashBuffer = Buffer.from(calculatedHash, "hex");
	if (
		hashBuffer.length !== calculatedHashBuffer.length ||
		!crypto.timingSafeEqual(hashBuffer, calculatedHashBuffer)
	) {
		return null;
	}

	const authDate = Number(params.get("auth_date"));
	if (!Number.isFinite(authDate)) {
		return null;
	}

	const authAgeSeconds = Math.floor(Date.now() / 1000) - authDate;
	if (authAgeSeconds < -60 || authAgeSeconds > TELEGRAM_AUTH_MAX_AGE_SECONDS) {
		return null;
	}

	const userRaw = params.get("user");
	if (!userRaw) {
		return null;
	}

	try {
		const user = JSON.parse(userRaw);
		return user && user.id ? user : null;
	} catch (_error) {
		return null;
	}
}

function normalizeUser(payload) {
	const verifiedUser = parseTelegramUserFromInitData(payload.initData);
	if (!verifiedUser) {
		return null;
	}

	const name = [verifiedUser.first_name, verifiedUser.last_name].filter(Boolean).join(" ").trim();
	const displayName = name || verifiedUser.username || `Игрок ${verifiedUser.id}`;
	return {
		id: String(verifiedUser.id),
		name: displayName.slice(0, MAX_NAME_LENGTH),
	};
}

function createRunId() {
	return crypto.randomBytes(RUN_TOKEN_BYTES).toString("base64url");
}

function hashValue(value) {
	if (!value) {
		return undefined;
	}

	return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function getClientMeta(request) {
	const forwardedFor = request.headers["x-forwarded-for"];
	const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || request.socket.remoteAddress || "";
	const userAgent = request.headers["user-agent"] || "";

	return {
		ipHash: hashValue(String(ip).split(",")[0].trim()),
		userAgent: String(userAgent).slice(0, 220),
	};
}

function getUserRuns(store, userId) {
	return (store.runs || []).filter((run) => String(run.userId) === String(userId));
}

function getRecentSubmits(store, userId, now, windowMs) {
	return getUserRuns(store, userId).filter(
		(run) => (!run.status || run.status === "accepted") && now - run.createdAt <= windowMs,
	);
}

function addCheaterEvent(store, event) {
	store.cheaters.push(event);
	if (store.cheaters.length > 2000) {
		store.cheaters = store.cheaters.slice(-2000);
	}
}

function getTournamentState(now = Date.now()) {
	const testActive = TEST_START_MS > 0 && now >= TEST_START_MS && now < OFFICIAL_START_MS;
	const officialActive = now >= OFFICIAL_START_MS && now < END_MS;

	return {
		active: testActive || officialActive,
		testActive,
		startAt: OFFICIAL_START_MS,
		endAt: END_MS,
	};
}

function formatEntry(user, scoreType) {
	return {
		userId: user.id,
		name: user.name,
		score: scoreType === "total" ? user.totalScore : user.bestRun,
		games: user.games,
		updatedAt: user.updatedAt,
	};
}

function getLeaderboardPayload() {
	const store = readStore();
	const tournamentUsers = {};

	for (const run of store.runs || []) {
		if (run.status && run.status !== "accepted") {
			continue;
		}

		if (run.createdAt < OFFICIAL_START_MS || run.createdAt >= END_MS) {
			continue;
		}

		const sourceUser = store.users[String(run.userId)];
		if (!sourceUser) {
			continue;
		}

		const user = tournamentUsers[sourceUser.id] || {
			id: sourceUser.id,
			name: sourceUser.name,
			bestRun: 0,
			totalScore: 0,
			games: 0,
			updatedAt: 0,
		};
		user.name = sourceUser.name;
		user.bestRun = Math.max(user.bestRun, run.score);
		user.totalScore += run.score;
		user.games += 1;
		user.updatedAt = Math.max(user.updatedAt, run.createdAt);
		tournamentUsers[sourceUser.id] = user;
	}

	const users = Object.values(tournamentUsers);
	const byRun = [...users]
		.filter((user) => user.bestRun > 0)
		.sort((a, b) => b.bestRun - a.bestRun || a.updatedAt - b.updatedAt)
		.slice(0, LIMIT)
		.map((user) => formatEntry(user, "run"));
	const byTotal = [...users]
		.filter((user) => user.totalScore > 0)
		.sort((a, b) => b.totalScore - a.totalScore || a.updatedAt - b.updatedAt)
		.slice(0, LIMIT)
		.map((user) => formatEntry(user, "total"));

	return {
		...getTournamentState(),
		run: byRun,
		total: byTotal,
	};
}

function recordRun(store, player, score, status, reason, payload, request, extra = {}) {
	const now = extra.now || Date.now();
	const meta = getClientMeta(request);
	const run = {
		runId: payload.runId || null,
		userId: player?.id || null,
		name: player?.name || payload.user?.first_name || null,
		score,
		status,
		reason,
		startedAt: Number(payload.startedAt) || null,
		finishedAt: Number(payload.finishedAt) || null,
		durationMs: extra.durationMs ?? null,
		createdAt: now,
		ipHash: meta.ipHash,
		userAgent: meta.userAgent,
	};

	store.runs.push(run);
	if (status !== "accepted") {
		addCheaterEvent(store, {
			...run,
			payloadScore: payload.score,
			hasInitData: Boolean(payload.initData),
		});
	}

	return run;
}

function rejectSubmit(store, player, score, reason, payload, request, extra = {}) {
	recordRun(store, player, score, "rejected", reason, payload, request, extra);
	writeStore(store);
	return { accepted: false, status: "rejected", reason, ...getTournamentState() };
}

function acceptSubmit(store, player, score, reason, payload, request, extra = {}) {
	const now = extra.now || Date.now();
	const existing = store.users[player.id] || {
		id: player.id,
		name: player.name,
		bestRun: 0,
		totalScore: 0,
		games: 0,
		updatedAt: now,
	};

	existing.name = player.name;
	existing.bestRun = Math.max(existing.bestRun, score);
	existing.totalScore += score;
	existing.games += 1;
	existing.updatedAt = now;
	store.users[player.id] = existing;
	recordRun(store, player, score, "accepted", reason, payload, request, extra);
	writeStore(store);

	return { accepted: true, status: "accepted", ...getTournamentState() };
}

function getRateLimitReason(store, userId, now) {
	const recentSubmits = getRecentSubmits(store, userId, now, SUBMIT_WINDOW_MS);
	if (recentSubmits.length >= MAX_SUBMITS_PER_WINDOW) {
		return "Too many submits";
	}

	const previousSubmit = getUserRuns(store, userId)
		.filter((run) => (!run.status || run.status === "accepted") && run.createdAt < now)
		.sort((a, b) => b.createdAt - a.createdAt)[0];
	if (previousSubmit && now - previousSubmit.createdAt < MIN_SUBMIT_GAP_MS) {
		return "Submit too soon";
	}

	return null;
}

function startRun(payload, request) {
	const tournament = getTournamentState();
	if (!tournament.active) {
		return { started: false, reason: "Tournament is not active", ...tournament };
	}

	const player = normalizeUser(payload);
	const store = readStore();
	const now = Date.now();

	if (!player) {
		addCheaterEvent(store, {
			runId: null,
			userId: null,
			name: null,
			score: null,
			status: "rejected",
			reason: "Unauthorized run start",
			createdAt: now,
			...getClientMeta(request),
			hasInitData: Boolean(payload.initData),
		});
		writeStore(store);
		return { started: false, reason: "Unauthorized", ...tournament };
	}

	const runId = createRunId();
	store.runSessions[runId] = {
		runId,
		userId: player.id,
		name: player.name,
		startedAt: now,
		submittedAt: null,
		status: "started",
	};
	writeStore(store);

	return {
		started: true,
		runId,
		startedAt: now,
		...tournament,
	};
}

function submitScore(payload, request) {
	const tournament = getTournamentState();
	const store = readStore();
	const now = Date.now();
	const score = Math.floor(Number(payload.score));

	if (!tournament.active) {
		return rejectSubmit(store, null, score || 0, "Tournament is not active", payload, request, { now });
	}

	if (!Number.isFinite(score) || score <= 0) {
		return rejectSubmit(store, null, score || 0, "Invalid score", payload, request, { now });
	}

	const player = normalizeUser(payload);
	if (!player) {
		return rejectSubmit(store, null, score, "Unauthorized", payload, request, { now });
	}

	const runId = String(payload.runId || "");
	if (!runId) {
		const rateLimitReason = getRateLimitReason(store, player.id, now);
		if (rateLimitReason) {
			return rejectSubmit(store, player, score, rateLimitReason, payload, request, { now });
		}

		return acceptSubmit(store, player, score, "legacy client", payload, request, { now });
	}

	const session = store.runSessions[runId];
	if (!session) {
		return rejectSubmit(store, player, score, "Unknown run id", payload, request, { now });
	}

	if (String(session.userId) !== player.id) {
		return rejectSubmit(store, player, score, "Run user mismatch", payload, request, { now });
	}

	if (session.submittedAt) {
		return rejectSubmit(store, player, score, "Run already submitted", payload, request, { now });
	}

	if (now - session.startedAt > RUN_TTL_MS) {
		return rejectSubmit(store, player, score, "Run expired", payload, request, { now });
	}

	const serverDurationMs = now - session.startedAt;
	const effectiveDurationMs = serverDurationMs;
	if (effectiveDurationMs < MIN_RUN_DURATION_MS) {
		return rejectSubmit(store, player, score, "Run submitted too quickly", payload, request, {
			now,
			durationMs: effectiveDurationMs,
		});
	}

	const rateLimitReason = getRateLimitReason(store, player.id, now);
	if (rateLimitReason) {
		return rejectSubmit(store, player, score, rateLimitReason, payload, request, {
			now,
			durationMs: effectiveDurationMs,
		});
	}

	const duplicateHigh = getUserRuns(store, player.id).some(
		(run) =>
			run.status === "accepted" &&
			run.score === score &&
			score >= HIGH_SCORE_DUPLICATE_THRESHOLD &&
			now - run.createdAt <= DUPLICATE_HIGH_SCORE_MS,
	);
	if (duplicateHigh) {
		return rejectSubmit(store, player, score, "Repeated high score", payload, request, {
			now,
			durationMs: effectiveDurationMs,
		});
	}

	session.submittedAt = now;
	session.status = "submitted";
	return acceptSubmit(store, player, score, null, payload, request, {
		now,
		durationMs: effectiveDurationMs,
	});
}

const server = http.createServer(async (request, response) => {
	try {
		if (request.method === "OPTIONS") {
			sendJson(response, 204, {});
			return;
		}

		const url = new URL(request.url || "/", "http://localhost");

		if (request.method === "GET" && url.pathname.endsWith("/leaderboard")) {
			sendJson(response, 200, getLeaderboardPayload());
			return;
		}

		if (request.method === "POST" && url.pathname.endsWith("/score")) {
			const body = await readBody(request);
			const payload = body ? JSON.parse(body) : {};
			sendJson(response, 200, submitScore(payload, request));
			return;
		}

		if (request.method === "POST" && url.pathname.endsWith("/run/start")) {
			const body = await readBody(request);
			const payload = body ? JSON.parse(body) : {};
			sendJson(response, 200, startRun(payload, request));
			return;
		}

		sendJson(response, 404, { error: "Not found" });
	} catch (error) {
		console.error(error);
		sendJson(response, 500, { error: "Internal error" });
	}
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`construct leaderboard api listening on 127.0.0.1:${PORT}`);
});
