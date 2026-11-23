// Copies the PDF.js worker into /public/vendor so the in-site PDF viewer can
// load it from the same origin. Runs automatically before `dev` and `build`.
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dest = join(root, "public/vendor/pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[pdf-worker] pdfjs-dist is not installed; skipping.");
  process.exit(0);
}
if (existsSync(dest) && statSync(dest).size === statSync(src).size) process.exit(0); // unchanged
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("[pdf-worker] copied to public/vendor/pdf.worker.min.mjs");
