"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/I18nProvider";

export default function SignIn() {
  const router = useRouter();
  const a = useT().auth;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
    setBusy(false);
    if (r.ok) router.push("/");
    else setError(r.status === 429 ? a.tooMany : a.badCredentials);
  }
  return (
    <main className="page page--center">
      <h1>{a.signInTitle}</h1>
      <form className="form" onSubmit={submit}>
        <label htmlFor="email">{a.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">{a.password}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button className="btn btn--brass" type="submit" disabled={busy}>{a.submit}</button>
        {error && <p className="warn" role="alert">{error}</p>}
      </form>
      <p className="muted small">{a.signInNote} <Link href="/">{a.signInNoteLink}</Link>.</p>
    </main>
  );
}
