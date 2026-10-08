# Signal Relay — Telegram Content Distribution Dashboard

A Next.js dashboard for ingesting Telegram channel posts, managing destination channels, publishing, scheduling, and reviewing deliveries. It can run on Vercel or Cloudflare Workers (via OpenNext).

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

## Deploy to Cloudflare Workers

This app uses Next.js App Router API routes, so a static Cloudflare Pages export is not sufficient. The repository is configured for Cloudflare Workers with the OpenNext adapter and a supported Next.js 16 release. Cloudflare currently recommends vinext for new projects; OpenNext is used here to retain the existing Next.js application and its route handlers.

1. Install with `pnpm install --frozen-lockfile`.
2. Apply `supabase/migrations/01_schema.sql` to the Supabase project.
3. In the Cloudflare Worker settings, set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong random `CRON_SECRET`. Store them as Worker variables/secrets; never commit real values. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are optional fallbacks.
4. For local Worker preview, copy `.dev.vars.example` to `.dev.vars` and add the required local values. `.dev.vars` is ignored by Git.
5. Run `pnpm preview` to test in the Workers runtime, then `pnpm deploy` to publish. `wrangler.jsonc` has `workers_dev: false` and no public route by default; attach a custom domain only after restricting the dashboard with Cloudflare Access (or another trusted access layer).
6. If Cloudflare Access is in use, allow only trusted dashboard users. Permit the Telegram webhook and scheduled-publish endpoint only as needed by the external services; those endpoints also validate their own webhook/cron secrets.

The dashboard has no built-in sign-in. Anyone who can reach it can view dashboard data, publish/delete Telegram messages, manage channels and schedules, and change settings. The Settings write API is public by design and can replace the stored bot token/webhook secret. Do not expose a public hostname until access controls are in place.

Scheduled posts are stored in Supabase, but this repository does not configure an automatic Cloudflare Cron trigger. Set up an external scheduler to call `/api/cron/publish-scheduled` with `Authorization: Bearer $CRON_SECRET`. The endpoint verifies this secret; internal publish requests use the same secret.

For the alternative Vercel deployment path, import the repository into Vercel and set the same environment values. Deploy from `main`. Vercel Cron is not configured in this repository.

## Install on Android

The dashboard is an installable PWA. Deploy it to an HTTPS URL, open it in Chrome on Android, then use **⋮ → Install app** (or **Add to Home screen**). The service worker only provides a generic offline page for navigation failures; it does not cache API responses.

## Channel subscriber counts

The Channels page requests current member counts from Telegram when the page loads and includes a **Refresh counts** button. The bot must be able to access each channel; if Telegram rejects a count request, that channel displays **—** and the error is available as a tooltip.

The page also ranks the **top five channels across both source and destination types** by current subscriber count. Channels whose counts could not be retrieved are omitted from the ranking.
