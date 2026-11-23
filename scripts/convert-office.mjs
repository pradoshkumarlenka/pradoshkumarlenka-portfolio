// Converts PowerPoint / Word files in /public/projects/** to PDF previews with
// LibreOffice, so the in-site viewer can show the real slides/pages.
//
//   npm run convert:office
//
// Output: <same folder>/previews/<original name>.pdf  (originals untouched).
// Unchanged files are skipped (preview newer than source). Paths with spaces
// and parentheses are passed as separate arguments, never through a shell.
// After converting, set `preview: "/projects/<slug>/previews/<name>.pdf"` on
// the resource in content/projects/<slug>.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectsDir = join(root, "public/projects");
const OFFICE = new Set([".ppt", ".pptx", ".doc", ".docx"]);

const candidates = [
  process.env.SOFFICE,
  "C:/Program Files/LibreOffice/program/soffice.exe",
  "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "soffice",
].filter(Boolean);

function findSoffice() {
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {}
  }
  return null;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "previews" ? [] : walk(p);
    return OFFICE.has(extname(e.name).toLowerCase()) ? [p] : [];
  });
}

const files = walk(projectsDir);
if (files.length === 0) {
  console.log("[convert-office] No PPT/PPTX/DOC/DOCX files in public/projects.");
  process.exit(0);
}
const soffice = findSoffice();
if (!soffice) {
  console.error("[convert-office] LibreOffice not found. Install it (https://www.libreoffice.org) or set SOFFICE=<path to soffice>.");
  process.exit(1);
}

for (const file of files) {
  const outDir = join(dirname(file), "previews");
  const out = join(outDir, `${basename(file, extname(file))}.pdf`);
  if (existsSync(out) && statSync(out).mtimeMs >= statSync(file).mtimeMs) {
    console.log(`[convert-office] up to date: ${out}`);
    continue;
  }
  mkdirSync(outDir, { recursive: true });
  execFileSync(soffice, ["--headless", "--convert-to", "pdf", "--outdir", outDir, file], { stdio: "inherit" });
  console.log(`[convert-office] ${existsSync(out) ? "wrote" : "FAILED"}: ${out}`);
}
