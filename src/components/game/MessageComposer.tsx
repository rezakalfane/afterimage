"use client";
// The personal message: draft (stored by the server, normalized NFC + trimmed, shown back exactly),
// then explicit confirmation of THOSE exact words. Rendered as text by React, never as HTML.
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { Action, PublicState } from "./types";

const MAX = 240;

export function MessageComposer({ open, onClose, view, act }: { open: boolean; onClose: () => void; view: PublicState; act: (a: Action, args?: Record<string, unknown>) => Promise<unknown> }) {
  const [text, setText] = useState(view.message.draft ?? "Les étoiles restent allumées.");
  const length = Array.from(text.normalize("NFC").trim()).length;
  const draft = view.message.draft;
  const confirmed = view.message.confirmed;
  const sealed = view.message.sealed;
  const canWrite = view.availableActions.includes("write_message");

  return (
    <Dialog open={open} title="Vos mots, pour dans trente ans" onClose={onClose}>
      {sealed ? (
        <p>Le message est scellé avec le film. Pour d’autres mots, commencez une nouvelle partie.</p>
      ) : !canWrite ? (
        <p>Avant de laisser des mots avec le film, lisez ce qu’Alice a écrit.</p>
      ) : (
        <>
          <form
            className="compose"
            onSubmit={(e) => {
              e.preventDefault();
              void act("write_message", { text });
            }}
          >
            <label htmlFor="msg">Écrivez ou dictez à Jeanne une phrase de 1 à {MAX} caractères.</label>
            <textarea id="msg" value={text} maxLength={MAX * 2} rows={3} onChange={(e) => setText(e.target.value)} aria-describedby="msg-count" />
            <p id="msg-count" className={`muted${length > MAX ? " warn" : ""}`}>{length} / {MAX}</p>
            <button type="submit" className="btn btn--brass" disabled={length < 1 || length > MAX}>Enregistrer ce brouillon</button>
          </form>
          {draft && (
            <figure className="paper">
              <figcaption>Brouillon conservé par le jeu (exactement ces mots)</figcaption>
              <p className="paper__text">{draft}</p>
              {confirmed === draft ? (
                <p className="ok" role="status">Confirmé, mot pour mot. Vous pouvez demander à Jeanne de tout ranger.</p>
              ) : (
                <button type="button" className="btn btn--decision" onClick={() => act("confirm_message", { text: draft })}>
                  Je confirme ces mots exacts
                </button>
              )}
            </figure>
          )}
          <p className="muted small">Toute modification annule la confirmation, tant que le film n’est pas rangé.</p>
        </>
      )}
    </Dialog>
  );
}
