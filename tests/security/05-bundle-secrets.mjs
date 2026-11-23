// 05 — Secrets never reach the browser or Git. Run after `npm run build`.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { ROOT, SECRET_VALUES, reporter } from "./lib.mjs";

const t = reporter("05 · Secrets in browser bundles and Git");
const STATIC = path.join(ROOT, ".next/static");
if (!fs.existsSync(STATIC)) {
  t.rec("Production build present (run `npm run build` first)", false);
} else {
  let hits = 0, files = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, f.name); if (f.isDirectory()) walk(q); else { files++; const b = fs.readFileSync(q); if (SECRET_VALUES.some((v) => b.includes(v))) hits++; } } };
  walk(STATIC);
  t.rec("Secret key / database URL absent from every browser file", hits === 0, `${files} files scanned`);
}
const srcHits = [];
const walkSrc = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, f.name); if (f.isDirectory()) walkSrc(q); else if (/\.(tsx?|jsx?)$/.test(f.name)) { const s = fs.readFileSync(q, "utf8"); if (/SUPABASE_SECRET_KEY|SUPABASE_DB_URL/.test(s) && !/^import "server-only";/m.test(s)) srcHits.push(path.relative(ROOT, q)); } } };
walkSrc(path.join(ROOT, "src"));
t.rec("Website code reads the secret key only in server-only modules", srcHits.length === 0, srcHits.join(", ") || "ok");
const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
t.rec(".gitignore excludes .env*.local", /^\.env\*\.local$/m.test(gi));
let inRepo = false;
try { inRepo = execSync("git rev-parse --is-inside-work-tree", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() === "true"; } catch {}
if (inRepo) {
  const ignored = (() => { try { execSync("git check-ignore -q .env.local", { cwd: ROOT }); return true; } catch { return false; } })();
  const tracked = execSync("git ls-files", { cwd: ROOT }).toString().split("\n");
  t.rec("Git ignores .env.local and tracks no .env file", ignored && !tracked.some((f) => /(^|\/)\.env/.test(f) && !f.endsWith(".example")));
} else {
  console.log("note  Not a Git repository yet — re-run this after `git init` to confirm .env.local is ignored.");
}
t.done();
