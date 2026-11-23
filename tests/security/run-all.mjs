// Runs the security tests in order. Usage:
//   npm run test:security            (database + visitor API + content CMS: no website needed)
//   npm run test:security:app        (dashboard + public site: start `npm run dev` first)
//   npm run test:security:all        (everything, incl. bundle scan after `npm run build`)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SETS = {
  db: ["01-database.mjs", "02-visitor-api.mjs", "06-content-cms.mjs"],
  app: ["03-admin-dashboard.mjs", "04-public-site.mjs", "07-content-editor.mjs", "08-content-preview.mjs", "09-headers-export.mjs", "10-media.mjs", "11-admin-session.mjs", "12-safe-delete.mjs"],
  all: ["01-database.mjs", "02-visitor-api.mjs", "03-admin-dashboard.mjs", "04-public-site.mjs", "05-bundle-secrets.mjs", "06-content-cms.mjs", "07-content-editor.mjs", "08-content-preview.mjs", "09-headers-export.mjs", "10-media.mjs", "11-admin-session.mjs", "12-safe-delete.mjs"],
};
const files = SETS[process.argv[2] ?? "db"] ?? SETS.db;
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { stdio: "inherit", env: process.env });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} test file(s) had failures.` : "\nAll security tests passed.");
process.exit(failed ? 1 : 0);
