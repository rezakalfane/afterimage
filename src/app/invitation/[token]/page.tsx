"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useT } from "@/i18n/I18nProvider";

function InvitationForm() {
  const { token } = useParams<{ token: string }>();
  const email = useSearchParams().get("email") ?? "";
  const router = useRouter();
  const a = useT().auth;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) return setError(a.inviteMismatch);
    setBusy(true);
    setError(null);
    const r = await fetch("/api/auth/sign-up/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password"), name: f.get("name"), invitationToken: token }) });
    setBusy(false);
    if (r.ok) router.push("/");
    else setError(r.status === 403 ? a.inviteInvalid : r.status === 429 ? a.inviteTooMany : a.inviteFailed);
  }
  return (
    <form className="form" onSubmit={submit}>
      <label htmlFor="email">{a.inviteEmail}</label>
      <input id="email" name="email" type="email" defaultValue={email} autoComplete="email" required />
      <label htmlFor="name">{a.inviteName}</label>
      <input id="name" name="name" required maxLength={60} />
      <label htmlFor="password">{a.invitePassword}</label>
      <input id="password" name="password" type="password" minLength={12} autoComplete="new-password" required />
      <label htmlFor="password2">{a.invitePassword2}</label>
      <input id="password2" name="password2" type="password" minLength={12} autoComplete="new-password" required />
      <button className="btn btn--brass" type="submit" disabled={busy}>{a.inviteSubmit}</button>
      {error && <p className="warn" role="alert">{error}</p>}
    </form>
  );
}

export default function InvitationPage() {
  const a = useT().auth;
  return (
    <main className="page page--center">
      <h1>{a.inviteTitle}</h1>
      <Suspense>
        <InvitationForm />
      </Suspense>
    </main>
  );
}
