// The Régina façade with its marquee letters. Image and letters share ONE coordinate system (the
// 1672×941 source image), so the letters stay on the board whatever the crop ("slice" = cover),
// and each line follows the board's curvature (an arc measured on the image's letter rails).
// Letters look like marquee letters: dark, opaque, slightly shadowed on the lit board.

const W = 1672;
const H = 941;
// Board ≈ x 428–1252; its rails bow upward by ~15 px at the centre (x 840).
const LINE1 = "M 470 418 Q 840 386 1210 418"; // main line (apex ≈ y 402)
const LINE2 = "M 500 450 Q 840 420 1180 450"; // small line (apex ≈ y 435)

/** Font size that keeps a line inside the board (uppercase, tracked). */
function fit(text: string, max: number, room: number, perChar: number) {
  return Math.min(max, room / Math.max(1, Array.from(text).length * perChar));
}

export function FacadeSign({ main, sub, label, tone = "lit", className = "", slice = true }: { main: string; sub: string; label: string; tone?: "lit" | "dim" | "warn"; className?: string; slice?: boolean }) {
  const s1 = fit(main.toUpperCase(), 48, 700, 0.82);
  const s2 = fit(sub.toUpperCase(), 17, 640, 0.92);
  return (
    <svg className={`facade facade--${tone} ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={slice ? "xMidYMid slice" : "xMidYMid meet"} role="img" aria-label={label}>
      <defs>
        <path id="facade-l1" d={LINE1} />
        <path id="facade-l2" d={LINE2} />
        <filter id="facade-letter" x="-5%" y="-30%" width="110%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.8" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      <image className="facade__img" href="/assets/afterimage/scenes/cinema-exterior-1672.webp" width={W} height={H} />
      <g className="facade__letters" filter="url(#facade-letter)" aria-hidden="true">
        <text fontSize={s1} letterSpacing={s1 * 0.14}>
          <textPath href="#facade-l1" startOffset="50%" textAnchor="middle">{main.toUpperCase()}</textPath>
        </text>
        <text fontSize={s2} letterSpacing={s2 * 0.26} className="facade__sub">
          <textPath href="#facade-l2" startOffset="50%" textAnchor="middle">{sub.toUpperCase()}</textPath>
        </text>
      </g>
    </svg>
  );
}
