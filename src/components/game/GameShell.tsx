"use client";
// The game screen. Server state is the only truth: every change is a command whose response
// replaces the local view. Same rules for buttons, keyboard and live tool calls.
import "@touchcastllc/napster-companion-api/styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterPanel } from "@/components/conversation/CharacterPanel";
import { useLiveConversation, type TranscriptLine } from "@/components/conversation/useLiveConversation";
import { useT } from "@/i18n/I18nProvider";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { fmt } from "@/i18n/messages";
import { api, ApiError, commandId } from "./api";
import { EndingDialog } from "./EndingDialog";
import { MessageComposer } from "./MessageComposer";
import { Notebook } from "./Notebook";
import { ObjectInspector } from "./ObjectInspector";
import { SceneViewport } from "./SceneViewport";
import type { Action, CommandResponse, Era, Mode, PublicState } from "./types";

const HOTSPOT_TO_INSPECT: Record<string, string> = { photo: "photo", waterline: "archiveReport", projector: "projector", cabinet: "cabinet", cache: "cache", programme: "programme", hall: "hall", letter: "letter", shelf: "shelf" };

/** Notebook documents that open automatically when a character reveals them during a live talk. */
const AUTO_OPEN = new Set(["photo", "archiveReport", "programme", "letter", "message", "futureLetter"]);

export function GameShell({ runId, mode, initial }: { runId: string; mode: Mode; initial: PublicState }) {
  const router = useRouter();
  const t = useT();
  const g = t.game;
  const [view, setView] = useState<PublicState>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "info" | "warn" } | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [endingOpen, setEndingOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [switching, setSwitching] = useState<Era | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);
  const [rLines, setRLines] = useState<TranscriptLine[]>([]);
  const [suggestion, setSuggestion] = useState<{ action: Action; args?: Record<string, unknown>; label: string } | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const refresh = useCallback(async () => {
    const r = await api<{ publicState: PublicState }>(`/api/runs/${runId}`);
    setView(r.publicState);
  }, [runId]);

  const { mountRef: liveMountRef, ...live } = useLiveConversation({
    runId,
    onPublicState: (s) => {
      if (!s) return void refresh(); // uncertain tool outcome: reload the canonical state
      const next = s as PublicState;
      // A document the character just read by voice opens on its own (unless something is open).
      const before = new Set(viewRef.current.notebook.map((n) => n.id));
      const revealed = next.notebook.find((n) => !before.has(n.id) && AUTO_OPEN.has(n.id));
      setView(next);
      if (revealed) setInspect((cur) => cur ?? revealed.id);
    },
  });

  const say = useCallback((text: string, tone: "info" | "warn" = "info") => {
    setToast({ text, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(
    async (action: Action, args?: Record<string, unknown>) => {
      setBusy(true);
      try {
        const r = await api<CommandResponse>(`/api/runs/${runId}/commands`, {
          method: "POST",
          body: { commandId: commandId(), expectedRevision: viewRef.current.revision, action, ...(args ? { args } : {}) },
        });
        setView(r.publicState);
        if (!r.ok) {
          say(r.message ?? g.actionImpossible, "warn");
          return r;
        }
        if (r.hint) setHint(r.hint);
        if (r.changed && r.event && action !== "switch_era" && action !== "request_hint") {
          say(r.event.summary);
          setPulse(action);
          setTimeout(() => setPulse(null), 900);
        }
        if (r.reaction && mode === "rehearsal") setRLines((l) => [...l, { role: "assistant", text: r.reaction!, at: Date.now(), character: r.publicState.activeEra === 1996 ? "jeanne" : "malik" }]);
        if (r.contextText && live.status === "live") live.pushContext(r.contextText, true);
        return r;
      } catch (e) {
        const err = e as ApiError;
        if (err.code === "REVISION_CONFLICT" && err.body?.publicState) {
          setView(err.body.publicState as PublicState);
          say(g.conflict, "warn");
        } else if (err.code === "RUN_FINISHED") {
          await refresh();
        } else say(err.message || t.common.serverDown, "warn");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [runId, mode, live, refresh, say, g, t],
  );

  // Rehearsal conversation (server-side deterministic replies, never mutating).
  const rehearse = useCallback(
    async (text: string | null) => {
      if (text) setRLines((l) => [...l, { role: "user", text, at: Date.now(), character: viewRef.current.activeEra === 1996 ? "jeanne" : "malik" }]);
      try {
        const r = await api<{ text: string; character: "jeanne" | "malik"; suggestion: typeof suggestion; openComposer?: boolean }>(`/api/runs/${runId}/rehearsal`, { method: "POST", body: { text } });
        setRLines((l) => [...l, { role: "assistant", text: r.text, at: Date.now(), character: r.character }]);
        setSuggestion(r.suggestion);
        if (r.openComposer) setComposer(true);
      } catch {
        /* rehearsal is best-effort */
      }
    },
    [runId],
  );
  // Rehearsal: the character's opening line on each era change (async, best-effort).
  const era0 = view.activeEra;
  const finished = Boolean(view.ending);
  useEffect(() => {
    if (mode !== "rehearsal" || finished) return;
    let cancelled = false;
    api<{ text: string; character: "jeanne" | "malik" }>(`/api/runs/${runId}/rehearsal`, { method: "POST", body: { text: null } })
      .then((r) => {
        if (!cancelled) setRLines((l) => [...l, { role: "assistant", text: r.text, at: Date.now(), character: r.character }]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [era0, mode, finished, runId]);

  async function switchEra(era: Era) {
    if (era === view.activeEra || busy || view.ending) return;
    setSwitching(era);
    const wasLive = live.status === "live" || live.status === "connecting";
    if (live.status !== "idle") await live.stop(); // close the old character BEFORE switching
    setSuggestion(null);
    const r = await act("switch_era", { era });
    setTimeout(() => setSwitching(null), 450);
    // Keep talking across eras: the player already consented; connect the other era's character.
    if (wasLive && r?.ok && mode === "live") {
      setMicMuted(false);
      void live.start();
    }
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  async function deleteRun() {
    setBusy(true);
    await live.stop();
    try {
      await api(`/api/runs/${runId}`, { method: "DELETE" });
      router.push("/?deleted=1");
    } catch (e) {
      say((e as Error).message || g.deleteFailed, "warn");
      setBusy(false);
    }
  }

  async function newRun() {
    const r = await api<{ runId: string }>("/api/runs", { method: "POST" });
    router.push(`/play/${r.runId}`);
  }

  const era = view.activeEra;
  const canDecide = view.endings.length > 0 && !view.ending;

  return (
    <div className={`game game--${era}${switching ? " is-switching" : ""}`}>
      <header className="topbar">
        <Link href="/" className="wordmark" aria-label="AFTERIMAGE, accueil">AFTERIMAGE</Link>
        <p className="episode"><span>{g.episodeLabel}</span> {g.episode}</p>
        <div className="topbar__right">
        <LanguageSwitch />
        <nav className="era-switch" aria-label={g.era}>
          {([1996, 2026] as Era[]).map((e) => (
            <button key={e} type="button" aria-pressed={era === e} disabled={busy || Boolean(view.ending)} onClick={() => switchEra(e)}>{e}</button>
          ))}
        </nav>
        </div>
      </header>
      {mode === "rehearsal" && <p className="rehearsal-banner" role="note">{g.rehearsalBanner}</p>}

      <main className="stage">
        <div className="stage__scene">
          <div className="meta"><span>{t.scene.place}</span><span>{era === 1996 ? t.scene.date1996 : t.scene.date2026}</span></div>
          <SceneViewport era={era} view={view} pulse={pulse} onHotspot={(id) => setInspect(HOTSPOT_TO_INSPECT[id] ?? id)} />
        </div>
        <CharacterPanel
          era={era}
          mode={mode}
          status={live.status}
          videoReady={live.videoReady}
          speaking={live.speaking}
          subtitle={live.subtitle}
          transcript={mode === "live" ? live.transcript : rLines}
          error={live.error}
          mountRef={liveMountRef}
          onStart={() => { setMicMuted(false); void live.start(); }}
          onStop={() => void live.stop()}
          onSend={(t) => (mode === "live" ? live.sendText(t) : void rehearse(t))}
          suggestion={suggestion && view.availableActions.includes(suggestion.action) ? { label: suggestion.label, onAccept: () => { const s = suggestion; setSuggestion(null); void act(s.action, s.args); } } : null}
          micMuted={micMuted}
          onToggleMic={() => { live.setMicMuted(!micMuted); setMicMuted(!micMuted); }}
          disabled={busy || Boolean(view.ending)}
        />
      </main>

      <Notebook entries={view.notebook} era={era} onOpen={setInspect} />

      <footer className="footer">
        <div>
          <p className="objective"><span className="eyebrow">{g.objective}</span> {view.objective}</p>
          {hint && <p className="hint" role="status"><span className="eyebrow">{g.hint}</span> {hint}</p>}
        </div>
        <div className="footer__actions">
          {era === 1996 && !view.message.sealed && view.availableActions.includes("write_message") && <button type="button" className="btn" onClick={() => setComposer(true)}>{g.words}</button>}
          {canDecide && <button type="button" className="btn btn--brass" onClick={() => setEndingOpen(true)}>{g.decide}</button>}
          {!view.ending && <button type="button" className="btn" onClick={() => act("request_hint")} disabled={busy}>{g.hint}</button>}
          <Link className="btn" href="/">{g.quit}</Link>
          {!confirmDelete ? (
            <button type="button" className="btn btn--quiet" onClick={() => setConfirmDelete(true)}>{g.deleteRun}</button>
          ) : (
            <span className="confirm-delete" role="group" aria-label={g.deleteConfirm}>
              <span className="small">{g.deleteConfirm}</span>
              <button type="button" className="btn btn--decision" onClick={deleteRun} disabled={busy}>{g.deleteYes}</button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>{t.common.cancel}</button>
            </span>
          )}
        </div>
      </footer>

      <div className="toast" role="status" aria-live="polite">{toast && !view.ending && <p className={`toast__msg toast__msg--${toast.tone}`}>{toast.text}</p>}</div>
      {switching && <div className="timeshift" aria-live="assertive">{fmt(g.switching, { era: switching })}</div>}

      <ObjectInspector id={inspect} era={era} view={view} onClose={() => setInspect(null)} act={async (a, args) => { const r = await act(a, args); return r; }} openComposer={() => { setInspect(null); setComposer(true); }} />
      <MessageComposer key={view.message.draft ?? "none"} open={composer} onClose={() => setComposer(false)} view={view} act={act} />
      {canDecide && <EndingDialog open={endingOpen} onClose={() => setEndingOpen(false)} runId={runId} view={view} onDone={(r) => { setEndingOpen(false); setView(r.publicState); void live.stop(); }} />}

      {view.ending && (
        <section className="epilogue" aria-label={g.epilogue}>
          <div className="epilogue__facade">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/afterimage/scenes/cinema-exterior-1672.webp" alt={g.facadeAlt} />
            <p className={`marquee marquee--${view.ending}`}>{g.marquee[view.ending]?.[0]}<small>{g.marquee[view.ending]?.[1]}</small></p>
          </div>
          <p className="epilogue__text">{view.closing}</p>
          {view.message.recovered && <p className="epilogue__msg">{fmt(g.wordsCrossed, { message: view.message.recovered })}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn--brass" onClick={newRun}>{g.anotherStory}</button>
            <Link className="btn" href="/">{t.common.home}</Link>
          </div>
          <p className="muted small">{fmt(g.hintsUsed, { n: view.hints.used })}</p>
        </section>
      )}
    </div>
  );
}
