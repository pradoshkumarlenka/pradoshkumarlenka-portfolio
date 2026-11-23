// npm run test:content:media — the /media route's PUBLISHED path, using the real route
// code and real private storage, with only the "is it used by published content?"
// lookup stubbed (that SQL function is tested in tests/security/10-media.mjs).
// Uploads one zztest file with the server key and removes it again.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries([...fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z_]+)=[ \t]*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) process.env[k] = env[k];
const API = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const svc = (p, init = {}) => fetch(`${API}/storage/v1/object/${p}`, { ...init, headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, ...(init.headers ?? {}) } });

const id = crypto.randomUUID(); const storagePath = `media/${id}/zztest-route.png`;
const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360f8cf00000301010018dd8db00000000049454e44ae426082", "hex");
const stub = fs.mkdtempSync(path.join(os.tmpdir(), "pkl-route-"));
fs.writeFileSync(path.join(stub, "so.js"), "module.exports = {};");
fs.writeFileSync(path.join(stub, "media-server.js"), `const real = require(${JSON.stringify(path.join(ROOT, "src/lib/media/server.ts"))});
module.exports = { ...real, getPublicMedia: async (x) => (x === ${JSON.stringify(id)} ? { path: ${JSON.stringify(storagePath)}, mime: "image/png", bytes: ${png.length} } : null) };`);
const results = []; const rec = (l, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${l}${d ? "  —  " + d : ""}`); };
console.log("\n── /media route: published files");
try {
  const up = await svc(`site-media/${storagePath}`, { method: "POST", headers: { "Content-Type": "image/png" }, body: png });
  if (!up.ok) throw new Error(`fixture upload ${up.status}`);
  const jiti = createJiti(import.meta.url, { alias: { "server-only": path.join(stub, "so.js"), "@/lib/media/server": path.join(stub, "media-server.js"), "@": path.join(ROOT, "src") } });
  const { GET } = await jiti.import(path.join(ROOT, "src/app/media/[id]/[name]/route.ts"));
  const { NextRequest } = await jiti.import("next/server");
  const call = (mid) => GET(new NextRequest(`http://localhost/media/${mid}/x.png`), { params: Promise.resolve({ id: mid, name: "x.png" }) });
  const r = await call(id);
  const body = Buffer.from(await r.arrayBuffer());
  rec("A file used by published content is served to visitors: exact bytes, verified type, nosniff, sandbox CSP, publicly cacheable (5 min)",
    r.status === 200 && body.equals(png) && r.headers.get("content-type") === "image/png" && r.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(r.headers.get("content-security-policy") ?? "") && /^public, max-age=300/.test(r.headers.get("cache-control") ?? ""),
    `HTTP ${r.status}, ${r.headers.get("cache-control")}`);
} catch (e) {
  rec("Test run completed", false, e.message);
} finally {
  await svc("site-media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [storagePath] }) }).catch(() => {});
  fs.rmSync(stub, { recursive: true, force: true });
}
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
