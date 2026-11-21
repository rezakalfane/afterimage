"use client";
// Ambient bed of the booth with a mute button. Starts at the player's first gesture (autoplay
// policy), follows the era, lowers itself while the companion talks, pauses with the tab.
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/i18n/I18nProvider";
import { createAmbient, type Ambient } from "./ambient";
import type { Era } from "./types";

const KEY = "afterimage.ambient";
/** Switched off for now: the procedural bed is kept until the real sounds are chosen. */
export const AMBIENT_ENABLED = false;

export function AmbientSound({ era, speaking }: { era: Era; speaking: boolean }) {
  const t = useT().character;
  const [muted, setMuted] = useState(false);
  const ambient = useRef<Ambient | null>(null);
  const state = useRef({ era, speaking, muted });
  useEffect(() => {
    state.current = { era, speaking, muted };
    ambient.current?.setEra(era);
    ambient.current?.setDucked(speaking);
    ambient.current?.setMuted(muted);
  });

  // Saved choice, read after mount (no storage on the server).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after hydration
      if (localStorage.getItem(KEY) === "off") setMuted(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Start on the first gesture; never twice.
  useEffect(() => {
    const start = () => {
      if (ambient.current) return;
      const s = state.current;
      ambient.current = createAmbient(s.era, s.muted);
      ambient.current?.setDucked(s.speaking);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    const vis = () => (document.hidden ? ambient.current?.suspend() : ambient.current?.resume());
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      document.removeEventListener("visibilitychange", vis);
      ambient.current?.destroy();
      ambient.current = null;
    };
  }, []);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(KEY, next ? "off" : "on");
    } catch {
      /* storage unavailable */
    }
    // The click is a gesture: start the bed now if it was not running yet.
    if (!ambient.current && !next) {
      ambient.current = createAmbient(era, false);
      ambient.current?.setDucked(speaking);
    }
  };

  return (
    <button type="button" className="ambient-toggle" aria-pressed={!muted} aria-label={muted ? t.ambientOn : t.ambientOff} data-tip={muted ? t.ambientOn : t.ambientOff} onClick={toggle}>
      <Icon name={muted ? "soundOff" : "sound"} size={18} />
    </button>
  );
}
