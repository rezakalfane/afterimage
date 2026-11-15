"use client";
// The personal message: draft (stored by the server, normalized NFC + trimmed, shown back exactly),
// then explicit confirmation of THOSE exact words. Rendered as text by React, never as HTML.
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useT } from "@/i18n/I18nProvider";
import { fmt } from "@/i18n/messages";
import type { Action, PublicState } from "./types";

const MAX = 240;

export function MessageComposer({ open, onClose, view, act }: { open: boolean; onClose: () => void; view: PublicState; act: (a: Action, args?: Record<string, unknown>) => Promise<unknown> }) {
  const t = useT().composer;
  const [text, setText] = useState(view.message.draft ?? t.defaultText);
  const length = Array.from(text.normalize("NFC").trim()).length;
  const draft = view.message.draft;
  const confirmed = view.message.confirmed;
  const sealed = view.message.sealed;
  const canWrite = view.availableActions.includes("write_message");

  return (
    <Dialog open={open} title={t.title} onClose={onClose}>
      {sealed ? (
        <p>{t.sealed}</p>
      ) : !canWrite ? (
        <p>{t.needLetter}</p>
      ) : (
        <>
          <form
            className="compose"
            onSubmit={(e) => {
              e.preventDefault();
              void act("write_message", { text });
            }}
          >
            <label htmlFor="msg">{fmt(t.label, { max: MAX })}</label>
            <textarea id="msg" value={text} maxLength={MAX * 2} rows={3} onChange={(e) => setText(e.target.value)} aria-describedby="msg-count" />
            <p id="msg-count" className={`muted${length > MAX ? " warn" : ""}`}>{length} / {MAX}</p>
            <button type="submit" className="btn btn--brass" disabled={length < 1 || length > MAX}>{t.save}</button>
          </form>
          {draft && (
            <figure className="paper">
              <figcaption>{t.draftCaption}</figcaption>
              <p className="paper__text">{draft}</p>
              {confirmed === draft ? (
                <p className="ok" role="status">{t.confirmed}</p>
              ) : (
                <button type="button" className="btn btn--decision" onClick={() => act("confirm_message", { text: draft })}>
                  {t.confirm}
                </button>
              )}
            </figure>
          )}
          <p className="muted small">{t.note}</p>
        </>
      )}
    </Dialog>
  );
}
