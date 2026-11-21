// Small inline icons (decorative: the button always carries a visible label or an aria-label).
const PATHS: Record<string, string> = {
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm-7 9a7 7 0 0 0 14 0M12 19v3",
  micOff: "M12 3a3 3 0 0 1 3 3v5M9 9v3a3 3 0 0 0 4.6 2.5M5 12a7 7 0 0 0 11.3 5.5M19 12a7 7 0 0 1-.6 2.8M12 19v3M3 3l18 18",
  keyboard: "M3 7h18v10H3zM6.5 10h1M10 10h1M13.5 10h1M17 10h1M7 13.5h10",
  end: "M3 15.5c5-4.7 13-4.7 18 0l-2.4 2.4-3.3-1.6v-2.6a12 12 0 0 0-6.6 0v2.6l-3.3 1.6z",
  expand: "M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7",
  collapse: "M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7",
  menu: "M4 7h16M4 12h16M4 17h16",
  sound: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11",
  soundOff: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l5 5M21 9.5l-5 5",
  grip: "M8 8h.01M12 8h.01M16 8h.01M8 13h.01M12 13h.01M16 13h.01",
};
export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
