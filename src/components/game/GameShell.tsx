"use client";
// The game screen. Server state is the only truth: every change is a command whose response
// replaces the local view. Same rules for buttons, keyboard and live tool calls.
import "@touchcastllc/napster-companion-api/styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CharacterPanel } from "@/components/conversation/CharacterPanel";
import { useLiveConversation, type TranscriptLine } from "@/components/conversation/useLiveConversation";
import { useLocale, useT } from "@/i18n/I18nProvider";
import { closeIntent, confirmsSelectedEnding, lookIntent, showIntent, wantsToWrite, endingFromSpeech, eraFromSpeech, isConfirmation, sameTarget, wantsToDecide, type VoiceTarget } from "./voice";
import { LanguageChoice, LanguageSwitch, setLocale } from "@/components/ui/LanguageSwitch";
import { DisplayChoices } from "@/components/ui/DisplayChoices";
import { Dialog } from "@/components/ui/Dialog";
import { FacadeSign } from "@/components/ui/FacadeSign";
import { ERA_META, HOTSPOTS } from "./scene-config";
import { fmt, type Locale } from "@/i18n/messages";
import { api, ApiError, commandId } from "./api";
import { EndingDialog } from "./EndingDialog";
import { MessageComposer } from "./MessageComposer";
import { Notebook } from "./Notebook";
import { ObjectInspector } from "./ObjectInspector";
import { SceneViewport } from "./SceneViewport";
import type { Action, CommandResponse, Era, Mode, PublicState } from "./types";

const HOTSPOT_TO_INSPECT: Record<string, string> = { photo: "photo", waterline: "archiveReport", projector: "projector", cabinet: "cabinet", cache: "cache", programme: "programme", hall: "hall", letter: "letter", shelf: "shelf", reels: "reels", lamp: "lamp", splicer: "splicer", seats: "seats" };

/** Notebook documents that open automatically when a character reveals them during a live talk. */
const AUTO_OPEN = new Set(["photo", "archiveReport", "programme", "rowMemory", "letter", "message", "futureLetter"]);
/** Gestures whose result is shown briefly, then the window closes by itself. Readings stay open. */
const AUTO_CLOSE_ACTIONS = new Set<Action>(["share_photo_note", "propose_seat", "share_report", "retrieve_key", "close_cabinet", "acknowledge_permission", "relay_flood_warning", "confirm_message", "preserve_cache", "find_future_key"]);
const AUTO_CLOSE_MS = 2200;
/** Time left to finish reading the last recovered text before its window closes. */
const READ_CLOSE_MS = 4000;
/** Calls that show something to read: their window stays open. Gestures close after their result. */
const READINGS = new Set(["open_cabinet", "recover_cache", "inspect_photo", "inspect_waterline", "inspect_programme", "ask_usual_place", "read_letter", "read_message", "read_future_letter", "look_at"]);

/** The inspector window matching a character's call, from the current server state. */
function focusTarget(action: string, target: string | null, s: PublicState): string | null {
  const era = s.activeEra;
  const open = era === 1996 ? s.scene.cabinetOpen1996 : s.scene.cabinetOpen2026;
  const seen = (id: string) => s.notebook.some((n) => n.id === id);
  const cabinet = open ? (era === 1996 ? "letter" : "cache") : "cabinet";
  if (action === "look_at") {
    const looks: Record<string, string> = {
      hall: "hall", cabinet, projector: "projector", photo: "photo", waterline: "archiveReport", programme: "programme", reels: "reels", lamp: "lamp", splicer: "splicer", seats: "seats",
      desk: era === 1996 ? "programme" : "photo",
      letter: era === 1996 ? "letter" : seen("futureLetter") ? "futureLetter" : "cache",
      message: seen("message") ? "message" : "cache",
    };
    return target ? looks[target] ?? null : null;
  }
  const byAction: Record<string, string> = {
    inspect_photo: "photo", share_photo_note: "photo", ask_usual_place: "rowMemory", propose_seat: "hall", share_report: "archiveReport", inspect_waterline: "archiveReport", relay_flood_warning: "archiveReport",
    inspect_programme: "programme", read_letter: "letter", acknowledge_permission: "letter", retrieve_key: "hall",
    find_future_key: "projector", preserve_cache: "shelf", read_message: "cache", read_future_letter: "cache",
    open_cabinet: cabinet, close_cabinet: "cabinet", recover_cache: cabinet,
  };
  return byAction[action] ?? null;
}
/** Event-time clock (called from handlers only). */
const clock = () => Date.now();

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
  const composerRef = useRef(false);
  const endingOpenRef = useRef(false);
  const selectedRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const inspectRef = useRef<string | null>(null);
  const locale = useLocale();
  const [hint, setHint] = useState<string | null>(null);
  const [switching, setSwitching] = useState<Era | null>(null);
  const [rLines, setRLines] = useState<TranscriptLine[]>([]);
  const [suggestion, setSuggestion] = useState<{ action: Action; args?: Record<string, unknown>; label: string } | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
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
      const prev = viewRef.current;
      setView(next);
      if (revealed) setInspect((cur) => cur ?? revealed.id);
      // Jeanne just noted the words: show the sheet for review (confirm by voice or button).
      if (next.message.draft && next.message.draft !== prev.message.draft && !next.message.sealed) {
        setInspect(null);
        setComposer(true);
      }
      lastState.current = next;
      afterState(prev, next);
    },
    // Whatever a character's call was about (accepted, refused or unchanged) is shown on screen.
    onFocus: ({ action, target }) => {
      const s = lastState.current ?? viewRef.current;
      const id = focusTarget(action, target, s);
      if (!id || composerRef.current) return;
      // A document window only opens if that document exists (a refused call shows nothing empty).
      if (AUTO_OPEN.has(id) && !s.notebook.some((n) => n.id === id)) return;
      setInspect(id);
      if (!READINGS.has(action)) scheduleClose();
      else if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    onUserUtterance: (text, meta) => onPlayerWords(text, meta),
  });

  const lastState = useRef<PublicState | null>(null);
  // Keep the refs used by voice handlers current, and (re)create the confirmation target whenever
  // the step on screen changes: a new target gets a new "since", so earlier speech cannot count.
  useEffect(() => {
    composerRef.current = composer;
    endingOpenRef.current = endingOpen;
    selectedRef.current = endingSelected;
    sessionRef.current = live.session;
    inspectRef.current = inspect;
    const now = currentTarget();
    if (!now) target.current = null;
    else if (!target.current || !sameTarget(target.current, { ...now, since: target.current.since })) target.current = { ...now, since: clock() };
  });
  // Voice play: windows close a moment after a validated gesture; the decision opens itself.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setInspect(null);
      setComposer(false);
    }, AUTO_CLOSE_MS);
  }
  function afterState(prev: PublicState, next: PublicState) {
    // Both recovered texts read: the reading window closes after a moment. The decision is NOT
    // opened for the player: they open it (button) or name an ending out loud when ready.
    if (prev.endings.length === 0 && next.endings.length > 0 && !next.ending) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => setInspect(null), READ_CLOSE_MS);
    }
  }

  // Voice confirmation (player's FINAL transcript only). The step on screen is a target bound to
  // its kind, exact content (text or ending), server revision and live session; any change, a
  // closed panel or a new session invalidates it. Old, repeated or out-of-step events are ignored.
  const endingConfirm = useRef<(() => void) | null>(null);
  const endingChoose = useRef<((id: string) => void) | null>(null);
  const [endingSelected, setEndingSelected] = useState<string | null>(null);
  const target = useRef<VoiceTarget | null>(null);
  const heard = useRef(new Set<string>());
  function currentTarget(): Omit<VoiceTarget, "since"> | null {
    const v = viewRef.current;
    const session = sessionRef.current;
    const draft = v.message.draft;
    if (composerRef.current && draft && v.message.confirmed !== draft && !v.message.sealed && v.availableActions.includes("confirm_message")) {
      return { kind: "message", content: draft, revision: v.revision, session };
    }
    if (endingOpenRef.current && selectedRef.current) return { kind: "ending", content: selectedRef.current, revision: v.revision, session };
    return null;
  }
  function onPlayerWords(text: string, meta: { itemId: string; receivedAt: number }) {
    if (heard.current.has(meta.itemId)) return trace(text, "ignoré : événement répété");
    heard.current.add(meta.itemId);
    // "Ok" / "d'accord" / "fermer" closes the window being read. A confirmation step (message sheet,
    // ending) only closes on an explicit "fermer"/"annuler", never on "ok".
    const close = closeIntent(text);
    if (close && inspectRef.current && !composerRef.current && !endingOpenRef.current) {
      trace(text, "fenêtre fermée");
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setInspect(null);
      return;
    }
    if (close === "close" && (composerRef.current || endingOpenRef.current)) {
      trace(text, "fenêtre fermée (rien confirmé)");
      setComposer(false);
      setEndingOpen(false);
      return;
    }
    // "Je veux laisser un message": open the words sheet (writing still happens by voice or keys).
    if (!composerRef.current && !endingOpenRef.current && wantsToWrite(text)) {
      const v = viewRef.current;
      if (v.activeEra === 1996 && !v.message.sealed && v.availableActions.includes("write_message")) {
        trace(text, "feuille « Vos mots » ouverte");
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setInspect(null);
        setComposer(true);
        return;
      }
    }
    // "J'ai une photo à vous montrer": open that document if the player has it (the character
    // still hears the sentence; sharing it with them stays their own, backed step).
    const shown = showIntent(text);
    if (shown && !composerRef.current && !endingOpenRef.current) {
      const n = viewRef.current.notebook;
      const id = shown === "letter" && !n.some((e) => e.id === "letter") ? "futureLetter" : shown;
      if (n.some((e) => e.id === id)) {
        trace(text, `document ouvert : ${id}`);
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setInspect(id);
        // Showing it to Jeanne in the player's own words IS the share (same as the button): she
        // then receives what the document says, through the server.
        const share = ({ photo: "share_photo_note", archiveReport: "share_report" } as Record<string, Action>)[id];
        if (share && viewRef.current.availableActions.includes(share)) {
          trace(text, `partagé avec le personnage : ${share}`);
          void act(share);
        }
      }
    }
    // "Regardons le bas de l'armoire": open that place, as a click would (its simple reading runs
    // on opening). Only places present in the era on screen; the character still hears the line.
    const place = !shown && !composerRef.current && !endingOpenRef.current ? lookIntent(text) : null;
    if (place) {
      const v = viewRef.current;
      const open = v.activeEra === 1996 ? v.scene.cabinetOpen1996 : v.scene.cabinetOpen2026;
      const here = HOTSPOTS[v.activeEra].filter((h) => !h.when || (h.when === "open") === open).map((h) => h.id);
      const id = place === "cabinet" && open ? (v.activeEra === 1996 ? "letter" : "cache") : place;
      if (here.includes(id) || (place === "cabinet" && here.some((h) => h === "cache" || h === "letter" || h === "cabinet"))) {
        trace(text, `lieu affiché : ${id}`);
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setInspect(HOTSPOT_TO_INSPECT[id] ?? id);
        if (id === "photo" && v.availableActions.includes("inspect_photo")) void act("inspect_photo");
      }
    }
    // "2026" / "1996" (alone or as a short command): change era, as with the switch.
    const nextEra = eraFromSpeech(text, viewRef.current.activeEra);
    if (nextEra && !viewRef.current.ending) {
      trace(text, `époque → ${nextEra}`);
      void switchEraRef.current?.(nextEra);
      return;
    }
    const now = currentTarget();
    const t = target.current;
    if (t) {
      if (!now || !sameTarget(t, { ...now, since: t.since })) return trace(text, "ignoré : l’étape affichée a changé");
      if (meta.receivedAt < t.since + 300) return trace(text, "ignoré : parole antérieure à l’étape");
      const reselect = t.kind === "ending" ? endingFromSpeech(text, locale, { choiceShown: true }) : null;
      if (reselect && reselect !== t.content && endingChoose.current) {
        trace(text, `nouvelle sélection : ${reselect} (confirmation encore requise)`);
        endingChoose.current(reselect);
        return;
      }
      const confirmed = isConfirmation(text, locale, t.kind) || (t.kind === "ending" && confirmsSelectedEnding(text, locale, t.content));
      if (!confirmed) {
        // It sounded like a confirmation but was not explicit enough: say so instead of silence.
        if (/confirm|valid|garde|keep|confie/i.test(text)) say(t.kind === "message" ? g.voiceRetryMessage : g.voiceRetryEnding, "warn");
        return trace(text, "ignoré : pas une confirmation explicite");
      }
      target.current = null; // single use
      trace(text, t.kind === "message" ? "CONFIRMÉ : message" : `CONFIRMÉ : fin ${t.content}`);
      if (t.kind === "message") void act("confirm_message", { text: t.content });
      else endingConfirm.current?.();
      return;
    }
    // "Let's decide" / "on décide": open the choice (no selection, no confirmation).
    if (!endingOpenRef.current && viewRef.current.endings.length > 0 && !viewRef.current.ending && viewRef.current.activeEra === 2026 && wantsToDecide(text)) {
      trace(text, "ouverture du choix");
      setInspect(null);
      setEndingOpen(true);
      return;
    }
    // Naming an ending while the decision is possible but not shown: open it, then select (the
    // confirmation stays a separate, explicit step).
    if (!endingOpenRef.current && viewRef.current.endings.length > 0 && !viewRef.current.ending && viewRef.current.activeEra === 2026) {
      const id = endingFromSpeech(text, locale);
      if (id) {
        trace(text, `ouverture du choix + sélection : ${id} (confirmation encore requise)`);
        setInspect(null);
        setEndingOpen(true);
        setTimeout(() => endingChoose.current?.(id), 300);
        return;
      }
    }
    // Ending choice by voice: an explicit selection only (never a confirmation, never automatic).
    if (endingOpenRef.current && endingChoose.current) {
      const id = endingFromSpeech(text, locale, { choiceShown: true });
      if (id) {
        trace(text, `sélection : ${id} (confirmation encore requise)`);
        endingChoose.current(id);
        // "La version autorisée, je confirme" with nothing selected yet: select, and say that the
        // confirmation must follow (it binds to what is shown, so it cannot happen in advance).
        if (isConfirmation(text.replace(/^.*?,/, ""), locale, "ending") || /confirm/i.test(text)) say(g.voiceSelectThenConfirm, "info");
      } else {
        trace(text, "ignoré : aucune fin choisie explicitement");
        if (isConfirmation(text, locale, "ending")) say(g.voiceChooseFirst, "warn");
      }
      return;
    }
    trace(text, "aucune étape de confirmation à l’écran");
  }
  // Diagnostic for the microphone acceptance test only (?voicedebug=1): what was heard → decision.
  const [voiceLog, setVoiceLog] = useState<string[]>([]);
  const [voiceDebug] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("voicedebug"));
  function trace(text: string, decision: string) {
    if (voiceDebug) setVoiceLog((l) => [...l.slice(-12), `« ${text} » → ${decision}`]);
  }

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
          if (AUTO_CLOSE_ACTIONS.has(action)) scheduleClose();
          // Opening the cabinet shows what is inside, and that window stays open.
          if (action === "open_cabinet" || action === "recover_cache") {
            if (closeTimer.current) clearTimeout(closeTimer.current);
            setInspect(r.publicState.activeEra === 1996 ? "letter" : "cache");
          }
        }
        afterState(viewRef.current, r.publicState);
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

  // After the decision: the character says one last word (live), then the epilogue. The decision is
  // already saved; this only delays showing the epilogue, and the player can skip it.
  const [farewell, setFarewell] = useState(false);
  const skipFarewell = useRef(false);
  const speakingRef = useRef(false);
  useEffect(() => {
    speakingRef.current = live.speaking;
  }, [live.speaking]);
  async function finishWithFarewell(r: CommandResponse) {
    setEndingOpen(false);
    if (live.status === "live" && r.farewell) {
      skipFarewell.current = false;
      setFarewell(true);
      live.pushContext(r.farewell, true);
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const t0 = clock();
      // The character may first finish its current reply, and talk_state goes "ended" between two
      // sentences: wait until it has spoken, then for 3 s of continuous silence (cap 45 s).
      let spoke = false;
      let silentSince = clock();
      while (!skipFarewell.current && clock() - t0 < 45000) {
        if (speakingRef.current) {
          spoke = true;
          silentSince = clock();
        } else if (spoke && clock() - silentSince > 3000) break;
        else if (!spoke && clock() - t0 > 10000) break; // nothing came: do not hang
        await wait(200);
      }
      setFarewell(false);
    }
    await live.stop();
    setView(r.publicState);
  }
  const switchEraRef = useRef<((era: Era) => Promise<void>) | null>(null);
  useEffect(() => {
    switchEraRef.current = switchEra;
  });
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
      setReconnecting(true);
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

  /** Leave: the game is saved server-side; the live call is closed BEFORE navigating. */
  async function quit() {
    await live.stop();
    router.push("/");
  }

  // Changing language during a live call: say so, end the call, then reload in the new language.
  const [langPending, setLangPending] = useState<Locale | null>(null);
  const requestLocale = (l: Locale) => (live.status === "idle" || live.status === "error" ? setLocale(l) : setLangPending(l));
  async function confirmLocale() {
    if (!langPending) return;
    await live.stop();
    setLocale(langPending);
  }
  const [menuOpen, setMenuOpen] = useState(false);

  async function newRun() {
    const r = await api<{ runId: string }>("/api/runs", { method: "POST" });
    router.push(`/play/${r.runId}`);
  }

  const era = view.activeEra;
  // The decision is taken in 2026, with Malik: the button only exists there.
  const canDecide = view.endings.length > 0 && !view.ending && view.activeEra === 2026;

  if (view.ending) {
    const ending = view.ending;
    return (
      <main className={`epilogue epilogue--${ending}`} aria-label={g.epilogue}>
        <div className="epilogue__facade">
          <FacadeSign main={g.marquee[ending]?.[0] ?? ""} sub={g.marquee[ending]?.[1] ?? ""} label={g.facadeAlt} tone={ending === "sealed_archive" ? "dim" : ending === "broken_promise" ? "warn" : "lit"} slice={false} />
        </div>
        <p className="epilogue__text">{view.closing}</p>
        {view.message.recovered && (
          <figure className="sheet sheet--aged epilogue__msg">
            <figcaption className="sheet__label">{g.wordsCaption}</figcaption>
            <p className="paper__text">{view.message.recovered}</p>
          </figure>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn--brass" onClick={newRun}>{g.anotherStory}</button>
          <Link className="btn" href="/">{t.common.home}</Link>
        </div>
        <details className="epilogue__summary">
          <summary>{g.summary}</summary>
          <p className="muted small">{fmt(g.hintsUsed, { n: view.hints.used })}</p>
        </details>
      </main>
    );
  }

  return (
    <div className={`game game--${era}${switching ? " is-switching" : ""}`}>
      <header className="topbar">
        <Link href="/" className="wordmark" aria-label={`AFTERIMAGE, ${t.common.home}`}>AFTERIMAGE</Link>
        <p className="episode"><span>{g.episodeLabel}</span> {g.episode}</p>
        <div className="topbar__right">
        <LanguageSwitch onRequest={requestLocale} />
        <nav className="era-switch" aria-label={g.era}>
          {([1996, 2026] as Era[]).map((e) => (
            <button key={e} type="button" aria-pressed={era === e} disabled={busy || Boolean(view.ending)} onClick={() => switchEra(e)}>{e}</button>
          ))}
        </nav>
        </div>
      </header>
      {mode === "rehearsal" && <p className="rehearsal-banner" role="note">{g.rehearsalBanner}</p>}

      <main className="stage">
        <div className="stage__inner">
        <div className="stage__scene">
          <p className="meta"><span className="meta__place">{t.scene.place}</span><span className="meta__short">{t.scene.placeShort}</span><span>{era === 1996 ? t.scene.date1996 : t.scene.date2026}</span></p>
          <SceneViewport era={era} view={view} onHotspot={(id) => setInspect(HOTSPOT_TO_INSPECT[id] ?? id)} />
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
          onStart={() => { setMicMuted(false); setReconnecting(false); void live.start(); }}
          reconnecting={reconnecting}
          onStop={() => void live.stop()}
          onSend={(t) => (mode === "live" ? live.sendText(t) : void rehearse(t))}
          suggestion={suggestion && view.availableActions.includes(suggestion.action) ? { label: suggestion.label, onAccept: () => { const s = suggestion; setSuggestion(null); void act(s.action, s.args); } } : null}
          micMuted={micMuted}
          onToggleMic={() => { live.setMicMuted(!micMuted); setMicMuted(!micMuted); }}
          disabled={busy || Boolean(view.ending)}
        />
        </div>
      </main>

      <footer className="footer">
        <Notebook entries={view.notebook} era={era} onOpen={setInspect} />
        <div className="footer__objective">
          <p className="objective"><span className="eyebrow">{g.objective}</span> {view.objective}</p>
          {hint && <p className="hint" role="status"><span className="eyebrow">{g.hint}</span> {hint}</p>}
        </div>
        <div className="footer__actions">
          {era === 1996 && !view.message.sealed && view.availableActions.includes("write_message") && <button type="button" className="btn" onClick={() => setComposer(true)}>{g.words}</button>}
          {canDecide && <button type="button" className="btn btn--brass" onClick={() => setEndingOpen(true)}>{g.decide}</button>}
          {!view.ending && <button type="button" className="btn" onClick={() => act("request_hint")} disabled={busy}>{g.hint}</button>}
          <button type="button" className="btn" onClick={quit} title={g.quitNote}>{g.quit}</button>
          <button type="button" className="btn btn--quiet" onClick={() => setMenuOpen(true)}>{g.menu}</button>
        </div>
      </footer>

      {voiceDebug && voiceLog.length > 0 && <ol className="voicedebug" aria-label="voice debug">{voiceLog.map((l, i) => <li key={i}>{l}</li>)}</ol>}
      <div className="toast" role="status" aria-live="polite">{toast && !view.ending && <p className={`toast__msg toast__msg--${toast.tone}`}>{toast.text}</p>}</div>
      {switching && <div className="timeshift" aria-live="assertive">{fmt(g.switching, { era: switching })}</div>}

      <Dialog open={menuOpen} title={g.menuTitle} onClose={() => { setMenuOpen(false); setConfirmDelete(false); }}>
        <div className="settings">
          <LanguageChoice onRequest={(l) => { setMenuOpen(false); requestLocale(l); }} />
          <DisplayChoices withObjects />
          <fieldset className="choices">
            <legend>{g.gameSection}</legend>
            <p className="muted small">{g.quitNote}</p>
            {!confirmDelete ? (
              <button type="button" className="btn btn--quiet" onClick={() => setConfirmDelete(true)}>{g.deleteRun}</button>
            ) : (
              <span className="confirm-delete" role="group" aria-label={g.deleteConfirm}>
                <span className="small">{g.deleteConfirm}</span>
                <button type="button" className="btn btn--decision" onClick={deleteRun} disabled={busy}>{g.deleteYes}</button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>{t.common.cancel}</button>
              </span>
            )}
          </fieldset>
        </div>
      </Dialog>
      <Dialog open={Boolean(langPending)} title={g.langLiveTitle} onClose={() => setLangPending(null)}>
        <p>{fmt(g.langLiveText, { name: t.character[ERA_META[era].character].name })}</p>
        <div className="btn-row">
          <button type="button" className="btn btn--brass" onClick={confirmLocale}>{g.langLiveYes}</button>
          <button type="button" className="btn" onClick={() => setLangPending(null)}>{t.common.cancel}</button>
        </div>
      </Dialog>

      <ObjectInspector id={inspect} era={era} view={view} onClose={() => setInspect(null)} act={async (a, args) => { const r = await act(a, args); return r; }} openComposer={() => { setInspect(null); setComposer(true); }} />
      <MessageComposer key={view.message.draft ?? "none"} open={composer} onClose={() => setComposer(false)} view={view} act={act} />
      {canDecide && <EndingDialog confirmRef={endingConfirm} chooseRef={endingChoose} onSelection={setEndingSelected} open={endingOpen} onClose={() => setEndingOpen(false)} runId={runId} view={view} onDone={finishWithFarewell} />}
      {farewell && (
        <div className="farewell" role="status">
          <span>{fmt(g.farewell, { name: t.character[ERA_META[era].character].name })}</span>
          <button type="button" className="btn btn--quiet" onClick={() => (skipFarewell.current = true)}>{g.farewellSkip}</button>
        </div>
      )}

    </div>
  );
}
