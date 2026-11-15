"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function InvitationForm() {
  const { token } = useParams<{ token: string }>();
  const email = useSearchParams().get("email") ?? "";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) return setError("Les deux mots de passe diffèrent.");
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth/sign-up/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password"), name: f.get("name"), invitationToken: token }) });
    setBusy(false);
    if (r.ok) router.push("/");
    else setError(r.status === 403 ? "Invitation invalide, expirée ou déjà utilisée (vérifiez l’email)." : r.status === 429 ? "Trop de tentatives." : "Création du compte impossible (mot de passe de 12 caractères minimum).");
  }
  return (
    <form className="form" onSubmit={submit}>
      <label htmlFor="email">Email (celui de l’invitation)</label>
      <input id="email" name="email" type="email" defaultValue={email} autoComplete="email" required />
      <label htmlFor="name">Nom affiché</label>
      <input id="name" name="name" required maxLength={60} />
      <label htmlFor="password">Mot de passe (12 caractères minimum)</label>
      <input id="password" name="password" type="password" minLength={12} autoComplete="new-password" required />
      <label htmlFor="password2">Confirmer le mot de passe</label>
      <input id="password2" name="password2" type="password" minLength={12} autoComplete="new-password" required />
      <button className="btn btn--brass" type="submit" disabled={busy}>Créer mon compte</button>
      {error && <p className="warn" role="alert">{error}</p>}
    </form>
  );
}

export default function InvitationPage() {
  return (
    <main className="page page--center">
      <h1>Invitation</h1>
      <Suspense>
        <InvitationForm />
      </Suspense>
    </main>
  );
}
