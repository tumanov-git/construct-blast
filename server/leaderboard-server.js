/* eslint-env node */
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8022);
const DATA_FILE = process.env.DATA_FILE || "/var/lib/construct-blast/leaderboard.json";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_AUTH_MAX_AGE_SECONDS = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
const MAX_SCORE = Number(process.env.MAX_SCORE || 1000000);
const OFFICIAL_START_MS = Date.UTC(2026, 5, 25, 21, 0, 0);
const END_MS = Date.UTC(2026, 6, 2, 21, 0, 0);
const TEST_START_MS = Number(process.env.TEST_START_MS || 0);
const LIMIT = 50;
const MAX_NAME_LENGTH = 64;

function readStore() {
	try {
		return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
	} catch (_error) {
		return { users: {}, runs: [] };
	}
}

function writeStore(store) {
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
	const users = Object.values(store.users);
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

function submitScore(payload) {
	const tournament = getTournamentState();
	if (!tournament.active) {
		return { accepted: false, reason: "Tournament is not active", ...tournament };
	}

	const score = Math.floor(Number(payload.score));
	if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
		return { accepted: false, reason: "Invalid score", ...tournament };
	}

	const player = normalizeUser(payload);
	if (!player) {
		return { accepted: false, reason: "Unauthorized", ...tournament };
	}

	const now = Date.now();
	const store = readStore();
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
	store.runs.push({ userId: player.id, score, createdAt: now });
	writeStore(store);

	return { accepted: true, ...tournament };
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
			sendJson(response, 200, submitScore(payload));
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
