"use client";

import { useEffect, useState } from "react";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
}

export default function StartMenuPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  const [inviteCode, setInviteCode] = useState("");
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteReason, setInviteReason] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code") || params.get("invite") || localStorage.getItem("sejour_invite_code") || "";
    if (codeParam) {
      setInviteCode(codeParam.toUpperCase());
    }
    const errParam = params.get("error");
    if (errParam === "invite_required") {
      setError("New accounts require a valid invite code. Enter your invite code below first.");
    } else if (errParam) {
      setError(`Sign-in error: ${errParam.replace(/_/g, " ")}`);
    }

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.googleConfigured) setGoogleConfigured(true);
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function verifyCode(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setInviteValid(null);
      setInviteReason("");
      return;
    }
    try {
      const res = await fetch(`/api/invite/check?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setInviteValid(Boolean(data.valid));
      setInviteReason(data.reason || "");
      if (data.valid) {
        localStorage.setItem("sejour_invite_code", trimmed);
      }
    } catch {
      setInviteValid(null);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          inviteCode: inviteCode.trim().toUpperCase(),
          adminPassword: adminMode ? adminPassword : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not sign in.");
        setSubmitting(false);
        return;
      }
      if (inviteCode.trim()) {
        localStorage.setItem("sejour_invite_code", inviteCode.trim().toUpperCase());
      }
      window.location.href = "/home";
    } catch {
      setError("Network error while signing in.");
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    setUser(null);
  }

  return (
    <main className="min-h-dvh bg-[#f5efe2] text-[#231b12] px-4 py-10 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border-2 border-[#3c2d1e]/25 bg-[#fbf7ee] p-7 shadow-xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b5e34]">Saint-Aubin</p>
        <h1 className="mt-1 font-serif text-5xl font-bold tracking-tight text-[#231b12]">Le Séjour</h1>

        <p className="mt-4 text-[17px] leading-relaxed text-[#4a3b2a]">
          Four weeks with Madame Rousseau. One lesson, then the village.
        </p>

        {checking ? (
          <div className="mt-8 rounded-xl border border-[#3c2d1e]/15 bg-[#f3ead8] p-6 text-center text-sm text-[#5c4934]">
            Checking saved browser session…
          </div>
        ) : user ? (
          <div className="mt-8">
            <a
              href="/home"
              className="block w-full rounded-xl bg-[#231b12] px-5 py-4 text-center text-lg font-bold text-[#fbf7ee]"
            >
              Start
            </a>
            <button type="button" onClick={handleLogout} className="mt-4 text-sm font-semibold text-[#6e563a] underline">
              Not {user.name}? Sign out
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <details className="order-2 rounded-xl border border-[#3c2d1e]/15 bg-[#f4ecdc] p-4">
            <summary className="cursor-pointer text-sm font-semibold">New here?</summary>
            <div className="mt-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#5c4934]">
                1. Invite Code (required for new students)
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    setInviteValid(null);
                  }}
                  onBlur={() => verifyCode(inviteCode)}
                  placeholder="e.g. SEJOUR2026"
                  className="flex-1 rounded-lg border border-[#3c2d1e]/30 bg-white px-3.5 py-2 text-sm font-mono uppercase tracking-wider text-[#231b12]"
                />
                <button
                  type="button"
                  onClick={() => verifyCode(inviteCode)}
                  className="rounded-lg border border-[#3c2d1e]/30 bg-[#e6dac3] px-3.5 py-2 text-xs font-bold text-[#231b12] hover:bg-[#dccbb0]"
                >
                  Check Code
                </button>
              </div>
              {inviteValid === true && (
                <p className="mt-1.5 text-xs font-semibold text-emerald-800">
                  ✓ Invite code valid! You can now sign in with Google or Email below.
                </p>
              )}
              {inviteValid === false && (
                <p className="mt-1.5 text-xs font-semibold text-red-700">
                  ✕ {inviteReason || "Invalid invite code."}
                </p>
              )}
              <p className="mt-1.5 text-[12px] text-[#6e563a]">
                Returning on a new device? Leave the invite code blank if your email is already registered.
              </p>
            </div>

            {/* Step 2: Google OAuth */}
            <div className="space-y-2">
              <a
                href={`/api/auth/google?invite=${encodeURIComponent(inviteCode.trim().toUpperCase())}&next=/home`}
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[#3c2d1e]/30 bg-white px-4 py-3 text-[15px] font-bold text-[#231b12] shadow-sm hover:bg-[#f7f1e3] transition"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                Continue with Google
                {!googleConfigured && (
                  <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-900">
                    Set GOOGLE_CLIENT_ID in .env
                  </span>
                )}
              </a>
            </div>
            </details>

            {/* Step 3: Email + Invite Login */}
            <form onSubmit={handleSignIn} className="order-1 space-y-3">
              <label className="block text-sm font-semibold text-[#4a3b2a]" htmlFor="sejour-email">Email</label>
              <input
                id="sejour-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="testemail@email.com"
                className="mt-1 w-full rounded-xl border-2 border-[#3c2d1e]/30 bg-white px-4 py-3 text-base text-[#231b12]"
              />

              {adminMode && (
                <div>
                  <label className="block text-xs font-semibold text-amber-900">
                    Admin Password (matches ADMIN_PASSWORD in .env)
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Admin secret password"
                    className="mt-1 w-full rounded-lg border border-amber-700/40 bg-amber-50/60 px-3.5 py-2 text-sm text-[#231b12]"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-600/30 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#231b12] px-5 py-4 text-lg font-bold text-[#fbf7ee] hover:bg-[#3a2d1f] disabled:opacity-50 transition"
              >
                {submitting ? "Starting…" : "Start"}
              </button>
            </form>

            <div className="order-3 text-xs text-[#6e563a]">
              <button
                type="button"
                onClick={() => setAdminMode((v) => !v)}
                className="underline hover:text-[#231b12]"
              >
                {adminMode ? "Hide Admin Login" : "Admin / Instructor Login"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
