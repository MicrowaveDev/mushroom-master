# Telegram Production Readiness

This is the Telegram launch checklist for Mushroom Battles. The game should also remain usable as a normal web game for visitors who arrive from Google or direct web links.

## What Is Implemented In Repo

- The app validates Telegram Mini App `initData` before creating a session.
- Visitors outside Telegram can create a browser-backed web session through `/api/auth/web`; the frontend stores a local browser id so progress survives normal page reloads and session renewal on the same device/browser.
- Direct Mini App links are generated as `https://t.me/<bot>/<mini-app-name>?startapp=<payload>`.
- Friend invites now use Telegram's native share link inside Telegram clients before falling back to browser share/clipboard.
- The server exposes `/api/bot/webhook` for Bot API updates.
- Game callback queries with `game_short_name` are answered through `answerCallbackQuery` with a launch URL.
- `/api/bot/game-score` can report a Telegram Game score through `setGameScore` when the client provides the Telegram game message context.
- The frontend captures `tgGameChatId`, `tgGameMessageId`, and `tgInlineMessageId` from Telegram Game launch URLs and reports the season score when a run completes.
- The HTML shell includes basic SEO, Open Graph, Twitter, and structured metadata for web search and Telegram link previews.

## BotFather Setup

1. Create or configure the bot.
   - Set `TELEGRAM_BOT_TOKEN`.
   - Set `TELEGRAM_BOT_USERNAME` without `@`.

2. Configure the Main Mini App.
   - In BotFather, set the bot's Main Mini App URL to the production HTTPS URL.
   - Set the direct Mini App short name to match `TELEGRAM_MINI_APP_NAME` (`app` by default).
   - Upload localized media previews for the bot profile. These are not controlled by repo code.

3. Configure the classic Telegram Game.
   - Use BotFather `/newgame`.
   - Set the game short name to `TELEGRAM_GAME_SHORT_NAME` (`mushroom_master` by default).
   - Upload the game photo and GIF animation. Telegram uses these for in-chat game previews.
   - Point the game URL to the same production app URL or a game-specific landing URL.

4. Enable inline mode if you want richer share cards later.
   - The current app shares links and text.
   - Prepared inline messages / inline result cards require Bot API-side inline query handling and media assets.

## Required Production Env

```bash
NODE_ENV=production
PUBLIC_GAME_URL=https://mushroombattles.com/
TELEGRAM_GAME_URL=https://mushroombattles.com/
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=mushroom_game_bot
TELEGRAM_MINI_APP_NAME=app
TELEGRAM_GAME_SHORT_NAME=mushroom_master
TELEGRAM_WEBHOOK_SECRET=<random-long-secret>
DATABASE_URL=postgres://...
```

`PUBLIC_GAME_URL` is used for public links and previews. `TELEGRAM_GAME_URL` is used when Telegram presses the Play button on a Game message. They can be the same URL.

## Webhook Setup

Register the webhook after deploy:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://mushroombattles.com/api/bot/webhook\",
    \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }"
```

Production refuses unauthenticated webhook requests unless `X-Telegram-Bot-Api-Secret-Token` matches `TELEGRAM_WEBHOOK_SECRET`.

## Sending Real Game Messages

To get Telegram's in-chat Game preview and scoreboard UI, the bot must send a Game message, not only a Mini App link:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendGame" \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"<chat-id>\",
    \"game_short_name\": \"$TELEGRAM_GAME_SHORT_NAME\"
  }"
```

Telegram will render the game photo/GIF from BotFather and attach a Play button. When a user taps Play, Telegram sends a callback query to `/api/bot/webhook`; the server answers it with the launch URL.

## In-Chat Scores

Telegram scoreboards work only for messages created by `sendGame` or inline game results. To update the score, the server must call `setGameScore` with:

- `user_id`: Telegram user id
- `score`: non-negative integer
- either `chat_id` + `message_id`
- or `inline_message_id`

The repo exposes `/api/bot/game-score`, but the production client still needs the game-message context. Recommended launch path:

1. User opens from a Telegram Game message.
2. The callback launch URL includes `tgGameChatId`, `tgGameMessageId`, or `tgInlineMessageId`.
3. The frontend stores that context for the session.
4. On run completion, the frontend submits the season score to `/api/bot/game-score`.
5. The backend calls `setGameScore`; Telegram updates the in-chat scoreboard.

Current Mushroom Battles score formula:

```text
score = season_points_after_run
```

This keeps Telegram's scoreboard aligned with the in-app season ladder. If you prefer single-run virality instead, use:

```text
score = wins * 100 + rounds_completed * 10 + max(0, lives_remaining)
```

Pick one before launch and do not change it casually, because Telegram high scores only increase unless `force=true` is used.

## Preview Assets

There are three preview layers:

- **Bot profile media previews**: upload in BotFather for the Main Mini App.
- **Classic Game preview photo/GIF**: upload in BotFather for `/newgame`.
- **Web link previews**: served from `web/index.html` Open Graph tags.

Before launch, create final media:

- square bot icon
- Mini App profile preview video/GIF
- Game animation GIF showing artifact packing and a battle result
- link preview image at a stable public URL
- verify `https://mushroombattles.com/ui/mushroom-panel-trim.png` is replaced with the final polished preview image URL if the launch artwork changes

## Manual QA In Telegram

Run these tests on real Telegram mobile clients:

- Open from bot profile Launch App.
- Open from `https://t.me/<bot>/<app>?startapp=entry_private`.
- Open from a group mention reply.
- Open from a `sendGame` message.
- Confirm `answerCallbackQuery` opens the app without a stuck loading spinner.
- Complete a run from a Game message and verify `setGameScore` updates the chat scoreboard.
- Share a friend invite from inside Telegram and confirm the share sheet opens.
- Check Android and iOS safe areas, fullscreen behavior, haptics, and Back button behavior.

## Known Remaining Work

- Add inline query handling if you want rich replay/result cards rather than text/link sharing.
- Replace the current Open Graph image with a polished production preview image.
- Revisit whether Game scores should mirror season points or single-run performance after the first test cohort.

## Official References

- Telegram Bot API Games: https://core.telegram.org/bots/api#games
- `answerCallbackQuery`: https://core.telegram.org/bots/api#answercallbackquery
- `setGameScore`: https://core.telegram.org/bots/api#setgamescore
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
