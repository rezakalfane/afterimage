"use client";

// Plays Jeanne's tape (a Napster pre-recorded video) with a VHS look, or falls back to the
// handwritten letter when recordings are unavailable or not ready.
import { useEffect, useState } from "react";
import { WORLD, type Locale } from "@/lib/content";
import { ui } from "@/i18n/ui";

interface Props {
  locale: Locale;
  hasCassette: boolean;
  fallbackMessage: string | null;
}

export function VhsPlayer({ locale, hasCassette, fallbackMessage }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(hasCassette ? "pending" : "unavailable");

  useEffect(() => {
    if (!hasCassette) return;
    let stopped = false;
    async function poll() {
      const r = await fetch("/api/vhs").then((x) => x.json()).catch(() => null);
      if (stopped || !r) return;
      setStatus(r.status);
      if (r.url) return setUrl(r.url);
      if (r.status === "pending") setTimeout(poll, 4000);
    }
    void poll();
    return () => {
      stopped = true;
    };
  }, [hasCassette]);

  if (url) {
    return (
      <figure className="vhs">
        <figcaption className="eyebrow">{ui(locale, "vhsFound")}</figcaption>
        <div className="vhs-screen">
          <video src={url} controls playsInline />
          <span className="vhs-date">{WORLD.vhs.date}</span>
        </div>
      </figure>
    );
  }
  if (hasCassette && status === "pending") {
    return <p className="vhs-wait">{ui(locale, "vhsRendering")}</p>;
  }
  return (
    <figure className="letter">
      <figcaption className="eyebrow">{ui(locale, "letterFound")}</figcaption>
      <blockquote>{fallbackMessage}</blockquote>
    </figure>
  );
}
