"use client";
// The personal message, the signature moment: one sheet of paper.
//   write  → "Relire mon message" stores the draft on the server (NFC + trim) and shows back
//            EXACTLY the server's text;
//   review → "Confier ces mots à Jeanne" confirms THOSE words (server checks text = draft);
//            "Modifier" goes back to writing (a new draft cancels the confirmation server-side);
//   kept   → short acknowledgement, only after the server confirmed.
// The step is derived from server state (the component is re-keyed on the draft), never assumed.
// Rendered as React text, never as HTML.
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useT } from "@/i18n/I18nProvider";
import { fmt } from "@/i18n/messages";
import type { Action, PublicState } from "./types";

const MAX = 240;
type Act = (a: Action, args?: Record<string, unknown>) => Promise<unknown>;

export function MessageComposer({ open, onClose, view, act }: { open: boolean; onClose: () => void; view: PublicState; act: Act }) {
  const all = useT();
  const t = all.composer;
  const draft = view.message.draft;
  const confirmed = view.message.confirmed;
  const sealed = view.message.sealed;
  const canWrite = view.availableActions.includes("write_message");
  const [editing, setEditing] = useState(!draft);
  const [text, setText] = useState(draft ?? t.defaultText);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const length = Array.from(text.normalize("NFC").trim()).length;
  const ok = (r: unknown) => Boolean(r && typeof r === "object" && (r as { ok?: boolean }).ok);

  async function review() {
    setBusy(true);
    setFailed(false);
    const r = await act("write_message", { text });
    setBusy(false);
    if (ok(r)) setEditing(false); // the server's normalized text is shown next (re-key on draft)
    else setFailed(true); // keep what the player wrote
  }
  async function entrust() {
    if (!draft) return;
    setBusy(true);
    await act("confirm_message", { text: draft });
    setBusy(false);
  }

  const step = sealed ? "sealed" : !canWrite ? "locked" : editing || !draft ? "write" : confirmed === draft ? "kept" : "review";

  return (
    <Dialog open={open} title={t.title} onClose={onClose}>
      {step === "locked" && <p>{t.needLetter}</p>}
      {step === "write" && (
        <form
          className="sheet"
          onSubmit={(e) => {
            e.preventDefault();
            void review();
          }}
        >
          <label htmlFor="msg" className="sheet__label">{fmt(t.label, { max: MAX })}</label>
          <textarea id="msg" className="sheet__input" value={text} maxLength={MAX * 2} rows={4} onChange={(e) => setText(e.target.value)} aria-describedby="msg-count" />
          <p id="msg-count" className={`sheet__count${length > MAX ? " warn" : ""}`}>{length} / {MAX}</p>
          {failed && <p className="warn" role="alert">{t.saveFailed}</p>}
          <div className="btn-row">
            <button type="submit" className="btn btn--brass" disabled={busy || length < 1 || length > MAX}>{t.save}</button>
            {draft && <button type="button" className="btn" onClick={() => setEditing(false)} disabled={busy}>{all.common.cancel}</button>}
          </div>
        </form>
      )}
      {(step === "review" || step === "kept" || step === "sealed") && draft && (
        <figure className="sheet sheet--paper">
          <figcaption className="sheet__label">{t.draftCaption}</figcaption>
          <p className="paper__text">{draft}</p>
        </figure>
      )}
      {step === "review" && (
        <>
          <p className="muted">{t.review}</p>
          <div className="btn-row">
            <button type="button" className="btn btn--brass" onClick={entrust} disabled={busy}>{t.confirm}</button>
            <button type="button" className="btn" onClick={() => { setText(draft ?? ""); setEditing(true); }} disabled={busy}>{t.edit}</button>
          </div>
        </>
      )}
      {step === "kept" && (
        <>
          <p className="ok" role="status">{t.confirmed}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => { setText(draft ?? ""); setEditing(true); }}>{t.edit}</button>
          </div>
        </>
      )}
      {step === "sealed" && <p>{t.sealed}</p>}
      {(step === "write" || step === "review") && <p className="muted small">{t.note}</p>}
    </Dialog>
  );
}
