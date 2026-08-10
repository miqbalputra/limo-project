import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(scriptDirectory, "../public");
const sourceIconPath = resolve(publicDirectory, "icon.svg");
const sourceIcon = await readFile(sourceIconPath, "utf8");

let sharp;

try {
  ({ default: sharp } = await import("sharp"));
} catch {
  throw new Error("Unable to load sharp. Install the project's dependencies before generating PWA icons.");
}

function createSafeZoneSvg(svg) {
  const rootMatch = svg.match(/^(<svg\b[^>]*>)([\s\S]*)<\/svg>\s*$/);

  if (!rootMatch) {
    throw new Error("public/icon.svg must have a single SVG root element.");
  }

  const [, root, body] = rootMatch;
  const backgroundMatch = body.match(/<rect\b[^>]*\/>/);

  if (!backgroundMatch) {
    throw new Error("public/icon.svg must include its 512px background rectangle.");
  }

  const background = backgroundMatch[0];
  const fillMatch = background.match(/\bfill=["']([^"']+)["']/);

  if (!/\bwidth=["']512["']/.test(background) || !/\bheight=["']512["']/.test(background) || !fillMatch) {
    throw new Error("public/icon.svg background must be a filled 512px square.");
  }

  const artwork = body.replace(background, "");

  // Maskable and Apple icons need full-bleed color while keeping the artwork in the central 80% safe zone.
  return `${root}\n  <rect width="512" height="512" fill="${fillMatch[1]}"/>\n  <g transform="translate(51.2 51.2) scale(0.8)">${artwork}</g>\n</svg>`;
}

const safeZoneIcon = createSafeZoneSvg(sourceIcon);
const outputFiles = [
  { fileName: "icon-192x192.png", size: 192, svg: sourceIcon },
  { fileName: "icon-512x512.png", size: 512, svg: sourceIcon },
  { fileName: "icon-maskable-512x512.png", size: 512, svg: safeZoneIcon },
  { fileName: "apple-touch-icon.png", size: 180, svg: safeZoneIcon },
];

await Promise.all(
  outputFiles.map(({ fileName, size, svg }) =>
    sharp(Buffer.from(svg))
      .resize(size, size, { fit: "fill" })
      .png({ adaptiveFiltering: true, compressionLevel: 9 })
      .toFile(resolve(publicDirectory, fileName)),
  ),
);

console.log(`Generated ${outputFiles.map(({ fileName }) => `public/${fileName}`).join(", ")}`);
