"use client";
// Object inspector: the object (or a close-up of the set) next to its DOM text (selectable) and the
// actions the server says are available. Texts come from the server projection only.
// A simple reading (report, programme, letter) runs on opening — no extra confirmation — but only
// when the server lists it as available, once per opening; nothing is shown as found before the
// server answers. Turning the photo over and unfolding the message stay explicit gestures.
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useT } from "@/i18n/I18nProvider";
import { FUN_EN, FUN_FR } from "@/i18n/fun2056";
import { useLocale } from "@/i18n/I18nProvider";
import { CLOSEUPS, funCloseup, objectImage, sceneImage } from "./scene-config";
import type { Action, PublicState, Stage } from "./types";

type Act = (action: Action, args?: Record<string, unknown>) => Promise<unknown>;

const LOCATION_IDS = ["drawer", "desk", "lower_cabinet", "upper_cabinet", "floor"] as const;

/** Readings that run when their document is opened (pure reads, no consequence to confirm). */
const AUTO_READ: Partial<Record<string, Action>> = { archiveReport: "inspect_waterline", programme: "inspect_programme", letter: "read_letter" };

function Closeup({ id, era, open }: { id: string; era: Stage; open: boolean }) {
  const c = CLOSEUPS[id] ?? funCloseup(id);
  if (!c) return null;
  const pos = (v: number, size: number) => (size >= 1 ? "0%" : `${((v / (1 - size)) * 100).toFixed(2)}%`);
  return (
    <div
      className="closeup"
      aria-hidden="true"
      style={{
        aspectRatio: String((c.w * 1672) / (c.h * 941)),
        backgroundImage: `url(${sceneImage(era, open)}-1672.webp)`,
        backgroundSize: `${(100 / c.w).toFixed(2)}% auto`,
        backgroundPosition: `${pos(c.x, c.w)} ${pos(c.y, c.h)}`,
      }}
    />
  );
}

function ActionButton({ action, args, children, can, act }: { action: Action; args?: Record<string, unknown>; children: React.ReactNode; can: (a: Action) => boolean; act: Act }) {
  if (!can(action)) return null;
  return (
    <button type="button" className="btn btn--brass" onClick={() => act(action, args)}>
      {children}
    </button>
  );
}

export function ObjectInspector({ id, era, view, onClose, act, openComposer }: { id: string | null; era: Stage; view: PublicState; onClose: () => void; act: Act; openComposer: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [location, setLocation] = useState("drawer");
  const [seat, setSeat] = useState("");
  const fired = useRef<string | null>(null);
  const auto = id ? AUTO_READ[id] : undefined;
  const autoReady = Boolean(auto && view.availableActions.includes(auto));
  useEffect(() => {
    if (!id) {
      fired.current = null;
      return;
    }
    if (auto && autoReady && fired.current !== id) {
      fired.current = id; // once per opening, StrictMode-safe
      void act(auto);
    }
  }, [id, auto, autoReady, act]);
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
          {era === 1996 && (can("share_photo_note") ? <ActionButton can={can} act={act} action="share_photo_note">{t.inspector.photoShare}</ActionButton> : <p className="muted">{t.inspector.photoShared}</p>)}
          {era === 1996 && <ActionButton can={can} act={act} action="ask_usual_place">{t.inspector.photoAskPlace}</ActionButton>}
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
          {era === 1996 && <ActionButton can={can} act={act} action="share_report">{t.inspector.waterReport}</ActionButton>}
          {era === 1996 && !can("relay_flood_warning") && !can("share_report") && <p className="muted">{t.inspector.waterShared}</p>}
          {era === 2026 && <p className="muted">{t.inspector.waterNot1996}</p>}
        </>
      ) : (
        <>
          <p>{t.inspector.waterDesc}</p>
          {can("inspect_waterline") && <p className="muted" role="status">{t.inspector.reading}</p>}
        </>
      );
      break;
    }
    case "programme": {
      title = t.inspector.programmeTitle;
      asset = "screening-programme";
      const n = note("programme");
      body = n ? <p className="doc doc--typed">{n.text}</p> : (<><p>{t.inspector.programmeDesc}</p>{can("inspect_programme") && <p className="muted" role="status">{t.inspector.reading}</p>}</>);
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
          {era === 1996 && !view.acknowledged && <ActionButton can={can} act={act} action="acknowledge_permission">{t.inspector.acknowledge}</ActionButton>}
          {era === 1996 && view.acknowledged && <p className="muted">{t.inspector.acknowledged}</p>}
        </>
      ) : (
        <>
          <p>{t.inspector.letterDesc}</p>
          {can("read_letter") && <p className="muted" role="status">{t.inspector.reading}</p>}
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
          {!can("retrieve_key") && !view.scene.keyInHand1996 && !view.scene.cabinetOpen1996 && !view.scene.reelStoredHigh && (
            // The player's own deduction: a free seat, checked by the server (no answer here).
            <form
              className="seat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (seat.trim()) void act("propose_seat", { seat: seat.trim() });
              }}
            >
              <label htmlFor="seat">{t.inspector.seatLabel}</label>
              <div className="say">
                <input id="seat" value={seat} maxLength={60} autoComplete="off" placeholder={t.inspector.seatPlaceholder} onChange={(e) => setSeat(e.target.value)} />
                <button type="submit" className="btn btn--brass" disabled={!seat.trim()}>{t.inspector.seatSubmit}</button>
              </div>
            </form>
          )}
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
      body = era === 1996 ? <p>{t.inspector.projector1996}</p> : (
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
          <ActionButton can={can} act={act} action="preserve_cache" args={{ location }}>{t.inspector.shelfStore}</ActionButton>
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
            <figure className="sheet sheet--aged">
              <figcaption className="sheet__label">{t.inspector.cacheMessageCaption}</figcaption>
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
      body = view.message.recovered ? (
        <figure className="sheet sheet--aged">
          <figcaption className="sheet__label">{t.inspector.cacheMessageCaption}</figcaption>
          <p className="paper__text">{view.message.recovered}</p>
        </figure>
      ) : null;
      break;
    }
    case "rowMemory": {
      title = t.inspector.rowMemoryTitle;
      const n = note("rowMemory");
      body = n ? <p className="doc doc--hand">{n.text}</p> : null;
      break;
    }
    case "reels":
      title = t.inspector.reelsTitle;
      body = <p>{era === 1996 ? t.inspector.reels1996 : t.inspector.reels2026}</p>;
      break;
    case "lamp":
      title = t.inspector.lampTitle;
      body = <p>{era === 1996 ? t.inspector.lamp1996 : t.inspector.lamp2026}</p>;
      break;
    case "splicer":
      title = t.inspector.splicerTitle;
      body = <p>{t.inspector.splicer1996}</p>;
      break;
    case "chest":
      title = t.inspector.chestTitle;
      body = <p>{t.inspector.chestDesc}</p>;
      break;
    case "seats":
      title = t.inspector.seatsTitle;
      body = <p>{t.inspector.seats2026}</p>;
      break;
    case "key":
    case "futureKey":
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
    default: {
      // The secret 2056 booth: a title and an absurd fun fact, nothing else.
      const fun = (locale === "en" ? FUN_EN : FUN_FR)[id];
      if (fun) {
        title = fun.title;
        body = <p className="funfact">{fun.text}</p>;
      }
    }
  }

  if (!title) return <Dialog open={false} title="" onClose={onClose}>{null}</Dialog>;
  const openNow = era === 1996 ? view.scene.cabinetOpen1996 : view.scene.cabinetOpen2026;
  const visual = asset ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="inspect__img" src={objectImage(asset, 640)} alt="" aria-hidden="true" />
  ) : CLOSEUPS[id] || funCloseup(id) ? (
    <Closeup id={id} era={id === "archiveReport" ? 2026 : era} open={id === "archiveReport" ? false : openNow} />
  ) : null;
  return (
    <Dialog open title={title} onClose={onClose} wide={Boolean(visual)}>
      <div className={`inspect${visual ? "" : " inspect--text"}`}>
        {visual && <div className="inspect__visual">{visual}</div>}
        <div className="inspect__body">
          {body}
          {(id === "letter" || id === "shelf" || id === "cache") && can("close_cabinet") && (
            <button type="button" className="btn" onClick={() => { void act("close_cabinet"); onClose(); }}>{t.inspector.cabinetClose}</button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
