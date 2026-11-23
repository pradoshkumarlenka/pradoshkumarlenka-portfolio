// npm run cms:import            dry run: shows what would happen, changes nothing
// npm run cms:import -- --apply  imports the JSON blocks into public.content_published
//
// Safe to repeat: a block already in the database is NEVER overwritten.
//   missing                → inserted from the JSON file (after schema validation)
//   present, same content  → skipped
//   present, different     → reported as a conflict and left untouched
// Everything happens in one transaction; any error rolls back all of it.
import { db, redact, readJsonBlocks, validateBlock, hashOf } from "./lib.mjs";

const APPLY = process.argv.includes("--apply");
const blocks = readJsonBlocks();
const invalid = [];
for (const [key, value] of Object.entries(blocks)) invalid.push(...(await validateBlock(key, value)));
if (invalid.length) { console.error("JSON files fail schema validation — nothing imported:\n  " + invalid.join("\n  ")); process.exit(1); }

const c = await db();
try {
  await c.query("begin");
  const existing = Object.fromEntries((await c.rows("select key, data from public.content_published for update")).map((r) => [r.key, r.data]));
  const plan = { insert: [], same: [], conflict: [] };
  for (const [key, value] of Object.entries(blocks)) {
    if (!(key in existing)) plan.insert.push(key);
    else if (hashOf(existing[key]) === hashOf(value)) plan.same.push(key);
    else plan.conflict.push(key);
  }
  if (APPLY) {
    for (const key of plan.insert) {
      // on conflict do nothing: even a concurrent insert can never be overwritten
      await c.query("insert into public.content_published (key, data) values ($1, $2::jsonb) on conflict (key) do nothing", [key, JSON.stringify(blocks[key])]);
    }
    await c.query("commit");
  } else {
    await c.query("rollback");
  }
  console.log(`${APPLY ? "IMPORT" : "DRY RUN (nothing changed; add --apply)"} — ${Object.keys(blocks).length} blocks`);
  console.log(`  ${APPLY ? "inserted" : "would insert"} (${plan.insert.length}): ${plan.insert.join(", ") || "—"}`);
  console.log(`  already identical (${plan.same.length}): ${plan.same.join(", ") || "—"}`);
  console.log(`  conflicts, left untouched (${plan.conflict.length}): ${plan.conflict.join(", ") || "—"}`);
  if (plan.conflict.length) process.exitCode = 2;
} catch (e) {
  await c.query("rollback").catch(() => {});
  console.error("Rolled back — nothing changed:", redact(e.message));
  process.exitCode = 1;
} finally {
  await c.end();
}
