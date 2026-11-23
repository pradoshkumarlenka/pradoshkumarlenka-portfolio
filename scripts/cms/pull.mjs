// npm run cms:pull            dry run: which content/*.json files differ from PUBLISHED content
// npm run cms:pull -- --apply  rewrite those files with the published content
//
// The bundled JSON files are the site's offline fallback, so they must equal what is
// PUBLISHED — never drafts. Run this after publishing in the admin, before deploying.
// Reads only public.content_published (drafts are never read). Every block is checked
// against its JSON schema before anything is written. projects: matched to the existing
// files by slug; nothing is created or deleted.
import fs from "node:fs";
import path from "node:path";
import { ROOT, BLOCK_FILES, db, redact, readJsonBlocks, validateBlock, hashOf } from "./lib.mjs";

const APPLY = process.argv.includes("--apply");
const c = await db();
try {
  const rows = Object.fromEntries((await c.rows("select key, data from public.content_published")).map((r) => [r.key, r.data]));
  const local = readJsonBlocks();
  const changes = [];
  for (const key of [...Object.keys(BLOCK_FILES), "projects"]) {
    if (!(key in rows)) { console.log(`skip  ${key}: not published (the JSON file stays)`); continue; }
    const issues = await validateBlock(key, rows[key]);
    if (issues.length) { console.log(`skip  ${key}: published content fails validation (${issues[0]})`); continue; }
    if (hashOf(rows[key]) === hashOf(local[key])) continue;
    changes.push(key);
  }
  console.log(changes.length ? `${APPLY ? "Updating" : "Would update"}: ${changes.join(", ")}` : "All JSON files already equal the published content.");
  if (APPLY) {
    const dir = path.join(ROOT, "content");
    for (const key of changes) {
      if (key === "projects") {
        const files = fs.readdirSync(path.join(dir, "projects")).filter((f) => f.endsWith(".json")).sort();
        const bySlug = Object.fromEntries(files.map((f) => [JSON.parse(fs.readFileSync(path.join(dir, "projects", f), "utf8")).slug, f]));
        const published = rows.projects;
        if (published.length !== files.length || published.some((p) => !bySlug[p.slug])) { console.log("skip  projects: the published list has added/removed/renamed projects — update content/projects by hand"); continue; }
        for (const p of published) fs.writeFileSync(path.join(dir, "projects", bySlug[p.slug]), JSON.stringify(p, null, 2) + "\n");
      } else {
        fs.writeFileSync(path.join(dir, BLOCK_FILES[key]), JSON.stringify(rows[key], null, 2) + "\n");
      }
      console.log(`wrote ${key}`);
    }
  }
} catch (e) {
  console.error("Pull failed:", redact(e.message));
  process.exitCode = 1;
} finally {
  await c.end();
}
