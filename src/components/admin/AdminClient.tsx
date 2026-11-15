"use client";
// Sober admin surface (distinct from the game). No player messages, no secrets.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/game/api";

type Overview = {
  tenant: { name: string; slug: string; public: boolean; maxActiveSessions: number; status: string };
  you: { role: string };
  members: { userId: string; role: string; email: string; since: number }[];
  guests: number;
  invitations: { id: string; email: string; role: string; expiresAt: number }[];
  runs: { status: string; n: number }[];
  capacity: { mode: string; environmentMax: number; environmentOpen: number; tenantMax: number; tenantOpen: number };
  leases: { id: string; character: string; status: string; reason: string | null; createdAt: number; expiresAt: number }[];
  bonuses: { recordings: boolean; phone: boolean };
  release: { env: string; commit: string; schema: string };
};

const when = (t: number) => new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export function AdminClient() {
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setO(await api<Overview>("/api/admin/overview"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    api<Overview>("/api/admin/overview").then((x) => alive && setO(x)).catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    try {
      const r = await api<{ link: string }>("/api/admin/invitations", { method: "POST", body: { email: f.get("email"), role: f.get("role") } });
      setLink(r.link);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function act(path: string) {
    setError(null);
    try {
      await api(path, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!o) return <main className="admin"><p>{error ?? "Chargement…"}</p></main>;
  return (
    <main className="admin">
      <header className="admin__head">
        <h1>Administration · {o.tenant.name}</h1>
        <Link href="/">Retour au jeu</Link>
      </header>
      {error && <p className="warn" role="alert">{error}</p>}
      <section>
        <h2>Capacité de conversation</h2>
        <p>Mode : <strong>{o.capacity.mode === "live" ? "Napster en direct" : "répétition (sans Napster)"}</strong></p>
        <p>Environnement : {o.capacity.environmentOpen} / {o.capacity.environmentMax} conversations ouvertes · Espace : {o.capacity.tenantOpen} / {o.capacity.tenantMax}</p>
        <p>Bonus : cassette VHS {o.bonuses.recordings ? "activée" : "désactivée"} · téléphone {o.bonuses.phone ? "activé" : "désactivé"}</p>
        {o.leases.length > 0 && (
          <table className="admin__table">
            <thead><tr><th>Personnage</th><th>État</th><th>Ouverte</th><th>Expire</th><th /></tr></thead>
            <tbody>
              {o.leases.map((l) => (
                <tr key={l.id}><td>{l.character}</td><td>{l.status}{l.reason ? ` (${l.reason})` : ""}</td><td>{when(l.createdAt)}</td><td>{when(l.expiresAt)}</td>
                  <td><button type="button" className="btn" onClick={() => act(`/api/admin/leases/${l.id}`)}>Fermer</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Parties</h2>
        <p>{o.runs.map((r) => `${r.n} ${r.status === "active" ? "en cours" : r.status === "finished" ? "terminée(s)" : r.status}`).join(" · ") || "Aucune"} · {o.guests} invité(s)</p>
        <p className="muted small">Les états de partie et les messages personnels des joueurs ne sont pas consultables ici.</p>
      </section>
      <section>
        <h2>Membres</h2>
        <table className="admin__table">
          <thead><tr><th>Email</th><th>Rôle</th><th>Depuis</th><th /></tr></thead>
          <tbody>
            {o.members.map((m) => (
              <tr key={m.userId}><td>{m.email}</td><td>{m.role}</td><td>{when(m.since)}</td>
                <td>{o.you.role === "owner" && m.role !== "owner" && <button type="button" className="btn" onClick={() => act(`/api/admin/members/${m.userId}`)}>Retirer</button>}</td></tr>
            ))}
          </tbody>
        </table>
        <form className="admin__invite" onSubmit={invite}>
          <label htmlFor="inv-email">Inviter (email)</label>
          <input id="inv-email" name="email" type="email" required />
          <label htmlFor="inv-role">Rôle</label>
          <select id="inv-role" name="role" defaultValue="player">
            <option value="player">Joueur</option>
            {o.you.role === "owner" && <option value="admin">Admin</option>}
          </select>
          <button className="btn btn--brass" type="submit">Créer l’invitation</button>
        </form>
        {link && <p className="admin__link">Lien à usage unique (affiché une seule fois, valable 72 h) : <code>{link}</code></p>}
        {o.invitations.length > 0 && <p className="muted small">Invitations en attente : {o.invitations.map((i) => `${i.email} (${i.role})`).join(", ")}</p>}
      </section>
      <section>
        <h2>Version</h2>
        <p className="muted">Environnement {o.release.env} · commit {o.release.commit} · schéma {o.release.schema}</p>
      </section>
    </main>
  );
}
