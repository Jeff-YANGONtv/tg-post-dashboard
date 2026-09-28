# Signal Relay — Telegram Content Distribution Dashboard

A Vercel-ready Next.js dashboard for ingesting Telegram channel posts, matching destinations, publishing as copy or forward, scheduling, and managing published links.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key, service-role key, and a strong random `CRON_SECRET`.
3. Run `supabase/migrations/01_schema.sql` in the Supabase SQL editor.
4. Create users in Supabase Authentication. This app intentionally does not expose public signup.
5. Add each user's UUID to `public.profiles`; grant `admin` only to trusted operators and use `viewer` for read-only access. For example:

   ```sql
   insert into public.profiles (id, display_name, role)
   values ('AUTH_USER_UUID', 'Workspace admin', 'admin');
   ```

6. Start the app with `pnpm dev` and sign in at `/login`.

The dashboard checks the Supabase session and profile on requests. API reads require a provisioned account; settings and write actions require the `admin` role. Keep `SUPABASE_SERVICE_ROLE_KEY` and the Telegram bot token server-side.

## Telegram setup

- Add the bot to source channels so it can read channel posts.
- Add the bot as an administrator to destination channels with post and delete permissions.
- Apply the SQL migration before using Settings.
- After signing in as an administrator and deploying to a public HTTPS domain, save the bot token on the Settings page. The app checks it with Telegram before storing it.
- Select **Connect webhook** on Settings. The app registers `https://YOUR_DOMAIN/api/telegram/webhook` with Telegram and creates/stores a shared secret in Supabase if none is already configured.

## Deploy

Import the repository into Vercel and set all variables from `.env.example`. No Vercel Cron is configured, so Hobby-plan deployments do not require a Cron-enabled plan. On a Hobby team, commits must be associated with the GitHub account linked to the Vercel team owner or production deployments may be blocked.

Scheduled posts are saved in Supabase. Automatic dispatch requires an external scheduler (or a Vercel plan with Cron support) to call `/api/cron/publish-scheduled` with `Authorization: Bearer $CRON_SECRET`. Use a long, random secret and configure the same value in the deployment environment. The cron endpoint verifies the secret; its internal publish requests use the same secret and are not exposed as unauthenticated operations.

## Install on Android

The dashboard is an installable PWA. Deploy it to an HTTPS URL, sign in, open it in Chrome on Android, then use **⋮ → Install app** (or **Add to Home screen**). The service worker only provides a generic offline page for navigation failures; it deliberately does not cache API responses, account data, or private dashboard pages.

## Channel subscriber counts

The Channels page requests current member counts from Telegram when the page loads and includes a **Refresh counts** button. The bot must be able to access each channel; if Telegram rejects a count request, that channel displays **—** and the error is available as a tooltip.

The page also ranks the **top five channels across both source and destination types** by current subscriber count. Channels whose counts could not be retrieved are omitted from the ranking.
