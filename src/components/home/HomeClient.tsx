"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/game/api";
import { useT } from "@/i18n/I18nProvider";
import { LanguageChoice, LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { Dialog } from "@/components/ui/Dialog";

type Settings = { large: boolean; reduceMotion: boolean };
const KEY = "afterimage.settings";
function readSettings(): Settings {
  if (typeof window === "undefined") return { large: false, reduceMotion: false };
  try {
    return { large: false, reduceMotion: false, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { large: false, reduceMotion: false };
  }
}

export function HomeClient({ mode, runs, signedIn, isAdmin }: { mode: "rehearsal" | "live"; runs: { id: string; status: string; updatedAt: number }[]; signedIn: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const t = useT();
  const h = t.home;
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration flag
    setHydrated(true);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(readSettings);
  useEffect(() => {
    document.documentElement.dataset.large = String(settings.large);
    document.documentElement.dataset.reduceMotion = String(settings.reduceMotion);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
  }, [settings]);

  const resume = runs.find((r) => r.status === "active") ?? runs[0];

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (!signedIn) {
        const r = await fetch("/api/auth/sign-in/anonymous", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!r.ok) throw new Error(r.status === 429 ? h.tooManyGuests : h.guestFailed);
      }
      const run = await api<{ runId: string }>("/api/runs", { method: "POST" });
      router.push(`/play/${run.runId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <div className="home__facade">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/afterimage/scenes/cinema-exterior-1672.webp" srcSet="/assets/afterimage/scenes/cinema-exterior-960.webp 960w, /assets/afterimage/scenes/cinema-exterior-1672.webp 1672w" sizes="100vw" alt={h.facadeAlt} />
        <p className="marquee" aria-hidden="true">{h.marquee}<small>{h.marqueeSub}</small></p>
      </div>
      <div className="home__panel">
        <LanguageSwitch />
        <h1 className="home__title">AFTERIMAGE</h1>
        <p className="home__subtitle">{h.subtitle}</p>
        <p className="home__pitch">{h.pitch}</p>
        <div className="btn-row">
          <button type="button" className="btn btn--brass btn--big" onClick={start} disabled={busy || !hydrated}>{busy ? h.opening : h.start}</button>
          {resume && <Link className="btn btn--big" href={`/play/${resume.id}`}>{h.resume}</Link>}
          <button type="button" className="btn" onClick={() => setSettingsOpen(true)}>{h.settings}</button>
        </div>
        <Dialog open={settingsOpen} title={h.settings} onClose={() => setSettingsOpen(false)}>
          <div className="settings">
            <LanguageChoice />
            <fieldset className="choices">
              <legend>{h.display}</legend>
              <label className="choice"><input type="checkbox" checked={settings.large} onChange={(e) => setSettings({ ...settings, large: e.target.checked })} /> {h.largeText}</label>
              <label className="choice"><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => setSettings({ ...settings, reduceMotion: e.target.checked })} /> {h.reduceMotion}</label>
            </fieldset>
            <p className="muted small">{h.settingsNote}</p>
          </div>
        </Dialog>
        {error && <p className="warn" role="alert">{error}</p>}
        <p className="home__notice">{mode === "rehearsal" ? h.noticeRehearsal : h.noticeLive} {h.noticeMic}</p>
        <p className="home__links">
          {!signedIn && <Link href="/connexion">{h.signIn}</Link>}
          {isAdmin && <Link href="/admin">{h.admin}</Link>}
          <Link href="/confidentialite">{h.privacy}</Link>
        </p>
      </div>
    </main>
  );
}
