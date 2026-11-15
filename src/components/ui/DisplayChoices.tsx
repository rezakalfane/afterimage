"use client";
// Display options (home Settings and in-game Menu). Native checkboxes, keyboard-friendly.
import { useT } from "@/i18n/I18nProvider";
import { useDisplaySettings } from "./useDisplaySettings";

export function DisplayChoices({ withObjects = false }: { withObjects?: boolean }) {
  const t = useT();
  const [s, set] = useDisplaySettings();
  return (
    <fieldset className="choices">
      <legend>{t.home.display}</legend>
      <label className="choice"><input type="checkbox" checked={s.large} onChange={(e) => set({ ...s, large: e.target.checked })} /> {t.home.largeText}</label>
      <label className="choice"><input type="checkbox" checked={s.reduceMotion} onChange={(e) => set({ ...s, reduceMotion: e.target.checked })} /> {t.home.reduceMotion}</label>
      {withObjects && <label className="choice"><input type="checkbox" checked={s.showObjects} onChange={(e) => set({ ...s, showObjects: e.target.checked })} /> {t.game.showObjects}</label>}
    </fieldset>
  );
}
