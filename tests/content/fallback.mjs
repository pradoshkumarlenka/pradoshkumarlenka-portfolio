// npm run test:content — the content layer's fallback behaviour, using the REAL
// src/lib/content code (loaded with jiti, already installed via the toolchain).
// The Supabase settings are pointed at a local fake API, so every failure
// mode can be produced without touching the real database:
//   valid rows → used · invalid / missing / error / slow / unreachable → JSON.
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let mode = "valid";
let rows = [];
const server = http.createServer((req, res) => {
  if (mode === "error") { res.writeHead(500, { "Content-Type": "application/json" }); return res.end('{"code":"XX000","message":"boom"}'); }
  if (mode === "slow") return setTimeout(() => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(rows)); }, 4000);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(rows));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// Stubs: "server-only" (a build-time marker) and the public Supabase config.
const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkl-content-"));
fs.writeFileSync(path.join(stubDir, "server-only.js"), "module.exports = {};\n");
fs.writeFileSync(path.join(stubDir, "config.js"), `Object.defineProperty(exports, "supabaseUrl", { get: () => process.env.__FAKE_URL }); exports.supabasePublishableKey = "sb_publishable_test_only_not_a_real_key"; exports.supabaseConfigured = true; exports.BUCKET = "work-files";\n`);

const load = () => {
  const jiti = createJiti(import.meta.url, {
    moduleCache: false, fsCache: false,
    alias: { "server-only": path.join(stubDir, "server-only.js"), "@/lib/supabase/config": path.join(stubDir, "config.js"), "@": path.join(ROOT, "src") },
  });
  return jiti(path.join(ROOT, "src/lib/content/database-source.ts"));
};

const results = [];
const rec = (label, pass, detail = "") => { results.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? "  —  " + detail : ""}`); };
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", f), "utf8"));
const footer = json("footer.json"), hero = json("hero.json");
const projects = fs.readdirSync(path.join(ROOT, "content/projects")).sort().map((f) => json(`projects/${f}`));

console.log("\n── Content layer: database source and JSON fallback");
try {
  process.env.__FAKE_URL = `http://127.0.0.1:${port}`;
  const changedFooter = { ...footer, copyright: (footer.copyright ?? "") + " (db)" };
  if (!("copyright" in footer)) throw new Error("fixture: footer.copyright missing — update this test");

  mode = "valid"; rows = [{ key: "footer", data: changedFooter }, { key: "projects", data: projects }];
  let { databaseSource } = load();
  const f = await databaseSource.get("footer");
  rec("Valid published block is used", f?.copyright === changedFooter.copyright);
  rec("Valid projects block (array of 5) is used", Array.isArray(await databaseSource.get("projects")));
  rec("Missing block → null (JSON used)", (await databaseSource.get("hero")) === null);

  rows = [{ key: "footer", data: { ...footer, unexpected: true } }, { key: "hero", data: { ...hero, name: 42 } }, { key: "projects", data: [{ slug: 1 }] }];
  ({ databaseSource } = load());
  rec("Unknown field → rejected by schema (JSON used)", (await databaseSource.get("footer")) === null);
  rec("Wrong type → rejected by schema (JSON used)", (await databaseSource.get("hero")) === null);
  rec("Invalid project → whole projects block rejected (JSON used)", (await databaseSource.get("projects")) === null);

  rows = [{ key: "projects", data: [] }];
  ({ databaseSource } = load());
  rec("Empty projects list → rejected (JSON used)", (await databaseSource.get("projects")) === null);

  mode = "error"; ({ databaseSource } = load());
  rec("Database error (HTTP 500) → null, no exception", (await databaseSource.get("footer")) === null);

  mode = "valid";
  const contact = json("contact.json");
  rows = [
    { key: "contact", data: { ...contact, links: contact.links.map((l, i) => (i === 0 ? { ...l, href: "javascript:alert(1)" } : l)) } },
    { key: "hero", data: { ...hero, portrait: { ...hero.portrait, image: "https://evil.example/x.png" } } },
  ];
  ({ databaseSource } = load());
  rec("Schema-valid but unsafe link (javascript:) → rejected (JSON used)", (await databaseSource.get("contact")) === null);
  rec("External image URL in a /public path field → rejected (JSON used)", (await databaseSource.get("hero")) === null);

  mode = "slow"; rows = [{ key: "footer", data: changedFooter }]; ({ databaseSource } = load());
  const t0 = Date.now(); const slow = await databaseSource.get("footer"); const ms = Date.now() - t0;
  rec("Slow database (4 s) → gives up after ~2.5 s, null", slow === null && ms < 3500, `${ms} ms`);

  process.env.__FAKE_URL = "http://127.0.0.1:1"; mode = "valid"; ({ databaseSource } = load());
  rec("Unreachable database → null, no exception", (await databaseSource.get("footer")) === null);

  // The resolver: first source that has the block wins, JSON is the last resort.
  const src = fs.readFileSync(path.join(ROOT, "src/lib/content/source.ts"), "utf8");
  rec("Source order is [draftSource (admin preview only), databaseSource, jsonSource]", /SOURCES[^=]*=\s*\[draftSource,\s*databaseSource,\s*jsonSource\]/.test(src));
  const draft = fs.readFileSync(path.join(ROOT, "src/lib/content/draft-source.ts"), "utf8");
  rec("Draft source requires Draft Mode AND an admin session before any query", /isEnabled[\s\S]*if \(!enabled\) return null;[\s\S]*getAdminSession\(\)[\s\S]*status !== "admin"\) return null;[\s\S]*content_drafts/.test(draft));
  const db = fs.readFileSync(path.join(ROOT, "src/lib/content/database-source.ts"), "utf8");
  rec("Database source uses the publishable key only (never the secret key)", !/SECRET|service/i.test(db.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")) && db.includes("supabasePublishableKey"));
} catch (e) {
  rec("Test run completed", false, e.message);
} finally {
  server.close();
  fs.rmSync(stubDir, { recursive: true, force: true });
}
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
