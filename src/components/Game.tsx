"use client";

// The game screen: era switch, scene, the live character call, inventory, and the VHS tape.
// Visual design is a placeholder; the art direction comes from the scenario team.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ERAS, LOCALES, WORLD, characterForEra, tr, type Era, type Locale } from "@/lib/content";
import { ui } from "@/i18n/ui";
import type { WorldEvent, WorldView } from "@/lib/world/world";
import { CharacterCall } from "./CharacterCall";
import { VhsPlayer } from "./VhsPlayer";

export function Game({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [era, setEra] = useState<Era>("1996");
  const [view, setView] = useState<WorldView | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [timelineFlash, setTimelineFlash] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
    fetch("/api/world").then((r) => r.json()).then(setView).catch(() => {});
  }, [locale]);

  const onWorld = useCallback((v: WorldView, events: WorldEvent[]) => {
    setView(v);
    for (const e of events) {
      if (e.type === "highlight") setHighlight(e.locationId);
      if (e.type === "timeline_changed") {
        setTimelineFlash(true);
        setTimeout(() => setTimelineFlash(false), 4000);
      }
    }
  }, []);

  async function newGame() {
    setView(await (await fetch("/api/world", { method: "DELETE" })).json());
    setEra("1996");
    setHighlight(null);
  }

  const character = characterForEra(era);
  const eraDef = WORLD.eras[era];
  const items = view?.inventory[era] ?? WORLD.startingInventory;
  const highlighted = highlight ? WORLD.locations.find((l) => l.id === highlight) : null;

  return (
    <div className="game" data-era={era}>
      <header className="topbar">
        <h1 className="brand">{WORLD.title}</h1>
        <p className="subtitle">{tr(WORLD.subtitle, locale)}</p>
        <div className="topbar-controls">
          <div className="era-switch" role="group" aria-label={ui(locale, "era")}>
            {ERAS.map((e) => (
              <button key={e} type="button" aria-pressed={era === e} onClick={() => setEra(e)}>{e}</button>
            ))}
          </div>
          <label className="lang">
            <span className="sr-only">{ui(locale, "language")}</span>
            <select id="locale" value={locale} onChange={(ev) => router.push(`/${ev.target.value}`)}>
              {Object.entries(LOCALES).map(([code, l]) => (
                <option key={code} value={code}>{l.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={newGame}>{ui(locale, "newGame")}</button>
        </div>
      </header>

      <main className="stage">
        <section className="scene" style={{ backgroundImage: `url(${eraDef.scene})` }}>
          <h2>{tr(eraDef.sceneTitle, locale)}</h2>
          <p className="objective">{tr(eraDef.objective, locale)}</p>
          {highlighted && <p className="hotspot">{tr(highlighted.label, locale)}</p>}
          {timelineFlash && <p className="timeline-flash">{ui(locale, "pastChanged")}</p>}
          {era === "2026" && view?.inventory["2026"].includes("message") && (
            <VhsPlayer locale={locale} hasCassette={view.inventory["2026"].includes("cassette")} fallbackMessage={view.message} />
          )}
        </section>
        {/* key: a new call per era and locale — the previous session is destroyed on unmount */}
        <CharacterCall key={`${era}-${locale}`} character={character.id} locale={locale} onWorld={onWorld} />
      </main>

      <footer className="inventory">
        <span className="eyebrow">{ui(locale, "inventory")}</span>
        <ul>
          {items.map((id) => (
            <li key={id}>{tr(WORLD.items[id].label, locale)}</li>
          ))}
        </ul>
        <span className="note">{ui(locale, "conceptNote")}</span>
      </footer>
    </div>
  );
}
