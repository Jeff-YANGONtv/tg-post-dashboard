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
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment. Apply the SQL migration before using Settings.
- After deploying to a public HTTPS domain, save the bot token on the Settings page. The app checks it with Telegram before storing it.
- Select **Connect webhook** on Settings. The app registers `https://YOUR_DOMAIN/api/telegram/webhook` with Telegram and creates/stores a shared secret in Supabase if none is already configured. Do not expose `SUPABASE_SERVICE_ROLE_KEY` or the bot token in browser code.

## Deploy

Import the repository into Vercel, set the environment variables, and deploy. No Vercel Cron is configured, so Hobby-plan deployments do not require a Cron-enabled plan. On a Hobby team, commits must be associated with the GitHub account linked to the Vercel team owner or production deployments may be blocked. Scheduled posts are still saved in Supabase, but automatic dispatch requires an external scheduler (or a Vercel plan with Cron support) to call `/api/cron/publish-scheduled` with the configured `CRON_SECRET`. Use a Supabase project for PostgreSQL and Auth; create the first admin profile manually after signup.

## Install on Android

The dashboard is an installable PWA. Deploy it to an HTTPS URL, open it in Chrome on Android, then use **⋮ → Install app** (or **Add to Home screen**). The first visit needs an internet connection so the service worker can install. The service worker only provides a generic offline page for navigation failures; it deliberately does not cache API responses, account data, or private dashboard pages.

## Channel subscriber counts

The Channels page requests current member counts from Telegram when the page loads and includes a **Refresh counts** button. The bot must be able to access each channel; if Telegram rejects a count request, that channel displays **—** and the error is available as a tooltip.


The page also ranks the **top five channels across both source and destination types** by current subscriber count. Channels whose counts could not be retrieved are omitted from the ranking.
