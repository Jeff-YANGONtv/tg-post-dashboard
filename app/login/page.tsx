"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessError = params.get("error");
    if (accessError === "not-provisioned") {
      setAccessMessage(
        "Your account has not been added to the dashboard. Ask an administrator to provision it."
      );
    } else if (accessError === "configuration") {
      setAccessMessage(
        "Dashboard authentication is not configured. Check the Supabase environment variables."
      );
    }
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    let signInError: Error | null = null;
    try {
      const result = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      signInError = result.error;
    } catch (cause) {
      signInError =
        cause instanceof Error ? cause : new Error("Sign-in failed.");
    }

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext =
      next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
        ? next
        : "/";
    router.replace(safeNext);
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-card card">
        <div className="brand-mark login-mark">
          <LockKeyhole size={19} />
        </div>
        <div className="eyebrow">Signal Relay</div>
        <h1 className="h1">Sign in</h1>
        <p className="muted login-copy">
          Sign in with an account provisioned for this Telegram workspace.
        </p>
        {accessMessage && (
          <div className="notice login-message">{accessMessage}</div>
        )}
        {error && (
          <div className="notice error-state login-message">{error}</div>
        )}
        <form className="login-form" onSubmit={signIn}>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            className="input"
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            className="input"
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
          <button
            className="btn primary login-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Continue"} <ArrowRight size={15} />
          </button>
        </form>
        <p className="muted login-footnote">
          New accounts must be created and assigned a dashboard role by an
          administrator.
        </p>
      </section>
    </main>
  );
}
