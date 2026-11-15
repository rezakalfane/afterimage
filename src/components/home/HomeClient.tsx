"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/game/api";
import { useT } from "@/i18n/I18nProvider";
import { LanguageChoice, LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { Dialog } from "@/components/ui/Dialog";
import { FacadeSign } from "@/components/ui/FacadeSign";
import { DisplayChoices } from "@/components/ui/DisplayChoices";

export function HomeClient({ mode, runs, signedIn, isAdmin }: { mode: "rehearsal" | "live"; runs: { id: string; status: string; retired?: boolean; updatedAt: number }[]; signedIn: boolean; isAdmin: boolean }) {
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

  // Only a game of the current chapter version is offered for resuming.
  const playable = runs.filter((r) => !r.retired);
  const resume = playable.find((r) => r.status === "active") ?? playable[0];

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
        <FacadeSign main={h.marquee} sub={h.marqueeSub} label={h.facadeAlt} />
      </div>
      <div className="home__panel">
        <LanguageSwitch />
        <h1 className="home__title">AFTERIMAGE</h1>
        <p className="home__subtitle">{h.subtitle}</p>
        <p className="home__pitch">{h.pitch}</p>
        <p className="home__pitch2">{h.pitch2}</p>
        <div className="btn-row">
          {resume && <Link className="btn btn--brass btn--big" href={`/play/${resume.id}`}>{h.resume}</Link>}
          <button type="button" className={`btn btn--big${resume ? "" : " btn--brass"}`} onClick={start} disabled={busy || !hydrated}>{busy ? h.opening : h.start}</button>
        </div>
        {resume && <p className="muted small home__newnote">{h.newNote}</p>}
        <div className="btn-row home__secondary">
          <button type="button" className="btn btn--quiet" onClick={() => setSettingsOpen(true)}>{h.settings}</button>
        </div>
        <Dialog open={settingsOpen} title={h.settings} onClose={() => setSettingsOpen(false)}>
          <div className="settings">
            <LanguageChoice />
            <DisplayChoices withObjects />
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
