// CERTIFICATE RENDERER — turns original certificates (PDF, JPG or PNG) into web
// images, blurring private areas first.        Run:  npm run certificates
//
// For every certificate in content/honours.json that has a "source":
//   1. reads the original (kept in /certificates-src, never published): page 1 of a
//      PDF is rendered with PDF.js at high resolution; a photo/scan is used as is
//      (turned upright from its camera data);
//   2. blurs every "redact" box (fractions of the page: x, y, w, h from the top-left);
//   3. writes the result to its "image" path in /public (WebP);
//   4. publishes a downloadable file at "download": the original PDF when nothing
//      is redacted, otherwise the redacted image (the original is never published).
// Unchanged certificates are skipped. Originals are never modified.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const MANIFEST = path.join(ROOT, "certificates-src", ".rendered.json");
const WIDTH = 2000; // px, long enough for a sharp full-screen view
const pub = (p) => path.join(PUBLIC, p.replace(/^\/+/, ""));

const honours = JSON.parse(fs.readFileSync(path.join(ROOT, "content/honours.json"), "utf8"));
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
let rendered = 0;

async function renderPdf(file) {
  const task = getDocument({ data: new Uint8Array(fs.readFileSync(file)) });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: WIDTH / base.width });
  const { canvas, context } = doc.canvasFactory.create(Math.round(viewport.width), Math.round(viewport.height));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const png = await canvas.encode("png");
  await task.destroy();
  return { image: sharp(png), W: canvas.width, H: canvas.height };
}

async function loadImage(file) {
  const png = await sharp(file).rotate().resize({ width: WIDTH, withoutEnlargement: true }).png().toBuffer();
  const { width, height } = await sharp(png).metadata();
  return { image: sharp(png), W: width, H: height };
}
let problems = 0;

for (const cert of honours.certifications) {
  if (!cert.source) continue;
  const src = path.join(ROOT, cert.source);
  if (!fs.existsSync(src)) {
    console.error(`✖ ${cert.name}: source file not found → ${cert.source}`);
    problems++;
    continue;
  }
  if (!cert.image) {
    console.error(`✖ ${cert.name}: has a "source" but no "image" path to write to.`);
    problems++;
    continue;
  }
  const key = crypto
    .createHash("sha1")
    .update(fs.readFileSync(src))
    .update(JSON.stringify([cert.redact ?? [], cert.image, cert.download ?? null, WIDTH]))
    .digest("hex");
  const outputs = [cert.image, cert.download].filter(Boolean).map(pub);
  if (manifest[cert.source] === key && outputs.every((o) => fs.existsSync(o))) {
    console.log(`• up to date: ${cert.name}`);
    continue;
  }

  // 1. Read the original: render page 1 of a PDF, or load a photo/scan.
  const { image: original, W, H } = src.toLowerCase().endsWith(".pdf") ? await renderPdf(src) : await loadImage(src);
  let image = original;

  // 2. Blur private areas.
  const overlays = [];
  for (const r of cert.redact ?? []) {
    const left = Math.max(0, Math.round(r.x * W));
    const top = Math.max(0, Math.round(r.y * H));
    const width = Math.min(W - left, Math.round(r.w * W));
    const height = Math.min(H - top, Math.round(r.h * H));
    const region = await sharp(await image.clone().png().toBuffer())
      .extract({ left, top, width, height })
      .blur(Math.max(14, Math.round(height / 3)))
      .png()
      .toBuffer();
    overlays.push({ input: region, left, top });
  }
  if (overlays.length) image = sharp(await image.composite(overlays).png().toBuffer());

  // 3. Web image.
  fs.mkdirSync(path.dirname(pub(cert.image)), { recursive: true });
  await image.clone().webp({ quality: 86 }).toFile(pub(cert.image));

  // 4. Downloadable file.
  if (cert.download) {
    fs.mkdirSync(path.dirname(pub(cert.download)), { recursive: true });
    if (cert.redact?.length) {
      if (cert.download.endsWith(".pdf")) {
        console.error(`✖ ${cert.name}: has redactions, so "download" must be an image (e.g. .jpg), not the original PDF.`);
        problems++;
      } else await image.clone().jpeg({ quality: 90 }).toFile(pub(cert.download));
    } else if (src.toLowerCase().endsWith(".pdf")) fs.copyFileSync(src, pub(cert.download));
    else await image.clone().jpeg({ quality: 90 }).toFile(pub(cert.download));
  }

  manifest[cert.source] = key;
  rendered++;
  console.log(`✔ rendered: ${cert.name} → public${cert.image} (${W}×${H}${cert.redact?.length ? `, ${cert.redact.length} area(s) blurred` : ""})`);
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`\n${rendered} rendered${problems ? `, ${problems} problem(s)` : ""}.`);
process.exit(problems ? 1 : 0);
