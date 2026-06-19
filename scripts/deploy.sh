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

ARCHIVE="${TMPDIR:-/tmp}/construct-blast-${TIMESTAMP}.tgz"
REMOTE_ARCHIVE="/tmp/construct-blast-${TIMESTAMP}.tgz"

echo "==> Packing $BUILD_DIR"
tar -C "$ROOT/$BUILD_DIR" -czf "$ARCHIVE" .

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
	awk -v root_line="    root * /var/www/tematumanov.ru" \
		-v app="$app_name" \
		-v begin="$marker_begin" \
		-v end="$marker_end" '
		$0 == root_line && !inserted {
			print "    " begin
			print "    redir /" app " /" app "/"
			print ""
			print "    handle_path /" app "/* {"
			print "        root * /var/www/tematumanov.ru/" app
			print "        try_files {path} /index.html"
			print "        file_server"
			print "    }"
			print "    " end
			print ""
			inserted=1
		}
		{ print }
	' "$caddyfile" > "$tmpfile"
	cp "$tmpfile" "$caddyfile"
	rm -f "$tmpfile"
fi

caddy validate --config "$caddyfile"
systemctl reload caddy

echo "Published $target"
if [[ -d "$backup" ]]; then
	echo "Previous version kept at $backup"
fi
REMOTE_SCRIPT

rm -f "$ARCHIVE"

echo "==> Done: https://tematumanov.ru${APP_PATH}/"
