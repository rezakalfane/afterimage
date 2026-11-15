"use client";
// Character panel. A static portrait is a FALLBACK, labelled as such; "En direct" is shown only
// when the live Napster session is actually up. Rehearsal mode is labelled everywhere.
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { ERA_META } from "@/components/game/scene-config";
import { useT } from "@/i18n/I18nProvider";
import { fmt } from "@/i18n/messages";
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

const CONSENT_KEY = "afterimage.micConsent";

/** Consent already given in this browser: our own flag, or the site's microphone permission. */
async function hasMicConsent(): Promise<boolean> {
  try {
    if (localStorage.getItem(CONSENT_KEY) === "1") return true;
  } catch {
    /* storage unavailable */
  }
  try {
    const s = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return s?.state === "granted";
  } catch {
    return false; // Permissions API without "microphone" (some browsers): ask once
  }
}

export function CharacterPanel({ mountRef, ...p }: PanelProps) {
  const t = useT();
  const c = t.character;
  const meta = { ...ERA_META[p.era], ...c[ERA_META[p.era].character] };
  const [text, setText] = useState("");
  const [prepOpen, setPrepOpen] = useState(false);
  const live = p.mode === "live";
  const liveUp = live && p.status === "live";
  const badge = !live ? c.badgeRehearsal : liveUp ? (p.videoReady ? c.badgeLive : c.badgeLiveAudio) : p.status === "connecting" ? c.badgeConnecting : p.status === "closing" ? c.badgeClosing : null; // offline: no badge (the "En direct" badge marks a live session)
  // Only this era's character: never show the other character's last line after a switch.
  const lastLines = p.transcript.filter((l) => l.character === meta.character).slice(-6);

  return (
    <aside className={`character character--${meta.character}`} aria-label={`${meta.name}, ${meta.role}`}>
      <div className="character__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`character__portrait${liveUp && p.videoReady ? " is-hidden" : ""}`} src={`${meta.portrait}-600.webp`} srcSet={`${meta.portrait}-600.webp 600w, ${meta.portrait}-1200.webp 1200w`} sizes="(max-width: 900px) 100vw, 36vw" alt={fmt(c.portraitAlt, { name: meta.name })} />
        <div className={`character__live${liveUp ? " is-on" : ""}`} ref={mountRef} />
        <div className="character__id">
          <h2>{meta.name}</h2>
          <span>{meta.role}</span>
        </div>
        {badge && <span className={`badge${liveUp ? " badge--live" : !live ? " badge--rehearsal" : ""}`} role="status">{badge}</span>}
      </div>

      <div className="character__subtitles" aria-live="polite" aria-label={c.subtitles}>
        {(liveUp ? p.subtitle : lastLines.filter((l) => l.role === "assistant").at(-1)?.text) || <span className="muted">{live ? c.emptyLive : c.emptyRehearsal}</span>}
        {p.speaking && <span className="speaking" aria-hidden="true">●</span>}
      </div>

      {p.suggestion && (
        <div className="suggestion">
          <span className="muted small">{c.suggestion}</span>
          <button type="button" className="btn btn--brass" onClick={p.suggestion.onAccept} disabled={p.disabled}>{p.suggestion.label}</button>
        </div>
      )}

      <div className="character__controls">
        {live && !liveUp && p.status !== "connecting" && (
          <button type="button" className="btn btn--brass" onClick={async () => ((await hasMicConsent()) ? p.onStart() : setPrepOpen(true))} disabled={p.disabled}>{fmt(c.talk, { name: meta.name })}</button>
        )}
        {live && p.status === "connecting" && <button type="button" className="btn" onClick={p.onStop}>{t.common.cancel}</button>}
        {liveUp && (
          <>
            <button type="button" className="btn" aria-pressed={p.micMuted} onClick={p.onToggleMic}>{p.micMuted ? c.micOff : c.micOn}</button>
            <button type="button" className="btn" onClick={p.onStop}>{c.hangUp}</button>
          </>
        )}
      </div>

      <Dialog open={prepOpen && !liveUp} title={c.prepLabel} onClose={() => setPrepOpen(false)}>
        <p><strong>{fmt(c.prepStrong, { name: meta.name })}</strong> {c.prepText}</p>
        <p className="muted small">{c.prepOnce}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--brass"
            onClick={() => {
              try {
                localStorage.setItem(CONSENT_KEY, "1");
              } catch {
                /* storage unavailable: we will ask again next time */
              }
              setPrepOpen(false);
              p.onStart();
            }}
          >
            {c.prepAllow}
          </button>
          <button type="button" className="btn" onClick={() => setPrepOpen(false)}>{c.prepNoMic}</button>
        </div>
      </Dialog>

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
        <label htmlFor="say" className="sr-only">{fmt(c.writeTo, { name: meta.name })}</label>
        <input id="say" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder={live && !liveUp ? fmt(c.writeWhenLive, { name: meta.name }) : fmt(c.writeToEllipsis, { name: meta.name })} disabled={(live && !liveUp) || p.disabled} autoComplete="off" />
        <button type="submit" className="btn" disabled={(live && !liveUp) || p.disabled}>{c.send}</button>
      </form>

      {lastLines.length > 0 && (
        <details className="transcript">
          <summary>{c.lastExchanges}</summary>
          <ol>{lastLines.map((l, i) => <li key={i} className={`t t--${l.role}`}><span className="sr-only">{l.role === "user" ? c.you : meta.name} :</span>{l.text}</li>)}</ol>
        </details>
      )}
      <p className="disclosure">{c.disclosure}</p>
    </aside>
  );
}
