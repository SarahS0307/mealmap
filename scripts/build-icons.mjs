/**
 * Erzeugt aus assets/logo-mark.svg alle PNG-Größen, die die App einbindet.
 *
 * Die SVG ist die Quelle – Änderungen am Logo also dort machen und danach
 * `npm run icons` ausführen. Die erzeugten PNGs werden mit eingecheckt, damit
 * die App ohne diesen Schritt lauffähig bleibt.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets", "logo-mark.svg");

/** Zielgrößen: Favicon, Homescreen-Icon und die Marke für die Kopfzeile. */
const targets = [
  { file: "src/app/icon.png", size: 512, what: "Favicon (Browser-Tab)" },
  { file: "src/app/apple-icon.png", size: 180, what: "Homescreen auf iOS" },
  { file: "public/logo-mark.png", size: 144, what: "Bildmarke in der App" },
];

const svg = await readFile(source);

for (const target of targets) {
  const out = path.join(root, target.file);
  await mkdir(path.dirname(out), { recursive: true });

  const png = await sharp(svg, { density: 600 })
    .resize(target.size, target.size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(out, png);
  console.log(`${target.file.padEnd(26)} ${target.size}px – ${target.what}`);
}

console.log("\nFertig. Quelle: assets/logo-mark.svg");
