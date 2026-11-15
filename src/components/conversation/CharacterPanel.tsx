"use client";
// Character panel. A static portrait is a FALLBACK, labelled as such; "En direct" is shown only
// when the live Napster session is actually up. Rehearsal mode is labelled everywhere.
import { useState } from "react";
import { ERA_META } from "@/components/game/scene-config";
import type { Era, Mode } from "@/components/game/types";
import type { LiveStatus, TranscriptLine } from "./useLiveConversation";

export interface PanelProps {
  era: Era;
  mode: Mode;
  status: LiveStatus;
  videoReady: boolean;
  speaking: boolean;
  subtitle: string;
  transcript: TranscriptLine[];
  error: { code: string; message: string } | null;
  mountRef: React.RefObject<HTMLDivElement | null>;
  onStart: () => void;
  onStop: () => void;
  onSend: (text: string) => void;
  suggestion: { label: string; onAccept: () => void } | null;
  micMuted: boolean;
  onToggleMic: () => void;
  disabled: boolean;
}

export function CharacterPanel({ mountRef, ...p }: PanelProps) {
  const meta = ERA_META[p.era];
  const [text, setText] = useState("");
  const [prepOpen, setPrepOpen] = useState(false);
  const live = p.mode === "live";
  const liveUp = live && p.status === "live";
  const badge = !live ? "Mode répétition · personnage simulé, sans connexion Napster" : liveUp ? (p.videoReady ? "En direct" : "En direct · audio") : p.status === "connecting" ? "Connexion…" : p.status === "closing" ? "Fermeture…" : "Portrait de référence · hors ligne";
  const lastLines = p.transcript.slice(-6);

  return (
    <aside className={`character character--${meta.character}`} aria-label={`${meta.name}, ${meta.role}`}>
      <div className="character__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`character__portrait${liveUp && p.videoReady ? " is-hidden" : ""}`} src={`${meta.portrait}-600.webp`} srcSet={`${meta.portrait}-600.webp 600w, ${meta.portrait}-1200.webp 1200w`} sizes="(max-width: 900px) 100vw, 36vw" alt={`Portrait de référence de ${meta.name}, personnage fictif`} />
        <div className={`character__live${liveUp ? " is-on" : ""}`} ref={mountRef} />
        <div className="character__id">
          <h2>{meta.name}</h2>
          <span>{meta.role}</span>
        </div>
        <span className={`badge${liveUp ? " badge--live" : !live ? " badge--rehearsal" : ""}`} role="status">{badge}</span>
      </div>

      <div className="character__subtitles" aria-live="polite" aria-label="Sous-titres">
        {(liveUp ? p.subtitle : lastLines.filter((l) => l.role === "assistant").at(-1)?.text) || <span className="muted">{live ? "Parlez au personnage ou écrivez-lui." : "Écrivez au personnage, ou examinez le décor."}</span>}
        {p.speaking && <span className="speaking" aria-hidden="true">●</span>}
      </div>

      {p.suggestion && (
        <div className="suggestion">
          <span className="muted small">Proposition (mode répétition) :</span>
          <button type="button" className="btn btn--brass" onClick={p.suggestion.onAccept} disabled={p.disabled}>{p.suggestion.label}</button>
        </div>
      )}

      <div className="character__controls">
        {live && !liveUp && p.status !== "connecting" && (
          <button type="button" className="btn btn--brass" onClick={() => setPrepOpen(true)} disabled={p.disabled}>Parler à {meta.name}</button>
        )}
        {live && p.status === "connecting" && <button type="button" className="btn" onClick={p.onStop}>Annuler</button>}
        {liveUp && (
          <>
            <button type="button" className="btn" aria-pressed={p.micMuted} onClick={p.onToggleMic}>{p.micMuted ? "Micro coupé" : "Micro ouvert"}</button>
            <button type="button" className="btn" onClick={p.onStop}>Raccrocher</button>
          </>
        )}
      </div>

      {prepOpen && !liveUp && (
        <div className="prep" role="dialog" aria-label="Préparation audio">
          <p><strong>Le micro sert uniquement à parler à {meta.name}.</strong> Le jeu n’enregistre ni votre voix ni votre caméra. La conversation passe par Napster, en direct.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--brass" onClick={() => { setPrepOpen(false); p.onStart(); }}>Autoriser le micro et parler</button>
            <button type="button" className="btn" onClick={() => setPrepOpen(false)}>Jouer au clavier</button>
          </div>
        </div>
      )}

      {p.error && <p className="warn" role="alert">{p.error.message}</p>}

      <form
        className="say"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          p.onSend(text);
          setText("");
        }}
      >
        <label htmlFor="say" className="sr-only">Écrire à {meta.name}</label>
        <input id="say" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={live && !liveUp ? `Lancez la conversation pour écrire à ${meta.name}` : `Écrire à ${meta.name}…`} disabled={(live && !liveUp) || p.disabled} autoComplete="off" />
        <button type="submit" className="btn" disabled={(live && !liveUp) || p.disabled}>Envoyer</button>
      </form>

      {lastLines.length > 0 && (
        <details className="transcript">
          <summary>Derniers échanges</summary>
          <ol>{lastLines.map((l, i) => <li key={i} className={`t t--${l.role}`}><span className="sr-only">{l.role === "user" ? "Vous" : meta.name} :</span>{l.text}</li>)}</ol>
        </details>
      )}
      <p className="disclosure">Personnages fictifs animés par IA.</p>
    </aside>
  );
}
