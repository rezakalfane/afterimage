"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignIn() {
  const router = useRouter();
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
    else setError(r.status === 429 ? "Trop de tentatives. Réessayez dans quelques minutes." : "Email ou mot de passe incorrect.");
  }
  return (
    <main className="page page--center">
      <h1>Se connecter</h1>
      <form className="form" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button className="btn btn--brass" type="submit" disabled={busy}>Se connecter</button>
        {error && <p className="warn" role="alert">{error}</p>}
      </form>
      <p className="muted small">Les comptes sont créés sur invitation. Pour jouer sans compte : <Link href="/">accueil → Commencer</Link>.</p>
    </main>
  );
}
