import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = new Set([
  "/login",
  "/api/telegram/webhook",
  "/api/cron/publish-scheduled",
]);

const viewerReadPaths = new Set([
  "/api/dashboard",
  "/api/channels",
  "/api/channels/subscribers",
]);

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (publicPaths.has(pathname)) {
    return NextResponse.next();
  }

  const isPublishCron =
    pathname === "/api/posts/publish" &&
    request.method === "POST" &&
    Boolean(process.env.CRON_SECRET) &&
    request.headers.get("authorization") ===
      `Bearer ${process.env.CRON_SECRET}`;
  if (isPublishCron) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return isApi
      ? jsonError("Supabase authentication is not configured.", 503)
      : NextResponse.redirect(
          new URL("/login?error=configuration", request.url)
        );
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (isApi) return jsonError("Authentication required.", 401);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    if (isApi) {
      return jsonError(
        "This account is not provisioned for the dashboard.",
        403
      );
    }
    return NextResponse.redirect(
      new URL("/login?error=not-provisioned", request.url)
    );
  }

  const isReadOnlyApi =
    request.method === "GET" && viewerReadPaths.has(pathname);
  const isAdminPage =
    pathname === "/settings" || pathname.startsWith("/settings/");
  const requiresAdmin = (isApi && !isReadOnlyApi) || isAdminPage;

  if (requiresAdmin && profile.role !== "admin") {
    if (isApi) return jsonError("Administrator access required.", 403);
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/).*)",
  ],
};
