// Build optimized WebP variants of the kit artwork into public/. Originals stay in assets-src/.
//   npm run assets:build
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const SRC = "assets-src/afterimage";
const OUT = "public/assets/afterimage";
const WIDTHS: Record<string, number[]> = { scenes: [1672, 960], characters: [1200, 600], objects: [640, 240] };

async function main() {
  let total = 0;
  for (const [dir, widths] of Object.entries(WIDTHS)) {
    mkdirSync(join(OUT, dir), { recursive: true });
    for (const file of readdirSync(join(SRC, dir)).filter((f) => f.endsWith(".png"))) {
      const { name } = parse(file);
      for (const w of widths) {
        const out = join(OUT, dir, `${name}-${w}.webp`);
        await sharp(join(SRC, dir, file)).resize({ width: w, withoutEnlargement: true }).webp({ quality: dir === "scenes" ? 80 : 82, alphaQuality: 90 }).toFile(out);
        total += statSync(out).size;
      }
    }
  }
  console.log(`assets: ${(total / 1024 / 1024).toFixed(1)} MB of WebP written to ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
