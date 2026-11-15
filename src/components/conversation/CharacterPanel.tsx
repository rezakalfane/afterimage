"use client";
// Character panel. Name, role, era and the conversation state are permanent (a header row, never
// layered over the SDK video). The state comes from real events only (status, talk_state, mic).
// The portrait/video shrinks first when height is short; subtitles keep a fixed box; the history
// is a bounded drawer over the media area (the SDK mount is never unmounted).
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
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
  const [expanded, setExpanded] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const drawerId = useId();
  const { ref: tileRef, pos: tilePos, style: tileStyle, onPointerDown: onGripDown, onKeyDown: onGripKey } = useDraggableTile();
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
    <aside ref={tileRef} className={`character character--${meta.character}${expanded ? " is-expanded" : ""}${tilePos ? " is-placed" : ""}${tilePos && tilePos.x > 0.5 ? " is-right" : ""}`} style={tileStyle} aria-label={`${meta.name}, ${meta.role}`}>
      <div className="character__tile" onPointerDown={onGripDown}>
        <header className="character__head">
          <span className={`dot dot--${tone}`} aria-hidden="true" title={state} />
          <div className="character__id">
            <h2 data-era={p.era}>{meta.name}</h2>
            <span>{meta.role}</span>
          </div>
          <span className={`state state--${tone}`} role="status">{state}{liveUp && !p.videoReady ? ` · ${c.stateAudio}` : ""}</span>
          <button type="button" className="tile__icon tile__grip" aria-label={c.move} title={c.move} onKeyDown={onGripKey}>
            <Icon name="grip" size={18} />
          </button>
          <button type="button" className="tile__icon" aria-pressed={expanded} aria-label={expanded ? c.collapse : c.expand} title={expanded ? c.collapse : c.expand} onClick={() => setExpanded((x) => !x)}>
            <Icon name={expanded ? "collapse" : "expand"} size={16} />
          </button>
        </header>

        <div className="character__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`character__portrait${liveUp && p.videoReady ? " is-hidden" : ""}`} src={`${meta.portrait}-600.webp`} srcSet={`${meta.portrait}-600.webp 600w, ${meta.portrait}-1200.webp 1200w`} sizes="(max-width: 900px) 100vw, 30vw" alt={fmt(c.portraitAlt, { name: meta.name })} />
          <div className={`character__live${liveUp ? " is-on" : ""}`} ref={mountRef} />
        </div>

        <div className="character__bar">
          {live && !liveUp && p.status !== "connecting" && p.status !== "closing" && (
            <button type="button" className="btn btn--brass character__talk" onClick={async () => ((await hasMicConsent()) ? p.onStart() : setPrepOpen(true))} disabled={p.disabled}>{fmt(c.talk, { name: meta.name })}</button>
          )}
          {live && p.status === "connecting" && <button type="button" className="btn character__talk" onClick={p.onStop}>{t.common.cancel}</button>}
          {liveUp && (
            <button type="button" className={`barbtn${p.micMuted ? " is-off" : ""}`} onClick={p.onToggleMic} aria-label={p.micMuted ? c.micUnmute : c.micMute} title={p.micMuted ? c.micUnmute : c.micMute}>
              <Icon name={p.micMuted ? "micOff" : "mic"} size={20} /><span className="sr-only">{p.micMuted ? c.micShortOff : c.micShort}</span>
            </button>
          )}
          {(liveUp || !live) && (
            <button type="button" className="barbtn" aria-expanded={writeOpen} aria-controls={drawerId} onClick={() => setWriteOpen((o) => !o)} aria-label={fmt(c.writeTo, { name: meta.name })} title={fmt(c.writeTo, { name: meta.name })}>
              <Icon name="keyboard" size={20} /><span className="barbtn__label">{c.writeShort}</span>
            </button>
          )}
          {liveUp && (
            <button type="button" className="barbtn barbtn--end" onClick={p.onStop} aria-label={c.hangUp} title={c.hangUp}>
              <Icon name="end" size={20} /><span className="sr-only">{c.endShort}</span>
            </button>
          )}
        </div>
        {p.error && <p className="warn character__error" role="alert">{p.error.message}</p>}
        <p className="disclosure">{c.disclosure}</p>
      </div>

      <div className={`character__subtitles${subtitle ? "" : " is-empty"}`} aria-live="polite" aria-label={c.subtitles}>
        {subtitle ? <span className="subtitle__line">{subtitle}</span> : <span className="muted">{live ? c.emptyLive : c.emptyRehearsal}</span>}
      </div>

      <div id={drawerId} className="character__drawer" hidden={!writeOpen}>
        {p.suggestion && (
          <div className="suggestion">
            <span className="muted small">{c.suggestion}</span>
            <button type="button" className="btn btn--brass" onClick={p.suggestion.onAccept} disabled={p.disabled}>{p.suggestion.label}</button>
          </div>
        )}
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
        <button type="button" className="btn btn--quiet character__history" aria-expanded={historyOpen} onClick={() => setHistoryOpen((o) => !o)}>
          {lines.length ? fmt(c.historyCount, { n: lines.length }) : c.history}
        </button>
        {historyOpen && <History lines={lines} name={meta.name} onClose={() => setHistoryOpen(false)} />}
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

const POS_KEY = "afterimage.pip";
type Pos = { x: number; y: number };

/** Free placement of the PiP tile (full-window layout only; CSS ignores it elsewhere). The position
 *  is a fraction of the window, clamped on screen, remembered per browser. Pointer drag on the
 *  grip, or arrow keys on it (Shift = bigger steps). */
function useDraggableTile() {
  const ref = useRef<HTMLElement | null>(null);
  // Read the saved position after mount only (the server has no storage: avoids a hydration mismatch).
  const [pos, setPos] = useState<Pos | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after hydration
      if (v && typeof v.x === "number" && typeof v.y === "number") setPos(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const clamp = (p: Pos): Pos => {
    const el = ref.current;
    const w = el ? el.offsetWidth / window.innerWidth : 0.2;
    const h = el ? el.offsetHeight / window.innerHeight : 0.3;
    return { x: Math.min(Math.max(0.01, p.x), 0.99 - w), y: Math.min(Math.max(0.1, p.y), 0.99 - h) };
  };
  const save = (p: Pos) => {
    const c = clamp(p);
    setPos(c);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(c));
    } catch {
      /* storage unavailable */
    }
  };
  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    // The whole tile is a handle, except its controls.
    if ((e.target as HTMLElement).closest("button:not(.tile__grip), input, a, textarea, select")) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const move = (ev: PointerEvent) => save({ x: (ev.clientX - dx) / window.innerWidth, y: (ev.clientY - dy) / window.innerHeight });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.08 : 0.02;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cur = pos ?? { x: r.left / window.innerWidth, y: r.top / window.innerHeight };
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!d[e.key]) return;
    e.preventDefault();
    save({ x: cur.x + d[e.key][0], y: cur.y + d[e.key][1] });
  };
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
  const style = pos ? ({ ["--pip-x" as string]: `${(pos.x * 100).toFixed(2)}vw`, ["--pip-y" as string]: `${(pos.y * 100).toFixed(2)}vh` } as React.CSSProperties) : undefined;
  return { ref, pos, style, onPointerDown, onKeyDown };
}
