"use client";
// Object inspector: image + DOM text (selectable) + the actions the server says are available.
// Texts come from the server projection only; nothing undiscovered is known here.
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useT } from "@/i18n/I18nProvider";
import { objectImage } from "./scene-config";
import type { Action, Era, PublicState } from "./types";

type Act = (action: Action, args?: Record<string, unknown>) => Promise<unknown>;

const LOCATION_IDS = ["upper_cabinet", "lower_cabinet", "desk", "floor"] as const;

function ActionButton({ action, args, children, tone, can, act }: { action: Action; args?: Record<string, unknown>; children: React.ReactNode; tone?: "decision"; can: (a: Action) => boolean; act: Act }) {
  if (!can(action)) return null;
  return (
    <button type="button" className={`btn ${tone === "decision" ? "btn--decision" : "btn--brass"}`} onClick={() => act(action, args)}>
      {children}
    </button>
  );
}

export function ObjectInspector({ id, era, view, onClose, act, openComposer }: { id: string | null; era: Era; view: PublicState; onClose: () => void; act: Act; openComposer: () => void }) {
  const t = useT();
  const [location, setLocation] = useState("upper_cabinet");
  if (!id) return <Dialog open={false} title="" onClose={onClose}>{null}</Dialog>;
  const note = (k: string) => view.notebook.find((n) => n.id === k);
  const can = (a: Action) => view.availableActions.includes(a);
  let title = "";
  let asset: string | null = null;
  let body: React.ReactNode = null;

  switch (id) {
    case "photo": {
      title = t.inspector.photoTitle;
      asset = "cinema-photo";
      const n = note("photo");
      body = n ? (
        <>
          <p className="doc__label">{t.inspector.photoBackLabel}</p>
          <p className="doc doc--hand">{n.text}</p>
          {era === 1996 && <ActionButton can={can} act={act} action="relay_key_location">{t.inspector.photoRelay}</ActionButton>}
          {era === 2026 && <p className="muted">{t.inspector.photoNot1996}</p>}
        </>
      ) : (
        <>
          <p>{t.inspector.photoDesc}</p>
          <ActionButton can={can} act={act} action="inspect_photo">{t.inspector.photoTurn}</ActionButton>
          {era !== 2026 && <p className="muted">{t.inspector.photoOtherEra}</p>}
        </>
      );
      break;
    }
    case "archiveReport": {
      title = t.inspector.waterTitle;
      const n = note("archiveReport");
      body = n ? (
        <>
          <p className="doc doc--typed">{n.text}</p>
          {era === 1996 && <ActionButton can={can} act={act} action="relay_flood_warning">{t.inspector.waterRelay}</ActionButton>}
          {era === 2026 && <p className="muted">{t.inspector.waterNot1996}</p>}
        </>
      ) : (
        <>
          <p>{t.inspector.waterDesc}</p>
          <ActionButton can={can} act={act} action="inspect_waterline">{t.inspector.waterRead}</ActionButton>
        </>
      );
      break;
    }
    case "programme": {
      title = t.inspector.programmeTitle;
      asset = "screening-programme";
      const n = note("programme");
      body = n ? <p className="doc doc--typed">{n.text}</p> : (<><p>{t.inspector.programmeDesc}</p><ActionButton can={can} act={act} action="inspect_programme">{t.inspector.programmeRead}</ActionButton></>);
      break;
    }
    case "letter":
    case "futureLetter": {
      title = t.inspector.letterTitle;
      asset = "consent-letter";
      const n = note(id === "letter" ? "letter" : "futureLetter") ?? note("letter");
      body = n ? (
        <>
          <p className="doc doc--hand">{n.text}</p>
          {era === 1996 && !view.acknowledged && <ActionButton can={can} act={act} action="acknowledge_permission" tone="decision">{t.inspector.acknowledge}</ActionButton>}
          {era === 1996 && view.acknowledged && <p className="muted">{t.inspector.acknowledged}</p>}
        </>
      ) : (
        <>
          <p>{t.inspector.letterDesc}</p>
          <ActionButton can={can} act={act} action="read_letter">{t.inspector.letterRead}</ActionButton>
          {!can("read_letter") && <p className="muted">{t.inspector.letterNeedProgramme}</p>}
        </>
      );
      break;
    }
    case "hall": {
      title = t.inspector.hallTitle;
      body = (
        <>
          <p>{t.inspector.hallDesc}</p>
          <ActionButton can={can} act={act} action="retrieve_key">{t.inspector.hallSearch}</ActionButton>
          {!can("retrieve_key") && !view.scene.keyInHand1996 && <p className="muted">{t.inspector.hallNeedClue}</p>}
        </>
      );
      break;
    }
    case "cabinet": {
      title = t.inspector.cabinetTitle;
      body = era === 1996 ? (
        <>
          <p>{t.inspector.cabinet1996}</p>
          <ActionButton can={can} act={act} action="open_cabinet">{t.inspector.cabinetOpen}</ActionButton>
          {!can("open_cabinet") && <p className="muted">{t.inspector.cabinetNoKey}</p>}
        </>
      ) : (
        <>
          <p>{t.inspector.cabinet2026}</p>
          <ActionButton can={can} act={act} action="recover_cache">{t.inspector.cabinetOpen}</ActionButton>
          {!can("recover_cache") && <p className="muted">{t.inspector.cabinetLocked2026}</p>}
        </>
      );
      break;
    }
    case "projector": {
      title = t.inspector.projectorTitle;
      body = (
        <>
          <p>{t.inspector.projectorDesc}</p>
          <ActionButton can={can} act={act} action="find_future_key">{t.inspector.projectorSearch}</ActionButton>
          {!can("find_future_key") && <p className="muted">{t.inspector.projectorNothing}</p>}
        </>
      );
      break;
    }
    case "shelf": {
      title = t.inspector.shelfTitle;
      body = view.message.sealed ? (
        <p>{t.inspector.shelfSealed}</p>
      ) : (
        <>
          <p>{t.inspector.shelfAsk}</p>
          <fieldset className="choices">
            <legend className="sr-only">{t.inspector.shelfLocation}</legend>
            {LOCATION_IDS.map((id) => (
              <label key={id} className="choice">
                <input type="radio" name="loc" value={id} checked={location === id} onChange={() => setLocation(id)} /> {t.inspector.locations[id]}
              </label>
            ))}
          </fieldset>
          <ActionButton can={can} act={act} action="preserve_cache" args={{ location }} tone="decision">{t.inspector.shelfStore}</ActionButton>
          {!can("preserve_cache") && <p className="muted">{t.inspector.shelfMissing}</p>}
          {!view.message.confirmed && <button type="button" className="btn" onClick={openComposer}>{t.inspector.shelfWrite}</button>}
        </>
      );
      break;
    }
    case "cache": {
      title = t.inspector.cacheTitle;
      body = (
        <>
          <ul className="found">
            <li>{t.inspector.cacheReel}</li>
            <li>{t.inspector.cacheEnvelope}</li>
            <li>{t.inspector.cachePaper}</li>
          </ul>
          {view.message.recovered ? (
            <figure className="paper">
              <figcaption>{t.inspector.cacheMessageCaption}</figcaption>
              <p className="paper__text">{view.message.recovered}</p>
            </figure>
          ) : (
            <ActionButton can={can} act={act} action="read_message">{t.inspector.cacheUnfold}</ActionButton>
          )}
          {note("futureLetter") ? <p className="doc doc--hand">{note("futureLetter")!.text}</p> : <ActionButton can={can} act={act} action="read_future_letter">{t.inspector.cacheReadLetter}</ActionButton>}
        </>
      );
      break;
    }
    case "message": {
      title = t.inspector.messageTitle;
      asset = "message-paper";
      body = view.message.recovered ? <p className="paper__text">{view.message.recovered}</p> : null;
      break;
    }
    case "key":
      title = t.inspector.keyTitle;
      asset = "brass-key";
      body = <p>{t.inspector.keyDesc}</p>;
      break;
    case "reel":
      title = t.inspector.reelTitle;
      asset = "film-canister";
      body = <p>{t.inspector.reelDesc}</p>;
      break;
    case "envelope":
      title = t.inspector.envelopeTitle;
      asset = "sealed-envelope";
      body = <p>{t.inspector.envelopeDesc}</p>;
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
