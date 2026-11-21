"use client";
// Gentle nudges when nobody speaks for a while during a live conversation. Two kinds, both sent by
// the player's own browser as a system message that asks for ONE short in-character line:
// - "memory": the player has not found the usual place yet → Jeanne suggests they ask her to dig
//   into her memory (no row, no seat: the server only says that this step is the current one);
// - "humour": a few funny words to fill a long silence, at most a few per conversation.
// Silence = nobody speaking on either side, no gesture, no window change (see `activityKey`).
import { useCallback, useEffect, useRef } from "react";

export type NudgeKind = "humour" | "memory";

export const HUMOUR_QUIET_MS = 45_000;
export const HUMOUR_GAP_MS = 120_000;
export const HUMOUR_MAX = 3;
export const MEMORY_STUCK_MS = 90_000;
export const MEMORY_QUIET_MS = 20_000;

interface Args {
  /** Live, mic open, nothing blocking (sheet, decision, farewell, era switch). */
  enabled: boolean;
  /** The character is talking right now. */
  speaking: boolean;
  /** Changes whenever something happens on screen (revision, window, era...). */
  activityKey: string;
  /** The current step is "find the usual place" (server flag, no detail). */
  memoryStep: boolean;
  onNudge: (kind: NudgeKind) => void;
}

export function useIdleNudges({ enabled, speaking, activityKey, memoryStep, onNudge }: Args) {
  const last = useRef(0);
  const humour = useRef({ count: 0, at: 0 });
  const memory = useRef({ since: 0, sent: false });
  const args = useRef({ enabled, speaking, memoryStep, onNudge });
  useEffect(() => {
    args.current = { enabled, speaking, memoryStep, onNudge };
  });

  // Anything that happens counts as activity.
  useEffect(() => {
    last.current = Date.now();
  }, [speaking, activityKey]);

  // The "stuck on the usual place" clock runs while the step is current, even in silence.
  useEffect(() => {
    memory.current = memoryStep ? { since: Date.now(), sent: false } : { since: 0, sent: false };
  }, [memoryStep]);

  useEffect(() => {
    if (!enabled) return;
    last.current = Date.now();
    humour.current = { count: 0, at: 0 };
    const id = setInterval(() => {
      const a = args.current;
      const now = Date.now();
      if (!a.enabled || a.speaking) return;
      const quiet = now - last.current;
      const m = memory.current;
      if (a.memoryStep && !m.sent && m.since && now - m.since >= MEMORY_STUCK_MS && quiet >= MEMORY_QUIET_MS) {
        m.sent = true;
        last.current = now;
        a.onNudge("memory");
        return;
      }
      const h = humour.current;
      if (quiet >= HUMOUR_QUIET_MS && h.count < HUMOUR_MAX && now - h.at >= HUMOUR_GAP_MS) {
        h.count += 1;
        h.at = now;
        last.current = now;
        a.onNudge("humour");
      }
    }, 2000);
    return () => clearInterval(id);
  }, [enabled]);

  /** The player spoke or typed. */
  const touch = useCallback(() => {
    last.current = Date.now();
  }, []);
  return { touch };
}
