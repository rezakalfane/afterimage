"use client";
// The game screen. Server state is the only truth: every change is a command whose response
// replaces the local view. Same rules for buttons, keyboard and live tool calls.
import "@touchcastllc/napster-companion-api/styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterPanel } from "@/components/conversation/CharacterPanel";
import { useLiveConversation, type TranscriptLine } from "@/components/conversation/useLiveConversation";
import { api, ApiError, commandId } from "./api";
import { EndingDialog } from "./EndingDialog";
import { MessageComposer } from "./MessageComposer";
import { Notebook } from "./Notebook";
import { ObjectInspector } from "./ObjectInspector";
import { ERA_META } from "./scene-config";
import { SceneViewport } from "./SceneViewport";
import type { Action, CommandResponse, Era, Mode, PublicState } from "./types";

const HOTSPOT_TO_INSPECT: Record<string, string> = { photo: "photo", waterline: "archiveReport", projector: "projector", cabinet: "cabinet", cache: "cache", programme: "programme", hall: "hall", letter: "letter", shelf: "shelf" };

export function GameShell({ runId, mode, initial }: { runId: string; mode: Mode; initial: PublicState }) {
  const router = useRouter();
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
      if (s) setView(s as PublicState);
      else void refresh(); // uncertain tool outcome: reload the canonical state
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
          say(r.message ?? "Action impossible.", "warn");
          return r;
        }
        if (r.hint) setHint(r.hint);
        if (r.changed && r.event && action !== "switch_era" && action !== "request_hint") {
          say(r.event.summary);
          setPulse(action);
          setTimeout(() => setPulse(null), 900);
        }
        if (r.reaction && mode === "rehearsal") setRLines((l) => [...l, { role: "assistant", text: r.reaction!, at: Date.now() }]);
        if (r.contextText && live.status === "live") live.pushContext(r.contextText, true);
        return r;
      } catch (e) {
        const err = e as ApiError;
        if (err.code === "REVISION_CONFLICT" && err.body?.publicState) {
          setView(err.body.publicState as PublicState);
          say("La partie a changé entre-temps (autre onglet ?). L’état a été rechargé : vérifiez avant de recommencer.", "warn");
        } else if (err.code === "RUN_FINISHED") {
          await refresh();
        } else say(err.message || "Connexion au serveur impossible. Rien n’a été perdu ; réessayez.", "warn");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [runId, mode, live, refresh, say],
  );

  // Rehearsal conversation (server-side deterministic replies, never mutating).
  const rehearse = useCallback(
    async (text: string | null) => {
      if (text) setRLines((l) => [...l, { role: "user", text, at: Date.now() }]);
      try {
        const r = await api<{ text: string; suggestion: typeof suggestion; openComposer?: boolean }>(`/api/runs/${runId}/rehearsal`, { method: "POST", body: { text } });
        setRLines((l) => [...l, { role: "assistant", text: r.text, at: Date.now() }]);
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
    api<{ text: string }>(`/api/runs/${runId}/rehearsal`, { method: "POST", body: { text: null } })
      .then((r) => {
        if (!cancelled) setRLines((l) => [...l, { role: "assistant", text: r.text, at: Date.now() }]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [era0, mode, finished, runId]);

  async function switchEra(era: Era) {
    if (era === view.activeEra || busy || view.ending) return;
    setSwitching(era);
    if (live.status !== "idle") await live.stop(); // close the old character BEFORE switching
    setSuggestion(null);
    await act("switch_era", { era });
    setTimeout(() => setSwitching(null), 450);
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  async function deleteRun() {
    setBusy(true);
    await live.stop();
    try {
      await api(`/api/runs/${runId}`, { method: "DELETE" });
      router.push("/?deleted=1");
    } catch (e) {
      say((e as Error).message || "Suppression impossible pour l’instant ; réessayez.", "warn");
      setBusy(false);
    }
  }

  async function newRun() {
    const r = await api<{ runId: string }>("/api/runs", { method: "POST" });
    router.push(`/play/${r.runId}`);
  }

  const era = view.activeEra;
  const meta = ERA_META[era];
  const canDecide = view.endings.length > 0 && !view.ending;

  return (
    <div className={`game game--${era}${switching ? " is-switching" : ""}`}>
      <header className="topbar">
        <Link href="/" className="wordmark" aria-label="AFTERIMAGE, accueil">AFTERIMAGE</Link>
        <p className="episode"><span>Chapitre premier</span> La dernière séance</p>
        <nav className="era-switch" aria-label="Époque">
          {([1996, 2026] as Era[]).map((e) => (
            <button key={e} type="button" aria-pressed={era === e} disabled={busy || Boolean(view.ending)} onClick={() => switchEra(e)}>{e}</button>
          ))}
        </nav>
      </header>
      {mode === "rehearsal" && <p className="rehearsal-banner" role="note">Mode répétition — aucun appel Napster : les personnages sont simulés et les réponses sont écrites à l’avance.</p>}

      <main className="stage">
        <div className="stage__scene">
          <div className="meta"><span>{meta.place}</span><span>{meta.date}</span></div>
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
          <p className="objective"><span className="eyebrow">Objectif</span> {view.objective}</p>
          {hint && <p className="hint" role="status"><span className="eyebrow">Aide</span> {hint}</p>}
        </div>
        <div className="footer__actions">
          {era === 1996 && !view.message.sealed && view.availableActions.includes("write_message") && <button type="button" className="btn" onClick={() => setComposer(true)}>Vos mots</button>}
          {canDecide && <button type="button" className="btn btn--decision" onClick={() => setEndingOpen(true)}>Décider du sort du film</button>}
          {!view.ending && <button type="button" className="btn" onClick={() => act("request_hint")} disabled={busy}>Aide</button>}
          <Link className="btn" href="/">Quitter</Link>
          {!confirmDelete ? (
            <button type="button" className="btn btn--quiet" onClick={() => setConfirmDelete(true)}>Supprimer ma partie</button>
          ) : (
            <span className="confirm-delete" role="group" aria-label="Confirmer la suppression">
              <span className="small">Effacer définitivement cette partie ?</span>
              <button type="button" className="btn btn--decision" onClick={deleteRun} disabled={busy}>Supprimer</button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Annuler</button>
            </span>
          )}
        </div>
      </footer>

      <div className="toast" role="status" aria-live="polite">{toast && !view.ending && <p className={`toast__msg toast__msg--${toast.tone}`}>{toast.text}</p>}</div>
      {switching && <div className="timeshift" aria-live="assertive">Passage vers {switching}…</div>}

      <ObjectInspector id={inspect} era={era} view={view} onClose={() => setInspect(null)} act={async (a, args) => { const r = await act(a, args); return r; }} openComposer={() => { setInspect(null); setComposer(true); }} />
      <MessageComposer key={view.message.draft ?? "none"} open={composer} onClose={() => setComposer(false)} view={view} act={act} />
      {canDecide && <EndingDialog open={endingOpen} onClose={() => setEndingOpen(false)} runId={runId} view={view} onDone={(r) => { setEndingOpen(false); setView(r.publicState); void live.stop(); }} />}

      {view.ending && (
        <section className="epilogue" aria-label="Épilogue">
          <div className="epilogue__facade">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/afterimage/scenes/cinema-exterior-1672.webp" alt="La façade du Régina, la nuit, sous la pluie" />
            <p className={`marquee marquee--${view.ending}`}>{view.ending === "sealed_archive" ? "Archives du Régina" : "Les lumières du Régina"}<small>{view.ending === "public_cut" ? "Un film d’Alice Mercier" : view.ending === "sealed_archive" ? "Conservé sous scellés" : "Version intégrale"}</small></p>
          </div>
          <p className="epilogue__text">{view.closing}</p>
          {view.message.recovered && <p className="epilogue__msg">Vos mots ont traversé trente ans : « {view.message.recovered} »</p>}
          <div className="btn-row">
            <button type="button" className="btn btn--brass" onClick={newRun}>Une autre histoire</button>
            <Link className="btn" href="/">Accueil</Link>
          </div>
          <p className="muted small">Aides demandées : {view.hints.used}. Cette partie est terminée et reste consultable.</p>
        </section>
      )}
    </div>
  );
}
