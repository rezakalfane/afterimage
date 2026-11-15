"use client";
// Display preferences shared by the home Settings and the in-game Menu (per browser).
import { useEffect, useState } from "react";

export type DisplaySettings = { large: boolean; reduceMotion: boolean; showObjects: boolean };
const KEY = "afterimage.settings";
const DEFAULTS: DisplaySettings = { large: false, reduceMotion: false, showObjects: false };

function read(): DisplaySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>(read);
  useEffect(() => {
    const d = document.documentElement.dataset;
    d.large = String(settings.large);
    d.reduceMotion = String(settings.reduceMotion);
    d.showObjects = String(settings.showObjects);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
  }, [settings]);
  return [settings, setSettings] as const;
}
