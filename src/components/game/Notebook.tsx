"use client";
// The notebook: observations and objects per era (not a magic pocket: each card shows its year).
import { useT } from "@/i18n/I18nProvider";
import { fmt } from "@/i18n/messages";
import { objectImage } from "./scene-config";
import type { Era, NotebookEntry } from "./types";

export function Notebook({ entries, era, onOpen }: { entries: NotebookEntry[]; era: Era; onOpen: (id: string) => void }) {
  const t = useT().notebook;
  return (
    <section className="notebook" aria-label={t.region}>
      <div className="notebook__label">
        <span className="eyebrow">{t.label}</span>
        <p>{entries.length ? fmt(entries.length > 1 ? t.countPlural : t.count, { n: entries.length }) : t.empty}</p>
      </div>
      <ul className="notebook__items">
        {entries.length === 0 && <li className="notebook__empty">{t.emptyHint}</li>}
        {entries.map((e) => (
          <li key={e.id}>
            <button type="button" className={`card${e.era !== era ? " card--other-era" : ""}`} onClick={() => onOpen(e.id)} aria-label={`${e.title}, ${e.era}`} title={`${e.title} · ${e.era}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.asset ? <img src={objectImage(e.asset as string)} alt="" aria-hidden="true" /> : <span className="card__paper" aria-hidden="true" />}
              <span className="card__text">
                <span className="card__title">{e.title}</span>
                <span className="card__era">{e.era}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
