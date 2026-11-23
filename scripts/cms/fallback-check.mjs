// Runs before every build (prebuild). Compares the bundled fallback (content/*.json) with the
// PUBLISHED content in the database, read with the public visitor key (no secrets needed).
// If they differ, visitors could see the bundled version while the database is slow or down,
// so it prints a clear warning: run `npm run cms:pull -- --apply` and rebuild.
// It never fails the build and never reads drafts.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fromFile = (() => {
  try {
    return Object.fromEntries([...fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z_]+)=[ \t]*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
  } catch {
    return {};
  }
})();
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromFile.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? fromFile.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v));
const hash = (v) => crypto.createHash("sha256").update(canonical(v)).digest("hex");

if (!url || !key) {
  console.log("ℹ  Fallback check skipped (Supabase is not configured).");
  process.exit(0);
}
try {
  const res = await fetch(`${url}/rest/v1/content_published?select=key,data`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  const dir = path.join(ROOT, "content");
  const local = (k) => {
    if (k === "projects") return fs.readdirSync(path.join(dir, "projects")).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, "projects", f), "utf8")));
    const f = path.join(dir, `${k}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : undefined;
  };
  const differ = rows.filter((r) => hash(r.data) !== hash(local(r.key))).map((r) => r.key);
  if (differ.length) {
    console.log(`⚠  The bundled fallback differs from PUBLISHED content for: ${differ.join(", ")}.`);
    console.log("   While the database is slow or unreachable, visitors would see the bundled version.");
    console.log("   Fix: npm run cms:pull -- --apply   (copies published content into content/*.json), then rebuild.");
  } else {
    console.log(`✔  Fallback content equals the published content (${rows.length} blocks).`);
  }
} catch (e) {
  console.log(`ℹ  Fallback check skipped (database not reachable: ${e.message}).`);
}
