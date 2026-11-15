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

export type LiveStatus = "idle" | "connecting" | "live" | "closing" | "error";
export type TranscriptLine = { role: "user" | "assistant"; text: string; at: number };

type Instance = Pick<NapsterCompanionApiInstance, "sendCommand" | "destroy" | "muteMic" | "unmuteMic">;
type ServerEvent = { event?: string; type?: string; data?: Record<string, unknown> & { message?: Record<string, unknown> } };

interface Options {
  runId: string;
  onPublicState?: (state: unknown, revision: number) => void;
  /** Debug hook for the technical proof (Playwright); not used by the game UI. */
  onRawEvent?: (e: ServerEvent) => void;
}

export function useLiveConversation({ runId, onPublicState, onRawEvent }: Options) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Instance | null>(null);
  const leaseRef = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const greeted = useRef(false);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [character, setCharacter] = useState<"jeanne" | "malik" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [subtitle, setSubtitle] = useState("");
  const cbs = useRef({ onPublicState, onRawEvent });
  cbs.current = { onPublicState, onRawEvent };

  const send = useCallback((cmd: unknown) => {
    instanceRef.current?.sendCommand(cmd as Parameters<Instance["sendCommand"]>[0]);
  }, []);

  const handleTool = useCallback(
    async (data: Record<string, unknown>) => {
      const callId = String(data.call_id ?? "");
      const name = String(data.name ?? "");
      if (!callId || !name || seen.current.has(callId) || !leaseRef.current) return; // SDK may emit twice
      seen.current.add(callId);
      let output: Record<string, unknown> = { ok: false, message: "Le serveur ne répond pas ; reste en personnage et propose de réessayer." };
      try {
        const r = await api<{ output: Record<string, unknown>; revision: number; publicState: unknown }>(`/api/runs/${runId}/tool`, {
          method: "POST",
          body: { callId, name, args: data.arguments ?? {}, conversationLeaseId: leaseRef.current },
        });
        output = r.output;
        cbs.current.onPublicState?.(r.publicState, r.revision);
      } catch (e) {
        // Never claim failure if it may have committed: the UI reloads the canonical state.
        output = { ok: false, message: "Je n’ai pas pu vérifier. Laisse-moi un instant." };
        cbs.current.onPublicState?.(null, -1);
        console.warn("[tool]", (e as Error).message);
      }
      send({ type: "send_function_output", data: { call_id: callId, output, delay: false } });
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
          const line = { role: m.role as "user" | "assistant", text: String(m.content), at: Date.now() };
          setTranscript((t) => [...t.slice(-40), line]);
          if (m.role === "assistant") setSubtitle(line.text);
        }
      } else if (ev === "provider_connection_aborted" || ev === "session_expired" || ev === "no_credits_left") {
        setError({ code: ev, message: "La conversation en direct s’est interrompue. Vous pouvez continuer au clavier." });
        void stopRef.current?.();
      }
    },
    [handleTool],
  );

  const stopRef = useRef<(() => Promise<void>) | null>(null);
  const stop = useCallback(async () => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = null;
    const inst = instanceRef.current;
    instanceRef.current = null;
    leaseRef.current = null;
    setStatus((s) => (s === "idle" ? s : "closing"));
    try {
      inst?.destroy();
    } catch {
      /* already destroyed */
    }
    await api(`/api/runs/${runId}/conversation`, { method: "DELETE" }).catch(() => {});
    setVideoReady(false);
    setSpeaking(false);
    setStatus("idle");
  }, [runId]);
  stopRef.current = stop;

  const start = useCallback(async () => {
    if (instanceRef.current || !mountRef.current) return;
    setError(null);
    setStatus("connecting");
    greeted.current = false;
    let opened: { token: string; leaseId: string; character: "jeanne" | "malik" };
    try {
      opened = await api(`/api/runs/${runId}/conversation`, { method: "POST" });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setError({ code: err.code ?? "ERROR", message: err.message ?? "Connexion impossible." });
      setStatus("error");
      return;
    }
    leaseRef.current = opened.leaseId;
    setCharacter(opened.character);
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
          setError({ code: "MIC_DENIED", message: "Micro refusé : vous pouvez écrire vos messages au clavier." });
        }
      },
      onError: (e) => console.warn("[sdk]", e.message),
    };
    try {
      // The token is handed to the SDK through a function, as required by SDK 2.x.
      instanceRef.current = await NapsterCompanionApiSdk.init(async () => opened.token, config);
    } catch (e) {
      setError({ code: "SDK_INIT", message: "Impossible d’initialiser la conversation." });
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
  }, [runId, onData, stop]);

  /** Typed input: the player writes instead of speaking. Sent as plain user text (never system). */
  const sendText = useCallback((text: string) => {
    const t = text.trim().slice(0, 500);
    if (!t) return;
    send({ type: "send_message", data: { role: "user", text: t, trigger_response: true, delay: true } });
    setTranscript((x) => [...x.slice(-40), { role: "user", text: t, at: Date.now() }]);
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
      if (!leaseRef.current) return;
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
