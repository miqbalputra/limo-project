import { access, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(scriptDirectory, "../limo_image");
const outputDirectory = resolve(scriptDirectory, "../public/hero-images");

let sharp;

try {
  ({ default: sharp } = await import("sharp"));
} catch {
  throw new Error("Unable to load sharp. Install the project's dependencies before generating hero images.");
}

const variants = [
  { order: 1, desktop: "landscape-1.png", mobile: "square-1.png" },
  { order: 2, desktop: "landscape-2.png", mobile: "square-2.png" },
  { order: 3, desktop: "landscape-3.png", mobile: "square-3.png" },
  { order: 4, desktop: "landscape-4.png", mobile: "square-4.png" },
];

const desktopSize = { width: 3520, height: 1980 };
const mobileSize = { width: 2160, height: 2160 };

async function generate(source, target, size) {
  const sourcePath = resolve(sourceDirectory, source);
  await access(sourcePath);
  const outputPath = resolve(outputDirectory, target);
  await sharp(sourcePath)
    .resize(size.width, size.height, { fit: "cover" })
    .sharpen({ sigma: 1.1, m1: 1, m2: 0.5, x1: 0.5, y2: 4, y3: 0 })
    .webp({ quality: 90, effort: 6 })
    .toFile(outputPath);
  return outputPath;
}

await mkdir(outputDirectory, { recursive: true });

const outputFiles = [];
for (const variant of variants) {
  outputFiles.push(await generate(variant.desktop, `hero-desktop-${variant.order}.webp`, desktopSize));
  outputFiles.push(await generate(variant.mobile, `hero-mobile-${variant.order}.webp`, mobileSize));
}

console.log(`Generated ${outputFiles.map((file) => `public/hero-images/${file.split(/[\\/]/).pop()}`).join(", ")}`);
