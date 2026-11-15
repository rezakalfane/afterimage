"use client";
// Live conversation controller (Napster Web SDK 2.0.0, WebRTC).
// - The server reserves capacity and returns a short-lived token (kept in memory only).
// - Implicit tool calls are relayed to /api/runs/:id/tool (server validates), then answered
//   with send_function_output exactly once per call_id.
// - After a UI mutation, pushContext() sends the character's new projection as a silent system message.
// - stop() destroys the SDK instance AND closes the server lease; unload uses fetch keepalive.
import { useCallback, useEffect, useRef, useState } from "react";
import type { NapsterCompanionApiConfig, NapsterCompanionApiInstance } from "@touchcastllc/napster-companion-api";
import { api } from "@/components/game/api";
import { useT } from "@/i18n/I18nProvider";

export type LiveStatus = "idle" | "connecting" | "live" | "closing" | "error";
/** Each line belongs to ONE character: the panel only shows the current era's character. */
export type TranscriptLine = { role: "user" | "assistant"; text: string; at: number; character: "jeanne" | "malik" };

type Instance = Pick<NapsterCompanionApiInstance, "sendCommand" | "destroy" | "muteMic" | "unmuteMic">;
type ServerEvent = { event?: string; type?: string; data?: Record<string, unknown> & { message?: Record<string, unknown> } };

interface Options {
  runId: string;
  onPublicState?: (state: unknown, revision: number) => void;
  /** The PLAYER's own final transcript (never the model's words): used for voice confirmations. */
  onUserUtterance?: (text: string) => void;
  /** Debug hook for the technical proof (Playwright); not used by the game UI. */
  onRawEvent?: (e: ServerEvent) => void;
}

export function useLiveConversation({ runId, onPublicState, onRawEvent, onUserUtterance }: Options) {
  const t = useT().character;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Instance | null>(null);
  const leaseRef = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const greeted = useRef(false);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  /** "idle" | "starting" | "started": a stop while starting must also close what the start opens. */
  const phaseRef = useRef<"idle" | "starting" | "started">("idle");
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [character, setCharacter] = useState<"jeanne" | "malik" | null>(null);
  const characterRef = useRef<"jeanne" | "malik">("malik");
  const [speaking, setSpeaking] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [subtitle, setSubtitle] = useState("");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const cbs = useRef({ onPublicState, onRawEvent, onUserUtterance });
  useEffect(() => {
    cbs.current = { onPublicState, onRawEvent, onUserUtterance };
  }, [onPublicState, onRawEvent, onUserUtterance]);

  const send = useCallback((cmd: unknown) => {
    instanceRef.current?.sendCommand(cmd as Parameters<Instance["sendCommand"]>[0]);
  }, []);

  const handleTool = useCallback(
    async (data: Record<string, unknown>) => {
      const callId = String(data.call_id ?? "");
      const name = String(data.name ?? "");
      if (!callId || !name || seen.current.has(callId) || !leaseRef.current) return; // SDK may emit twice
      seen.current.add(callId);
      let output: Record<string, unknown> = { ok: false, message: tRef.current.toolNoServer };
      try {
        const r = await api<{ output: Record<string, unknown>; revision: number; publicState: unknown }>(`/api/runs/${runId}/tool`, {
          method: "POST",
          body: { callId, name, args: data.arguments ?? {}, conversationLeaseId: leaseRef.current },
        });
        output = r.output;
        cbs.current.onPublicState?.(r.publicState, r.revision);
      } catch (e) {
        // Never claim failure if it may have committed: the UI reloads the canonical state.
        output = { ok: false, message: tRef.current.toolUnverified };
        cbs.current.onPublicState?.(null, -1);
        console.warn("[tool]", (e as Error).message);
      }
      // delay: true → the result is processed once the character has finished its current
      // sentence ("Je vais ouvrir l’armoire…"); delay: false made it cut itself off mid-sentence.
      send({ type: "send_function_output", data: { call_id: callId, output, delay: true } });
    },
    [runId, send],
  );

  const onData = useCallback(
    (raw: ServerEvent) => {
      cbs.current.onRawEvent?.(raw);
      const ev = raw.event ?? raw.type;
      const data = raw.data ?? {};
      if (ev === "function_implicitly_called") void handleTool(data);
      else if (ev === "talk_state_changed") setSpeaking(data.state === "started" || data.state === "in_progress");
      else if (ev === "message_received") {
        const m = data.message;
        if (!m || m.type === "session") return;
        if (m.role === "assistant" && m.action === "delta") setSubtitle((s) => s + String(m.content ?? ""));
        if (m.role === "assistant" && m.action === "created" && m.response_id && !m.item_id) setSubtitle("");
        if (m.action === "completed" && (m.role === "assistant" || m.role === "user") && String(m.content ?? "").trim()) {
          const line = { role: m.role as "user" | "assistant", text: String(m.content), at: Date.now(), character: characterRef.current };
          setTranscript((t) => [...t.slice(-40), line]);
          if (m.role === "assistant") setSubtitle(line.text);
          else cbs.current.onUserUtterance?.(line.text);
        }
      } else if (ev === "provider_connection_aborted" || ev === "session_expired" || ev === "no_credits_left") {
        setError({ code: ev, message: t.liveInterrupted });
        void stopRef.current?.();
      }
    },
    [handleTool, t],
  );

  const stop = useCallback(async () => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = null;
    const wasActive = phaseRef.current !== "idle";
    phaseRef.current = "idle";
    const inst = instanceRef.current;
    instanceRef.current = null;
    leaseRef.current = null;
    if (!wasActive) return; // nothing started (e.g. React strict-mode remount): no server call
    setStatus("closing");
    try {
      inst?.destroy();
    } catch {
      /* already destroyed */
    }
    await api(`/api/runs/${runId}/conversation`, { method: "DELETE" }).catch(() => {});
    setVideoReady(false);
    setSpeaking(false);
    setSubtitle("");
    setStatus("idle");
  }, [runId]);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    if (phaseRef.current !== "idle" || !mountRef.current) return;
    phaseRef.current = "starting";
    setError(null);
    setStatus("connecting");
    greeted.current = false;
    let opened: { token: string; leaseId: string; character: "jeanne" | "malik" };
    try {
      opened = await api(`/api/runs/${runId}/conversation`, { method: "POST" });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (phaseRef.current === "starting") {
        phaseRef.current = "idle";
        setError({ code: err.code ?? "ERROR", message: err.message ?? t.connectFailed });
        setStatus("error");
      }
      return;
    }
    if (phaseRef.current !== "starting") {
      // Cancelled while the server was opening: close what was just opened.
      await api(`/api/runs/${runId}/conversation`, { method: "DELETE" }).catch(() => {});
      return;
    }
    phaseRef.current = "started";
    leaseRef.current = opened.leaseId;
    characterRef.current = opened.character;
    setCharacter(opened.character);
    setSubtitle("");
    const { NapsterCompanionApiSdk } = await import("@touchcastllc/napster-companion-api");
    const config: Partial<NapsterCompanionApiConfig> = {
      layout: { type: "inline", mountContainer: mountRef.current },
      style: { view: "rectangle" },
      features: { controls: { enabled: false }, disclaimer: { enabled: false }, inactiveTimeout: { enabled: false } },
      onData: onData as NapsterCompanionApiConfig["onData"],
      onAvatarReady: () => setVideoReady(true),
      onSessionStatusChange: (s) => {
        if ((s === "readyAudio" || s === "readyVideo") && !greeted.current) {
          greeted.current = true; // ready may fire twice (audio, then video): latch
          setStatus("live");
        }
        if (s === "permissionBlocked" || s === "permissionDismissed") {
          setError({ code: "MIC_DENIED", message: t.micDenied });
        }
      },
      onError: (e) => console.warn("[sdk]", e.message),
    };
    try {
      // The token is handed to the SDK through a function, as required by SDK 2.x.
      instanceRef.current = await NapsterCompanionApiSdk.init(async () => opened.token, config);
    } catch (e) {
      setError({ code: "SDK_INIT", message: t.sdkFailed });
      await stop();
      console.warn("[sdk init]", (e as Error).message);
      return;
    }
    heartbeatTimer.current = setInterval(() => {
      if (!leaseRef.current) return;
      api(`/api/runs/${runId}/heartbeat`, { method: "POST", body: { leaseId: leaseRef.current } }).catch((e: { code?: string }) => {
        if (e.code === "LEASE_INVALID") void stop();
      });
    }, 30_000);
  }, [runId, onData, stop, t]);

  /** Typed input: the player writes instead of speaking. Sent as plain user text (never system). */
  const sendText = useCallback((text: string) => {
    const t = text.trim().slice(0, 500);
    if (!t) return;
    send({ type: "send_message", data: { role: "user", text: t, trigger_response: true, delay: true } });
    setTranscript((x) => [...x.slice(-40), { role: "user", text: t, at: Date.now(), character: characterRef.current }]);
  }, [send]);

  /** Silent context update after a UI mutation (projection of the active character only). */
  const pushContext = useCallback((contextText: string, react = false) => {
    send({ type: "send_message", data: { role: "system", text: contextText, trigger_response: react, delay: true } });
  }, [send]);

  const setMicMuted = useCallback((muted: boolean) => {
    if (muted) instanceRef.current?.muteMic();
    else instanceRef.current?.unmuteMic();
  }, []);

  // Close the lease if the tab goes away (keepalive survives unload).
  useEffect(() => {
    const onHide = () => {
      // Also while the open is in flight: its lease would otherwise outlive the page.
      if (!leaseRef.current && phaseRef.current === "idle") return;
      void fetch(`/api/runs/${runId}/conversation`, { method: "DELETE", keepalive: true, credentials: "same-origin" });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void stopRef.current?.();
    };
  }, [runId]);

  return { mountRef, status, character, speaking, videoReady, error, transcript, subtitle, start, stop, sendText, pushContext, setMicMuted };
}
