"use client";
// Object inspector: image + DOM text (selectable) + the actions the server says are available.
// Texts come from the server projection only; nothing undiscovered is known here.
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { objectImage } from "./scene-config";
import type { Action, Era, PublicState } from "./types";

type Act = (action: Action, args?: Record<string, unknown>) => Promise<unknown>;

const LOCATIONS = [
  { id: "upper_cabinet", label: "Étagère haute de l’armoire" },
  { id: "lower_cabinet", label: "Bas de l’armoire" },
  { id: "desk", label: "Sur le bureau" },
  { id: "floor", label: "Au sol, sous le bureau" },
];

function ActionButton({ action, args, children, tone, can, act }: { action: Action; args?: Record<string, unknown>; children: React.ReactNode; tone?: "decision"; can: (a: Action) => boolean; act: Act }) {
  if (!can(action)) return null;
  return (
    <button type="button" className={`btn ${tone === "decision" ? "btn--decision" : "btn--brass"}`} onClick={() => act(action, args)}>
      {children}
    </button>
  );
}

export function ObjectInspector({ id, era, view, onClose, act, openComposer }: { id: string | null; era: Era; view: PublicState; onClose: () => void; act: Act; openComposer: () => void }) {
  const [location, setLocation] = useState("upper_cabinet");
  if (!id) return <Dialog open={false} title="" onClose={onClose}>{null}</Dialog>;
  const note = (k: string) => view.notebook.find((n) => n.id === k);
  const can = (a: Action) => view.availableActions.includes(a);
  let title = "";
  let asset: string | null = null;
  let body: React.ReactNode = null;

  switch (id) {
    case "photo": {
      title = "Photographie du Régina";
      asset = "cinema-photo";
      const n = note("photo");
      body = n ? (
        <>
          <p className="doc__label">Au verso, à la main :</p>
          <p className="doc doc--hand">{n.text}</p>
          {era === 1996 && <ActionButton can={can} act={act} action="relay_key_location">Transmettre cet indice à Jeanne</ActionButton>}
          {era === 2026 && <p className="muted">Jeanne, en 1996, ne connaît pas encore cette inscription. Passez en 1996 pour la lui transmettre.</p>}
        </>
      ) : (
        <>
          <p>Une vieille photographie de la façade, posée sur le bureau.</p>
          <ActionButton can={can} act={act} action="inspect_photo">Retourner la photo</ActionButton>
          {era !== 2026 && <p className="muted">La photo se trouve dans la cabine de 2026.</p>}
        </>
      );
      break;
    }
    case "archiveReport": {
      title = "Trace d’humidité";
      const n = note("archiveReport");
      body = n ? (
        <>
          <p className="doc doc--typed">{n.text}</p>
          {era === 1996 && <ActionButton can={can} act={act} action="relay_flood_warning">Avertir Jeanne du risque d’eau</ActionButton>}
          {era === 2026 && <p className="muted">En 1996, personne ne sait encore ce que l’eau fera ici.</p>}
        </>
      ) : (
        <>
          <p>Le bois de l’armoire est marqué d’une ligne claire. Un dossier traîne à côté.</p>
          <ActionButton can={can} act={act} action="inspect_waterline">Lire le rapport de conservation</ActionButton>
        </>
      );
      break;
    }
    case "programme": {
      title = "Programme de la séance";
      asset = "screening-programme";
      const n = note("programme");
      body = n ? <p className="doc doc--typed">{n.text}</p> : (<><p>Un programme plié sur le bureau.</p><ActionButton can={can} act={act} action="inspect_programme">Lire le programme</ActionButton></>);
      break;
    }
    case "letter":
    case "futureLetter": {
      title = "Lettre d’Alice Mercier";
      asset = "consent-letter";
      const n = note(id === "letter" ? "letter" : "futureLetter") ?? note("letter");
      body = n ? (
        <>
          <p className="doc doc--hand">{n.text}</p>
          {era === 1996 && !view.acknowledged && <ActionButton can={can} act={act} action="acknowledge_permission" tone="decision">Je reconnais la condition d’Alice</ActionButton>}
          {era === 1996 && view.acknowledged && <p className="muted">Vous avez reconnu la condition d’Alice.</p>}
        </>
      ) : (
        <>
          <p>Une enveloppe ouverte, une lettre pliée en deux.</p>
          <ActionButton can={can} act={act} action="read_letter">Lire la lettre</ActionButton>
          {!can("read_letter") && <p className="muted">Il faudrait d’abord savoir de quelle séance il s’agit.</p>}
        </>
      );
      break;
    }
    case "hall": {
      title = "La salle";
      body = (
        <>
          <p>Par la vitre, les fauteuils rouges dans la pénombre. Quelque part, la clé du dernier tour de salle.</p>
          <ActionButton can={can} act={act} action="retrieve_key">Demander à Jeanne d’aller chercher la clé à l’endroit indiqué</ActionButton>
          {!can("retrieve_key") && !view.scene.keyInHand1996 && <p className="muted">Chercher où ? Il faudrait un indice précis.</p>}
        </>
      );
      break;
    }
    case "cabinet": {
      title = "Armoire au croissant";
      body = era === 1996 ? (
        <>
          <p>Fermée à clé. La poignée en laiton a la forme d’un croissant de lune.</p>
          <ActionButton can={can} act={act} action="open_cabinet">Ouvrir l’armoire</ActionButton>
          {!can("open_cabinet") && <p className="muted">« Il me manque la clé. Je l’avais pendant mon dernier tour de salle. »</p>}
        </>
      ) : (
        <>
          <p>Fermée depuis longtemps. Le bas du bois a souffert de l’eau.</p>
          <ActionButton can={can} act={act} action="recover_cache">Chercher si quelque chose a changé</ActionButton>
        </>
      );
      break;
    }
    case "projector": {
      title = "Le projecteur";
      body = (
        <>
          <p>Le vieux projecteur 35 mm, couvert de poussière.</p>
          <ActionButton can={can} act={act} action="recover_cache">Chercher derrière le projecteur</ActionButton>
          {!can("recover_cache") && <p className="muted">Rien de particulier derrière le projecteur, pour l’instant.</p>}
        </>
      );
      break;
    }
    case "shelf": {
      title = "Mettre à l’abri";
      body = view.message.sealed ? (
        <p>La bobine, la lettre et vos mots sont rangés. Voyez votre carnet.</p>
      ) : (
        <>
          <p>Jeanne peut ranger la bobine, la lettre et votre message pour trente ans. Où ?</p>
          <fieldset className="choices">
            <legend className="sr-only">Emplacement</legend>
            {LOCATIONS.map((l) => (
              <label key={l.id} className="choice">
                <input type="radio" name="loc" value={l.id} checked={location === l.id} onChange={() => setLocation(l.id)} /> {l.label}
              </label>
            ))}
          </fieldset>
          <ActionButton can={can} act={act} action="preserve_cache" args={{ location }} tone="decision">Demander à Jeanne de tout ranger ici</ActionButton>
          {!can("preserve_cache") && <p className="muted">Il manque encore quelque chose avant de tout ranger. L’aide peut vous orienter.</p>}
          {!view.message.confirmed && <button type="button" className="btn" onClick={openComposer}>Écrire vos mots</button>}
        </>
      );
      break;
    }
    case "cache": {
      title = "Ce que Jeanne a laissé";
      body = (
        <>
          <ul className="found">
            <li>La bobine « Les lumières du Régina »</li>
            <li>Une enveloppe scellée</li>
            <li>Un papier plié</li>
          </ul>
          {view.message.recovered ? (
            <figure className="paper">
              <figcaption>Votre message, trente ans plus tard</figcaption>
              <p className="paper__text">{view.message.recovered}</p>
            </figure>
          ) : (
            <ActionButton can={can} act={act} action="read_message">Déplier le papier</ActionButton>
          )}
          {note("futureLetter") ? <p className="doc doc--hand">{note("futureLetter")!.text}</p> : <ActionButton can={can} act={act} action="read_future_letter">Lire la lettre de l’enveloppe</ActionButton>}
        </>
      );
      break;
    }
    case "message": {
      title = "Votre message";
      asset = "message-paper";
      body = view.message.recovered ? <p className="paper__text">{view.message.recovered}</p> : null;
      break;
    }
    case "key":
      title = "Clé au croissant";
      asset = "brass-key";
      body = <p>Une petite clé en laiton. Elle ouvre l’armoire au croissant.</p>;
      break;
    case "reel":
      title = "La bobine";
      asset = "film-canister";
      body = <p>« Les lumières du Régina », un film d’Alice Mercier. Trente ans au sec.</p>;
      break;
    case "envelope":
      title = "Enveloppe scellée";
      asset = "sealed-envelope";
      body = <p>Elle contenait la lettre d’Alice.</p>;
      break;
  }

  return (
    <Dialog open title={title} onClose={onClose}>
      <div className="inspect">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {asset && <img className="inspect__img" src={objectImage(asset, 640)} alt="" aria-hidden="true" />}
        <div className="inspect__body">{body}</div>
      </div>
    </Dialog>
  );
}
