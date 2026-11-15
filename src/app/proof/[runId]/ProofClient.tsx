"use client";
import "@touchcastllc/napster-companion-api/styles";
import { useEffect, useRef } from "react";
import { useLiveConversation } from "@/components/conversation/useLiveConversation";

type ProofWindow = Window & { __proof?: Record<string, unknown> };

export function ProofClient({ runId }: { runId: string }) {
  const events = useRef<unknown[]>([]);
  const states = useRef<unknown[]>([]);
  const live = useLiveConversation({
    runId,
    onRawEvent: (e) => events.current.push({ at: Date.now(), e }),
    onPublicState: (s, rev) => states.current.push({ rev, s }),
  });
  useEffect(() => {
    (window as ProofWindow).__proof = { events: events.current, states: states.current, start: live.start, stop: live.stop, sendText: live.sendText, pushContext: live.pushContext, mute: live.setMicMuted };
  });
  return (
    <main style={{ padding: 24 }}>
      <h1>Preuve technique — conversation réelle</h1>
      <p data-testid="status">{live.status}</p>
      <p data-testid="character">{live.character ?? ""}</p>
      <p data-testid="video">{live.videoReady ? "video" : "no-video"}</p>
      <p data-testid="error">{live.error?.code ?? ""}</p>
      <div ref={live.mountRef} style={{ width: 360, height: 450, background: "#000" }} />
      <ol data-testid="transcript">{live.transcript.map((l, i) => <li key={i}>{l.role}: {l.text}</li>)}</ol>
    </main>
  );
}
