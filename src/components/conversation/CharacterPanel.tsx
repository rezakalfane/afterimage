"use client";
// Character panel. Name, role, era and the conversation state are permanent (a header row, never
// layered over the SDK video). The state comes from real events only (status, talk_state, mic).
// The portrait/video shrinks first when height is short; subtitles keep a fixed box; the history
// is a bounded drawer over the media area (the SDK mount is never unmounted).
import { useEffect, useRef, useState } from "react";
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const live = p.mode === "live";
  const liveUp = live && p.status === "live";
  // Only this era's character: never show the other character's lines after a switch.
  const lines = p.transcript.filter((l) => l.character === meta.character);
  const state = !live
    ? c.stateRehearsal
    : p.status === "connecting" ? c.stateConnecting
    : p.status === "closing" ? c.stateClosing
    : p.status === "error" ? c.stateError
    : liveUp ? (p.speaking ? fmt(c.stateSpeaking, { name: meta.name }) : p.micMuted ? c.stateMuted : c.stateListening)
    : c.stateIdle;
  const tone = liveUp ? (p.speaking ? "speaking" : "live") : p.status === "connecting" ? "busy" : !live ? "rehearsal" : "idle";
  const subtitle = (liveUp ? p.subtitle : lines.filter((l) => l.role === "assistant").at(-1)?.text) || "";

  return (
    <aside className={`character character--${meta.character}`} aria-label={`${meta.name}, ${meta.role}`}>
      <header className="character__head">
        <div className="character__id">
          <h2>{meta.name}</h2>
          <span>{meta.role}</span>
        </div>
        <span className={`state state--${tone}`} role="status">{state}{liveUp && !p.videoReady ? ` · ${c.stateAudio}` : ""}</span>
      </header>

      <div className="character__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`character__portrait${liveUp && p.videoReady ? " is-hidden" : ""}`} src={`${meta.portrait}-600.webp`} srcSet={`${meta.portrait}-600.webp 600w, ${meta.portrait}-1200.webp 1200w`} sizes="(max-width: 900px) 100vw, 36vw" alt={fmt(c.portraitAlt, { name: meta.name })} />
        <div className={`character__live${liveUp ? " is-on" : ""}`} ref={mountRef} />
        {historyOpen && <History lines={lines} name={meta.name} onClose={() => setHistoryOpen(false)} />}
      </div>

      <div className="character__subtitles" aria-live="polite" aria-label={c.subtitles}>
        {subtitle || <span className="muted">{live ? c.emptyLive : c.emptyRehearsal}</span>}
      </div>

      {p.suggestion && (
        <div className="suggestion">
          <span className="muted small">{c.suggestion}</span>
          <button type="button" className="btn btn--brass" onClick={p.suggestion.onAccept} disabled={p.disabled}>{p.suggestion.label}</button>
        </div>
      )}

      <div className="character__controls">
        {live && !liveUp && p.status !== "connecting" && p.status !== "closing" && (
          <button type="button" className="btn btn--brass" onClick={async () => ((await hasMicConsent()) ? p.onStart() : setPrepOpen(true))} disabled={p.disabled}>{fmt(c.talk, { name: meta.name })}</button>
        )}
        {live && p.status === "connecting" && <button type="button" className="btn" onClick={p.onStop}>{t.common.cancel}</button>}
        {liveUp && (
          <>
            <button type="button" className="btn" onClick={p.onToggleMic}>{p.micMuted ? c.micUnmute : c.micMute}</button>
            <button type="button" className="btn" onClick={p.onStop}>{c.hangUp}</button>
          </>
        )}
        <button type="button" className="btn btn--quiet character__history" aria-expanded={historyOpen} onClick={() => setHistoryOpen((o) => !o)}>
          {lines.length ? fmt(c.historyCount, { n: lines.length }) : c.history}
        </button>
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

      {p.error && <p className="warn character__error" role="alert">{p.error.message}</p>}

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
      <p className="disclosure">{c.disclosure}</p>
    </aside>
  );
}

/** Bounded history: internal scroll, follows new lines only while the reader is at the bottom. */
function History({ lines, name, onClose }: { lines: { role: "user" | "assistant"; text: string; at: number }[]; name: string; onClose: () => void }) {
  const c = useT().character;
  const box = useRef<HTMLOListElement>(null);
  const [atEnd, setAtEnd] = useState(true);
  const count = lines.length;
  useEffect(() => {
    const el = box.current;
    if (el && atEnd) el.scrollTop = el.scrollHeight;
  }, [count, atEnd]);
  return (
    <section className="history" aria-label={c.history}>
      <header className="history__head">
        <span className="eyebrow">{c.history}</span>
        <button type="button" className="btn btn--quiet" onClick={onClose}>{c.historyClose}</button>
      </header>
      <ol
        ref={box}
        className="history__list"
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
      >
        {count === 0 && <li className="muted">{c.historyEmpty}</li>}
        {lines.map((l, i) => (
          <li key={i} className={`t t--${l.role}`}>
            <span className="t__who">{l.role === "user" ? c.you : name}</span>
            <span className="t__text">{l.text}</span>
          </li>
        ))}
      </ol>
      {!atEnd && (
        <button type="button" className="btn history__latest" onClick={() => setAtEnd(true)}>{c.historyLatest}</button>
      )}
    </section>
  );
}
