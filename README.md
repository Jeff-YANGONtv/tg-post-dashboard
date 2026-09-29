# Signal Relay — Telegram Content Distribution Dashboard

A Vercel-ready Next.js dashboard for ingesting Telegram channel posts, managing destination channels, publishing, scheduling, and reviewing deliveries.

## Public access warning

This app intentionally has **no sign-in**. Anyone who can reach the public URL can view dashboard data and use its actions, including publishing or deleting Telegram messages, managing channels and schedules, and changing Settings (including the configured bot token). Use this configuration only if that level of public access is intended. Do not put private posts or confidential channel information in this instance.

The Supabase service-role key, Telegram bot token, cron secret, and webhook secret are used server-side and are never sent as cleartext by the Settings read API. The Settings write API is public by design in this configuration, so visitors can replace the saved bot token or webhook secret. The Telegram webhook still validates its configured secret, and scheduled-publishing calls still require `CRON_SECRET`.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL, server-only service-role key, and a strong random `CRON_SECRET`.
3. Run `supabase/migrations/01_schema.sql` in the Supabase SQL editor.
4. Start the app with `pnpm dev`.

## Telegram setup

- Add the bot to source channels so it can read channel posts.
- Add the bot as an administrator to destination channels with post and delete permissions.
- Apply the SQL migration before using Settings.
- Save the bot token on the Settings page. The app checks it with Telegram before storing it.
- Select **Connect webhook** on Settings. The app registers `https://YOUR_DOMAIN/api/telegram/webhook` with Telegram and creates/stores a shared secret in Supabase if none is already configured.

## Deploy

Import the repository into Vercel and set all variables from `.env.example`. Deploy from **`main` only**. No Vercel Cron is configured, so Hobby-plan deployments do not require a Cron-enabled plan. On a Hobby team, commits must be associated with the GitHub account linked to the Vercel team owner or production deployments may be blocked.

Scheduled posts are saved in Supabase. Automatic dispatch requires an external scheduler (or a Vercel plan with Cron support) to call `/api/cron/publish-scheduled` with `Authorization: Bearer $CRON_SECRET`. Use a long, random secret and configure the same value in the deployment environment. The cron endpoint verifies the secret; its internal publish requests use the same secret.

## Install on Android

The dashboard is an installable PWA. Deploy it to an HTTPS URL, open it in Chrome on Android, then use **⋮ → Install app** (or **Add to Home screen**). The service worker only provides a generic offline page for navigation failures; it does not cache API responses.

## Channel subscriber counts

The Channels page requests current member counts from Telegram when the page loads and includes a **Refresh counts** button. The bot must be able to access each channel; if Telegram rejects a count request, that channel displays **—** and the error is available as a tooltip.

The page also ranks the **top five channels across both source and destination types** by current subscriber count. Channels whose counts could not be retrieved are omitted from the ranking.
