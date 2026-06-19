#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${REMOTE:-vps-sw2}"
APP_PATH="${APP_PATH:-/construct}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/tematumanov.ru}"
REMOTE_CADDYFILE="${REMOTE_CADDYFILE:-/etc/caddy/Caddyfile}"
BUILD_DIR="${BUILD_DIR:-dist}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [[ "$APP_PATH" != /* || "$APP_PATH" == */ ]]; then
	echo "APP_PATH must start with / and must not end with /, got: $APP_PATH" >&2
	exit 1
fi

cd "$ROOT"
mkdir -p "$ROOT/.expo-home" "$ROOT/.npm-cache"

echo "==> Building web export for $APP_PATH"
rm -rf "$ROOT/$BUILD_DIR"
EXPO_NO_TELEMETRY=1 \
	HOME="$ROOT/.expo-home" \
	npm_config_cache="$ROOT/.npm-cache" \
	npx expo export -p web

if [[ ! -f "$ROOT/$BUILD_DIR/index.html" ]]; then
	echo "Missing $BUILD_DIR/index.html after export" >&2
	exit 1
fi

if ! grep -q "${APP_PATH}/" "$ROOT/$BUILD_DIR/index.html"; then
	echo "Export does not reference ${APP_PATH}/ assets. Check app.json experiments.baseUrl." >&2
	exit 1
fi

COMMIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
COMMIT_SHORT="$(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DIRTY="false"
if [[ -n "$(git status --porcelain 2>/dev/null || true)" ]]; then
	DIRTY="true"
	echo "==> Warning: deploying a dirty worktree"
fi

node -e '
const fs = require("fs");
const [file, commit, commitShort, dirty, builtAt, appPath] = process.argv.slice(1);
fs.writeFileSync(file, JSON.stringify({
	app: "construct-blast",
	commit,
	commitShort,
	dirty: dirty === "true",
	builtAt,
	path: appPath,
}, null, 2) + "\n");
' "$ROOT/$BUILD_DIR/deploy.json" "$COMMIT_SHA" "$COMMIT_SHORT" "$DIRTY" "$BUILD_TIME" "$APP_PATH"

ARCHIVE="${TMPDIR:-/tmp}/construct-blast-${TIMESTAMP}.tgz"
REMOTE_ARCHIVE="/tmp/construct-blast-${TIMESTAMP}.tgz"

echo "==> Packing $BUILD_DIR"
COPYFILE_DISABLE=1 tar --no-xattrs -C "$ROOT/$BUILD_DIR" -czf "$ARCHIVE" .

echo "==> Uploading to $REMOTE"
scp "$ARCHIVE" "$REMOTE:$REMOTE_ARCHIVE"

echo "==> Publishing on server"
ssh "$REMOTE" "bash -s" -- "$REMOTE_ARCHIVE" "$REMOTE_ROOT" "$APP_PATH" "$REMOTE_CADDYFILE" "$TIMESTAMP" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

archive="$1"
remote_root="$2"
app_path="$3"
caddyfile="$4"
timestamp="$5"
app_name="${app_path#/}"
target="$remote_root/$app_name"
stage="$remote_root/${app_name}.__new_$timestamp"
backup="$remote_root/${app_name}.__prev_$timestamp"
marker_begin="# BEGIN construct-blast"
marker_end="# END construct-blast"

rm -rf "$stage"
mkdir -p "$stage"
tar -xzf "$archive" -C "$stage"
rm -f "$archive"

chown -R www-data:www-data "$stage" || chown -R caddy:caddy "$stage" || true
find "$stage" -type d -exec chmod 755 {} +
find "$stage" -type f -exec chmod 644 {} +

if [[ -d "$target" ]]; then
	mv "$target" "$backup"
fi

mv "$stage" "$target"

if ! grep -q "$marker_begin" "$caddyfile"; then
	cp "$caddyfile" "${caddyfile}.bak-${timestamp}"
	tmpfile="$(mktemp)"
	awk -v app="$app_name" \
		-v remote_root="$remote_root" \
		-v begin="$marker_begin" \
		-v end="$marker_end" '
		function trim(value) {
			gsub(/^[[:space:]]+/, "", value)
			gsub(/[[:space:]]+$/, "", value)
			return value
		}
		trim($0) == "root * " remote_root && !inserted {
			print "    " begin
			print "    redir /" app " /" app "/"
			print ""
			print "    handle_path /" app "/* {"
			print "        root * " remote_root "/" app
			print "        try_files {path} /index.html"
			print "        file_server"
			print "    }"
			print "    " end
			print ""
			inserted=1
		}
		{ print }
		END {
			if (!inserted) {
				exit 42
			}
		}
	' "$caddyfile" > "$tmpfile" || {
		rm -f "$tmpfile"
		echo "Could not insert $app_path route before root directive in $caddyfile" >&2
		exit 1
	}
	cp "$tmpfile" "$caddyfile"
	rm -f "$tmpfile"
fi

caddy fmt --overwrite "$caddyfile"
caddy validate --config "$caddyfile"
systemctl reload caddy

echo "Published $target"
if [[ -d "$backup" ]]; then
	echo "Previous version kept at $backup"
fi
REMOTE_SCRIPT

rm -f "$ARCHIVE"

echo "==> Done: https://tematumanov.ru${APP_PATH}/"
