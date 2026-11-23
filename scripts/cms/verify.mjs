// npm run cms:verify — read-only. Checks every published block in the database
// against its JSON file (deep equality, key order ignored) and the JSON schema,
// and checks the history has one entry per published version.
import { db, redact, readJsonBlocks, validateBlock, hashOf } from "./lib.mjs";

const blocks = readJsonBlocks();
const c = await db();
let bad = 0;
const line = (ok, msg) => { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"}  ${msg}`); };
try {
  await c.query("begin transaction read only");
  const rows = Object.fromEntries((await c.rows("select key, data, version from public.content_published")).map((r) => [r.key, r]));
  const drafts = Object.fromEntries((await c.rows("select key, data from public.content_drafts")).map((r) => [r.key, r.data]));
  const hist = await c.rows("select key, count(*)::int n, max(version) v from public.content_versions group by key");
  const histBy = Object.fromEntries(hist.map((h) => [h.key, h]));
  for (const [key, value] of Object.entries(blocks)) {
    const row = rows[key];
    if (!row) { line(false, `${key.padEnd(11)} missing in database`); continue; }
    const errs = await validateBlock(key, row.data);
    const stagedDraft = drafts[key] !== undefined && hashOf(drafts[key]) === hashOf(value);
    const same = hashOf(row.data) === hashOf(value) || stagedDraft;
    const h = histBy[key];
    line(same && !errs.length && h && h.v === row.version,
      `${key.padEnd(11)} ${hashOf(row.data) === hashOf(value) ? "identical to JSON" : stagedDraft ? "JSON update staged as draft (publish in admin)" : "DIFFERS from JSON"} · schema ${errs.length ? "INVALID " + errs[0] : "valid"} · v${row.version} · history ${h ? h.n : 0}  sha256 ${hashOf(row.data).slice(0, 12)}`);
  }
  const extra = Object.keys(rows).filter((k) => !(k in blocks));
  line(extra.length === 0, `no unexpected blocks${extra.length ? ": " + extra.join(", ") : ""}`);
  await c.query("rollback");
} catch (e) {
  bad++; console.error("Verify failed:", redact(e.message));
} finally {
  await c.end();
}
console.log(bad ? `${bad} problem(s).` : `All ${Object.keys(blocks).length} blocks verified.`);
process.exitCode = bad ? 1 : 0;
