"use client";
// The cabin: the image keeps its exact ratio, hotspots and object overlays are DOM layers in
// image-normalized coordinates. Variants and overlays follow the SERVER projection only.
import { useT } from "@/i18n/I18nProvider";
import { fmt } from "@/i18n/messages";
import { HOTSPOTS, OVERLAYS, SCENE_RATIO, objectImage, sceneImage } from "./scene-config";
import type { Era, PublicState } from "./types";

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

export function SceneViewport({ era, view, onHotspot, pulse }: { era: Era; view: PublicState; onHotspot: (id: string) => void; pulse: string | null }) {
  const t = useT().scene;
  const label = (id: string) => t.hotspots[id] ?? id;
  const open = era === 1996 ? view.scene.cabinetOpen1996 : view.scene.cabinetOpen2026;
  const src = sceneImage(era, open);
  const spots = HOTSPOTS[era].filter((h) => !h.when || (h.when === "open") === open);
  const seen = new Set(view.notebook.map((n) => n.id));
  const overlays: { key: string; asset: string; rect: { x: number; y: number; w: number }; alt: string }[] = [];
  if (era === 2026 && !open) overlays.push({ key: "photo", ...OVERLAYS.photo2026, alt: "" });
  if (era === 2026 && open) {
    overlays.push({ key: "reel", ...OVERLAYS.reelHigh, alt: "" }, { key: "env", ...OVERLAYS.envelopeHigh, alt: "" }, { key: "msg", ...OVERLAYS.messageHigh, alt: "" });
  }
  if (era === 1996) overlays.push({ key: "prog", ...OVERLAYS.programme1996, alt: "" });
  if (era === 1996 && open) overlays.push({ key: "letter", ...OVERLAYS.letterInCabinet, alt: "" }, { key: "reel", ...OVERLAYS.reelInCabinet, alt: "" });

  return (
    <section className={`scene scene--${era}`} aria-label={fmt(t.region, { era })}>
      <div className="scene__frame" style={{ aspectRatio: String(SCENE_RATIO) }}>
        <picture>
          <source media="(max-width: 900px)" srcSet={`${src}-960.webp`} />
          <img key={src} className="scene__img" src={`${src}-1672.webp`} alt={era === 1996 ? t.alt1996 : t.alt2026} />
        </picture>
        {overlays.map((o) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={o.key} className="scene__obj" src={objectImage(o.asset)} alt={o.alt} style={{ left: pct(o.rect.x), top: pct(o.rect.y), width: pct(o.rect.w) }} aria-hidden="true" />
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
