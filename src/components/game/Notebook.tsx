"use client";
// The notebook: observations and objects per era (not a magic pocket: each card shows its year).
import { objectImage } from "./scene-config";
import type { Era, NotebookEntry } from "./types";

export function Notebook({ entries, era, onOpen }: { entries: NotebookEntry[]; era: Era; onOpen: (id: string) => void }) {
  return (
    <section className="notebook" aria-label="Carnet">
      <div className="notebook__label">
        <span className="eyebrow">Le carnet</span>
        <p>{entries.length ? `${entries.length} trace${entries.length > 1 ? "s" : ""}` : "Encore vide"}</p>
      </div>
      <ul className="notebook__items">
        {entries.length === 0 && <li className="notebook__empty">Examinez le décor : ce que vous découvrez s’inscrit ici.</li>}
        {entries.map((e) => (
          <li key={e.id}>
            <button type="button" className={`card${e.era !== era ? " card--other-era" : ""}`} onClick={() => onOpen(e.id)}>
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
