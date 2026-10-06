import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  admin,
  supabaseAdminConfigError,
} from "../../../../lib/supabase/admin";
import {
  getMe,
  getWebhookInfo,
  setWebhook,
} from "../../../../lib/telegram/actions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const configError = supabaseAdminConfigError();
  if (configError)
    return NextResponse.json({ error: configError }, { status: 500 });

  const { data: settings, error: readError } = await admin
    .from("app_settings")
    .select("telegram_bot_token,telegram_webhook_secret,max_channels_per_post")
    .eq("id", 1)
    .maybeSingle();
  if (readError)
    return NextResponse.json(
      {
        error: `Could not read Telegram settings from Supabase: ${readError.message}`,
      },
      { status: 500 }
    );

  const token =
    settings?.telegram_bot_token?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token)
    return NextResponse.json(
      {
        error: "Save a valid Telegram bot token before connecting the webhook.",
      },
      { status: 422 }
    );

  const webhookUrl = new URL("/api/telegram/webhook", req.url);
  if (webhookUrl.protocol !== "https:") {
    return NextResponse.json(
      {
        error:
          "Webhook setup requires the app to be deployed on a public HTTPS domain. Deploy first, then retry.",
      },
      { status: 400 }
    );
  }

  const savedSecret = settings?.telegram_webhook_secret?.trim();
  const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const generatedSecret =
    !savedSecret && !envSecret ? randomBytes(32).toString("hex") : null;
  const secret = savedSecret || envSecret || generatedSecret;
  if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    return NextResponse.json(
      {
        error:
          "The configured webhook secret is invalid. Use only letters, numbers, underscores, and hyphens (up to 256 characters).",
      },
      { status: 422 }
    );
  }

  try {
    const bot = await getMe(token);
    if (generatedSecret) {
      const { error } = await admin.from("app_settings").upsert({
        id: 1,
        telegram_bot_token: token,
        telegram_webhook_secret: secret,
        max_channels_per_post: settings?.max_channels_per_post ?? 3,
        updated_at: new Date().toISOString(),
      });
      if (error)
        return NextResponse.json(
          {
            error: `Bot token is valid, but the webhook secret could not be saved to Supabase: ${error.message}`,
          },
          { status: 500 }
        );
    }

    const configured = await setWebhook(webhookUrl.toString(), secret, token);
    if (!configured)
      return NextResponse.json(
        { error: "Telegram did not confirm the webhook configuration." },
        { status: 502 }
      );

    let delivery: {
      pending_update_count?: number;
      last_error_message?: string | null;
      allowed_updates?: string[];
    } = {};
    try {
      const info = await getWebhookInfo(token);
      delivery = {
        pending_update_count: info.pending_update_count,
        last_error_message: info.last_error_message ?? null,
        allowed_updates: info.allowed_updates,
      };
    } catch {
      // The webhook was accepted; status details can be checked on a later attempt.
    }

    return NextResponse.json({
      ok: true,
      url: webhookUrl.toString(),
      bot_username: bot.username,
      ...delivery,
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Could not configure the Telegram webhook.",
      },
      { status: 422 }
    );
  }
}
