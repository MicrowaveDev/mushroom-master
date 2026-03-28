# Telegram Mushroom Archiver

This project:

- fetches recent messages from a Telegram channel with the Telegram client API
- downloads image attachments
- extracts screenshot text with OpenAI vision
- sends the extracted text back to the channel as a new message
- saves source messages and OCR reposts as markdown files
- generates a mushroom-lore markdown summary from the collected material
- renders that markdown into HTML and exports a PDF
- optionally sends the PDF with a Telegram bot

## Requirements

- Node.js 20+
- a Telegram `api_id` and `api_hash` from https://my.telegram.org
- a Telegram string session stored in `CLIENT_TOKEN`
- OpenAI API access
- if you want automated PDF delivery: a Telegram bot token, plus either admin chat IDs or permission for the bot to post into the channel

## Setup

1. Install dependencies:

```bash
npm install
```

2. Fill in the missing values in `.env`:

- `TG_CLIENT_API_ID`
- `TG_CLIENT_API_HASH`
- `CHANNEL_USERNAME`

`CHANNEL_USERNAME` can be either:

- a public channel username like `my_channel`
- a `https://t.me/...` link
- the exact Telegram dialog title for a private/no-username channel, for example `Грибные истории`
- `TELEGRAM_BOT_TOKEN` if you want bot delivery
- `ADMIN_CHAT_IDS` if you want to deliver PDFs to specific admin inboxes

Set `BOT_SEND_TO_CHANNEL=true` if the bot should also post the generated PDF to the channel itself.

## Telegram bot delivery note

Telegram bots cannot reliably discover and direct-message all channel admins automatically. For inbox delivery, use `ADMIN_CHAT_IDS` with the numeric chat IDs of the admins who have already started the bot. If the bot is an admin in the channel, you can also set `BOT_SEND_TO_CHANNEL=true` to post the PDF into the channel.

`CLIENT_TOKEN` should be a Telegram string session for the account that can read the target channel.

Set `MESSAGE_LIMIT=0` to process all source posts in the channel. Any positive number limits how many source posts are processed.

## Run

```bash
npm run fetch
```

## Output

Generated files are written to `data/<channel>/`:

- `messages/` for original channel messages
- `assets/` for downloaded media
- `generated/` for OCR reposts, mushroom lore markdown, HTML, and PDF
