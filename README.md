# Signal Relay — Telegram Content Distribution Dashboard

A Vercel-ready Next.js dashboard for ingesting Telegram channel posts, matching destinations, publishing as copy or forward, scheduling, and managing published links.

## Local setup

1. `pnpm install`
2. Copy the environment variables from `.env.example` into Vercel or a local `.env.local`.
3. Run `supabase/migrations/01_schema.sql` in the Supabase SQL editor.
4. `pnpm dev`

## Telegram setup

- Add the bot to source channels so it can read channel posts.
- Add the bot as an administrator to destination channels with post and delete permissions.
- Set the webhook to `https://YOUR_DOMAIN/api/telegram/webhook` and include the same `TELEGRAM_WEBHOOK_SECRET` as the `X-Telegram-Bot-Api-Secret-Token` header.
- Use the dashboard Settings page to connect the webhook after setting the token.

## Deploy

Import the repository into Vercel, set the environment variables, and deploy. The `vercel.json` cron invokes the scheduled publication worker every five minutes. Use a Supabase project for PostgreSQL and Auth; create the first admin profile manually after signup.
