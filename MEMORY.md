# construct-blast memory

## Product direction

- This project is becoming a custom Telegram Mini App game deployed at `https://tematumanov.ru/construct`.
- Expo web `baseUrl` should stay `/construct` for that deployment target.
- Treat the original `blockerino` codebase as a donor engine: keep the board, drag/drop, piece placement, line clearing, scoring base, and animation mechanics; redesign the shell, text, visuals, assets, and deployment.
- The target game mode is one Block Blast-like mode: `8x8` board and `3` pieces in hand.
- Custom block art will come from Figma later. Until then, keep the current block rendering as a replaceable skin layer.

## Current dev build

- Project was renamed to `construct-blast`.
- Dev server target: `http://localhost:8081`.
- Current implementation includes:
  - one 8x8 mode,
  - game over detection,
  - temporary game over overlay,
  - temporary loading screen,
  - local high scores,
  - settings for haptics and dev move-quality HUD,
  - smart hand generation and move-quality evaluation in `constants/GameIntelligence.tsx`.

## Game intelligence

- The intended feel is not pure random. Use curated random similar to the user's Block Blast hypothesis.
- The evaluator should estimate whether a move was weak, good, great, or best by comparing it against all legal moves from the current hand.
- The generator should create multiple hand candidates and pick from a controlled percentile based on board danger, so the game can offer recoverable chances without feeling scripted.
- Dev builds should show move quality so the formula can be tuned by feel before adding player-facing praise/likes.

## Deployment notes

- The user has a server alias: `ssh vps-sw2`.
- Deployment target is `tematumanov.ru/construct`.
- Server inspection must be read-only unless the user explicitly asks to deploy or mutate server state.
- One-button deploy command: `npm run deploy`.
- Telegram bot setup command: `npm run telegram:init`.
- Never commit Telegram bot tokens. Pass them as `TELEGRAM_BOT_TOKEN` or paste into the hidden prompt.

## Validation

- `npx tsc --noEmit` should pass.
- `env EXPO_NO_TELEMETRY=1 HOME=/Users/izotop/construct-blast/.expo-home npm_config_cache=/Users/izotop/construct-blast/.npm-cache npm run lint` should run without lint errors; warnings currently exist from the old prototype style.
- `env EXPO_NO_TELEMETRY=1 HOME=/Users/izotop/construct-blast/.expo-home npm_config_cache=/Users/izotop/construct-blast/.npm-cache npx expo export -p web` should produce `dist/`.
