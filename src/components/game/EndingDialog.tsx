"use client";
// Final choice, UI only: pick → server intent (single-use token) → explicit confirmation → server decision.
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useT } from "@/i18n/I18nProvider";
import { api, commandId } from "./api";
import type { CommandResponse, PublicState } from "./types";

export function EndingDialog({ open, onClose, runId, view, onDone }: { open: boolean; onClose: () => void; runId: string; view: PublicState; onDone: (r: CommandResponse) => void }) {
  const t = useT().ending;
  const [intent, setIntent] = useState<{ token: string; ending: { id: string; label: string; consequence: string; confirmation: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function choose(id: string) {
    setError(null);
    setBusy(true);
    try {
      setIntent(await api(`/api/runs/${runId}/ending-intent`, { method: "POST", body: { ending: id, expectedRevision: view.revision } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!intent) return;
    setBusy(true);
    try {
      const r = await api<CommandResponse>(`/api/runs/${runId}/ending`, { method: "POST", body: { token: intent.token, commandId: commandId() } });
      if (r.ok) onDone(r);
      else setError(r.message ?? t.failed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} title={t.title} onClose={() => { setIntent(null); onClose(); }} wide>
      {!intent ? (
        <>
          <p>{t.intro}</p>
          <ul className="endings">
            {view.endings.map((e) => (
              <li key={e.id}>
                <button type="button" className={`ending${e.id === "broken_promise" ? " ending--warn" : ""}`} disabled={busy} onClick={() => choose(e.id)}>
                  <span className="ending__label">{e.label}</span>
                  <span className="ending__consequence">{e.consequence}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="ending__label">{intent.ending.label}</p>
          <p>{intent.ending.consequence}</p>
          <div className="btn-row">
            <button type="button" className={`btn ${intent.ending.id === "broken_promise" ? "btn--decision" : "btn--brass"}`} disabled={busy} onClick={confirm}>{intent.ending.confirmation}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => setIntent(null)}>{t.back}</button>
          </div>
        </>
      )}
      {error && <p className="warn" role="alert">{error}</p>}
    </Dialog>
  );
}
