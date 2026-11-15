"use client";

// One live video call with one character (Napster Web SDK over WebRTC).
// Only one call is mounted at a time: switching era unmounts it, which destroys the session
// (the organization is limited to 5 concurrent WebRTC sessions).
import { useCallback, useEffect, useRef, useState } from "react";
import "@touchcastllc/napster-companion-api/styles";
import type { NapsterCompanionApiConfig, NapsterCompanionApiInstance } from "@touchcastllc/napster-companion-api";
import { CHARACTERS, tr, type CharacterId, type Locale } from "@/lib/content";
import { ui, type UiKey } from "@/i18n/ui";
import type { WorldEvent, WorldView } from "@/lib/world/world";

type Instance = Pick<NapsterCompanionApiInstance, "sendCommand" | "destroy">;

type ServerEvent = { event?: string; type?: string; data?: any };

interface Props {
  character: CharacterId;
  locale: Locale;
  onWorld: (view: WorldView, events: WorldEvent[]) => void;
}

type Phase = "idle" | "connecting" | "live" | "ended" | "error";

export function CharacterCall({ character, locale, onWorld }: Props) {
  const def = CHARACTERS[character];
  const mountRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Instance | null>(null);
  const seenCalls = useRef(new Set<string>());
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<UiKey | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  const stop = useCallback(() => {
    instanceRef.current?.destroy();
    instanceRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const handleToolCall = useCallback(
    async (data: { call_id?: string; name?: string; arguments?: Record<string, unknown> }) => {
      const { call_id, name, arguments: args } = data ?? {};
      if (!call_id || !name || seenCalls.current.has(call_id)) return; // calls can arrive twice
      seenCalls.current.add(call_id);
      let output: Record<string, unknown> = { ok: false, error: "tool_failed" };
      try {
        const res = await fetch("/api/world/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character, locale, name, args: args ?? {} }),
        });
        const json = await res.json();
        output = json.output ?? output;
        if (json.view) onWorld(json.view, json.events ?? []);
      } catch (e) {
        console.error("[tool]", e);
      }
      // The SDK types this command with an enum; the wire value is "send_function_output".
      instanceRef.current?.sendCommand({ type: "send_function_output", data: { call_id, output, delay: false } } as unknown as Parameters<Instance["sendCommand"]>[0]);
    },
    [character, locale, onWorld],
  );

  const onData = useCallback(
    (msg: ServerEvent) => {
      const ev = msg.event ?? msg.type;
      switch (ev) {
        case "function_implicitly_called":
          void handleToolCall(msg.data);
          break;
        case "talk_state_changed":
          setSpeaking(msg.data?.state === "started" || msg.data?.state === "in_progress");
          break;
        case "message_received": {
          const m = msg.data?.message;
          if (!m || m.type === "session") break;
          if (m.role === "assistant" && (m.action === "delta" || m.action === "completed")) {
            setSubtitle((prev) => (m.action === "completed" ? m.content ?? prev : prev + (m.content ?? "")));
          }
          if (m.role === "assistant" && m.action === "created" && m.item_id) setSubtitle("");
          break;
        }
        case "avatar_connection_warning":
          setError("errIdle");
          break;
        case "session_expired":
        case "no_credits_left":
        case "provider_connection_aborted":
          setError(ev === "provider_connection_aborted" ? "errSession" : "errEnded");
          setPhase("ended");
          stop();
          break;
      }
    },
    [handleToolCall, stop],
  );

  async function start() {
    setError(null);
    setPhase("connecting");
    if (!mountRef.current) return;
    // The SDK asks for the microphone itself, then calls getToken so the token is always fresh.
    const getToken = async () => {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character, locale }),
      });
      if (!res.ok) {
        const { error: code } = await res.json().catch(() => ({ error: "" }));
        setError(
          code === "agent_not_provisioned" ? "errNotProvisioned" : code === "too_many_players" ? "errTooMany" : code === "rate_limited" ? "errRateLimited" : "errSession",
        );
        setPhase("error");
        throw new Error(`session ${res.status} ${code}`);
      }
      return ((await res.json()) as { token: string }).token;
    };
    const { NapsterCompanionApiSdk } = await import("@touchcastllc/napster-companion-api");
    const config: Partial<NapsterCompanionApiConfig> = {
      layout: { type: "inline", mountContainer: mountRef.current },
      style: { view: "rectangle" },
      features: { controls: { enabled: false }, disclaimer: { enabled: false }, inactiveTimeout: { enabled: false } },
      onData: onData as NapsterCompanionApiConfig["onData"],
      onSessionStatusChange: (status) => {
        if (status === "readyAudio" || status === "readyVideo") setPhase("live");
        if (status === "permissionBlocked" || status === "permissionDismissed") {
          setError("micDenied");
          setPhase("error");
        }
      },
      onError: (e) => console.error("[sdk]", e),
      onDestroy: () => setPhase((p) => (p === "live" ? "ended" : p)),
    };
    instanceRef.current = await NapsterCompanionApiSdk.init(getToken, config);
  }

  function hangUp() {
    stop();
    setPhase("idle");
    setSubtitle("");
  }

  return (
    <section className="call" aria-label={`${def.firstName} — ${tr(def.headline, locale)}`}>
      <header className="call-head">
        <h2>{def.firstName}</h2>
        <p className="eyebrow">{tr(def.headline, locale)}</p>
      </header>
      <div className="call-video" ref={mountRef} data-phase={phase}>
        {phase !== "live" && (
          <div className="call-placeholder">
            {phase === "connecting" ? ui(locale, "connecting") : null}
          </div>
        )}
      </div>
      <div className="call-bar">
        {phase === "live" ? (
          <>
            <span className="call-status">{speaking ? ui(locale, "speaking", { name: def.firstName }) : ui(locale, "yourTurn")}</span>
            <button type="button" className="btn" onClick={hangUp}>{ui(locale, "hangUp")}</button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start} disabled={phase === "connecting"}>
            {ui(locale, "call")} {def.firstName}
          </button>
        )}
      </div>
      {subtitle && phase === "live" && <p className="call-subtitle">{subtitle}</p>}
      {error && <p className="call-error" role="status">{ui(locale, error)}</p>}
    </section>
  );
}
