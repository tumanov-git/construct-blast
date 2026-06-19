#!/usr/bin/env bash
set -Eeuo pipefail

MINI_APP_URL="${MINI_APP_URL:-https://tematumanov.ru/construct/}"
MENU_BUTTON_TEXT="${MENU_BUTTON_TEXT:-Играть}"
BOT_NAME="${BOT_NAME:-Construct Blast}"
BOT_SHORT_DESCRIPTION="${BOT_SHORT_DESCRIPTION:-8x8 головоломка с блоками}"
BOT_DESCRIPTION="${BOT_DESCRIPTION:-Construct Blast: собирай линии на поле 8x8 и выбивай рекорд.}"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
	read -r -s -p "Telegram bot token: " TELEGRAM_BOT_TOKEN
	echo
fi

api_url() {
	printf "https://api.telegram.org/bot%s/%s" "$TELEGRAM_BOT_TOKEN" "$1"
}

post_form() {
	local method="$1"
	shift
	curl -fsS -X POST "$(api_url "$method")" "$@"
	echo
}

post_json() {
	local method="$1"
	local payload="$2"
	curl -fsS -X POST "$(api_url "$method")" \
		-H "Content-Type: application/json" \
		-d "$payload"
	echo
}

echo "==> Checking bot token"
post_form getMe >/dev/null

echo "==> Setting bot profile"
post_form setMyName --data-urlencode "name=$BOT_NAME" >/dev/null
post_form setMyShortDescription --data-urlencode "short_description=$BOT_SHORT_DESCRIPTION" >/dev/null
post_form setMyDescription --data-urlencode "description=$BOT_DESCRIPTION" >/dev/null

echo "==> Setting commands"
commands_payload="$(node -e 'console.log(JSON.stringify({ commands: [{ command: "start", description: "Запустить игру" }] }))')"
post_json setMyCommands "$commands_payload" >/dev/null

echo "==> Setting menu button"
menu_payload="$(MINI_APP_URL="$MINI_APP_URL" MENU_BUTTON_TEXT="$MENU_BUTTON_TEXT" node -e '
const url = process.env.MINI_APP_URL;
const text = process.env.MENU_BUTTON_TEXT;
console.log(JSON.stringify({
	menu_button: {
		type: "web_app",
		text,
		web_app: { url },
	},
}));
')"
post_json setChatMenuButton "$menu_payload" >/dev/null

echo "==> Telegram bot is ready: $MINI_APP_URL"
