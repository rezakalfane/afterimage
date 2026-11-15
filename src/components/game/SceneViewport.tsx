"use client";
// The cabin: the image keeps its exact ratio, hotspots and object overlays are DOM layers in
// image-normalized coordinates. Variants and overlays follow the SERVER projection only.
import { useState } from "react";
import { useT } from "@/i18n/I18nProvider";
import { fmt } from "@/i18n/messages";
import { HOTSPOTS, OVERLAYS, SCENE_RATIO, objectImage, sceneImage, type Overlay } from "./scene-config";
import type { Era, PublicState } from "./types";

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

export function SceneViewport({ era, view, onHotspot, pulse }: { era: Era; view: PublicState; onHotspot: (id: string) => void; pulse: string | null }) {
  const t = useT().scene;
  const label = (id: string) => t.hotspots[id] ?? id;
  const open = era === 1996 ? view.scene.cabinetOpen1996 : view.scene.cabinetOpen2026;
  const src = sceneImage(era, open);
  // Cross-fade: remember the image shown before (derived during render, cleared when its fade ends).
  const [shown, setShown] = useState(src);
  const [prev, setPrev] = useState<string | null>(null);
  if (shown !== src) {
    setPrev(shown);
    setShown(src);
  }
  const spots = HOTSPOTS[era].filter((h) => !h.when || (h.when === "open") === open);
  const seen = new Set(view.notebook.map((n) => n.id));
  const overlays: (Overlay & { key: string })[] = [];
  if (era === 2026 && !open) overlays.push({ key: "photo", ...OVERLAYS.photo2026 });
  if (era === 2026 && open) overlays.push({ key: "env", ...OVERLAYS.envelopeHigh }, { key: "msg", ...OVERLAYS.messageHigh }, { key: "reel", ...OVERLAYS.reelHigh });
  if (era === 1996) overlays.push({ key: "prog", ...OVERLAYS.programme1996 });
  if (era === 1996 && open) {
    // After Jeanne stored everything (server state), the letter and the reel are on the upper shelf.
    if (view.scene.reelStoredHigh) overlays.push({ key: "letter", ...OVERLAYS.letterHigh }, { key: "reel", ...OVERLAYS.reelHigh });
    else overlays.push({ key: "letter", ...OVERLAYS.letterInCabinet }, { key: "reel", ...OVERLAYS.reelInCabinet });
  }

  return (
    <section className={`scene scene--${era}`} aria-label={fmt(t.region, { era })}>
      <div className="scene__frame" style={{ aspectRatio: String(SCENE_RATIO) }}>
        <picture>
          <source media="(max-width: 900px)" srcSet={`${src}-960.webp`} />
          <img key={src} className="scene__img scene__img--now" src={`${src}-1672.webp`} alt={era === 1996 ? t.alt1996 : t.alt2026} />
        </picture>
        {prev && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`prev-${prev}`} className="scene__img scene__img--prev" src={`${prev}-1672.webp`} alt="" aria-hidden="true" onAnimationEnd={() => setPrev(null)} />
        )}
        {overlays.map((o) => (
          <span key={o.key} className={`scene__obj scene__obj--${o.pose ?? "stand"}`} style={{ left: pct(o.x), top: pct(o.base), width: pct(o.w), ["--rot" as string]: `${o.rot ?? 0}deg` }} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={objectImage(o.asset)} alt="" />
          </span>
        ))}
        {spots.map((h) => {
          const available = h.action ? view.availableActions.includes(h.action) : false;
          const done = h.inspect ? seen.has(h.inspect) : false;
          return (
            <button
              key={h.id}
              type="button"
              className={`hotspot${available ? " hotspot--ready" : ""}${done ? " hotspot--done" : ""}${pulse === h.id ? " hotspot--pulse" : ""}`}
              style={{ left: pct(h.rect.x), top: pct(h.rect.y), width: pct(h.rect.w), height: pct(h.rect.h) }}
              onClick={() => onHotspot(h.id)}
              aria-label={label(h.id)}
            >
              <span className="hotspot__dot" aria-hidden="true" />
              <span className="hotspot__label">{label(h.id)}</span>
            </button>
          );
        })}
        {view.ending && <div className="scene__lights" aria-hidden="true" />}
      </div>
      <ul className="scene__list" aria-label={t.list}>
        {spots.map((h) => (
          <li key={h.id}>
            <button type="button" className="linklike" onClick={() => onHotspot(h.id)}>{label(h.id)}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
