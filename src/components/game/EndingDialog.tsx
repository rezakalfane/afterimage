"use client";
// Final choice, UI only: pick → server intent (single-use token) → explicit confirmation → server decision.
import { useEffect, useState, type MutableRefObject } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useT } from "@/i18n/I18nProvider";
import { api, commandId } from "./api";
import type { CommandResponse, PublicState } from "./types";

export function EndingDialog({ open, onClose, runId, view, onDone, confirmRef, chooseRef, onSelection }: { open: boolean; onClose: () => void; runId: string; view: PublicState; onDone: (r: CommandResponse) => void | Promise<void>; confirmRef?: MutableRefObject<(() => void) | null>; chooseRef?: MutableRefObject<((id: string) => void) | null>; onSelection?: (id: string | null) => void }) {
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
      if (r.ok) await onDone(r);
      else setError(r.message ?? t.failed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Voice: the player may name an ending, then confirm it out loud (same calls as the buttons).
  useEffect(() => {
    if (confirmRef) confirmRef.current = open && intent && !busy ? () => void confirm() : null;
    if (chooseRef) chooseRef.current = open && !intent && !busy ? (id: string) => void choose(id) : null;
  });
  // The selection on screen (for the voice confirmation target); cleared when closed.
  const selected = open && intent ? intent.ending.id : null;
  useEffect(() => {
    onSelection?.(selected);
  }, [selected, onSelection]);

  return (
    <Dialog open={open} title={t.title} onClose={() => { setIntent(null); onClose(); }} wide>
      {!intent ? (
        <>
          <p>{t.intro}</p>
          <p className="muted small">{t.voiceHint}</p>
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
          <p className="muted small">{t.voiceConfirm}</p>
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
