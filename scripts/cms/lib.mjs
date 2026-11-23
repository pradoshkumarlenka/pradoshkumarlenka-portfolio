// Shared helpers for the CMS scripts (backup, schema, import, verify).
// Reads .env.local locally and never prints secret values.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const env = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z_]+)=[ \t]*(.*)$/gm)].map((m) => [m[1], m[2].trim()]),
);

const SECRET_VALUES = [env.SUPABASE_SECRET_KEY, env.SUPABASE_DB_URL, env.SUPABASE_DB_URL?.match(/^postgres(?:ql)?:\/\/[^:]+:(.*)@[^@]+$/)?.[1]].filter((s) => s && s.length > 8);
/** Removes secrets from any text before it is printed. */
export const redact = (s) => { let t = String(s); for (const v of SECRET_VALUES) t = t.split(v).join("[redacted]"); return t.replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"); };

/** Postgres connection from SUPABASE_DB_URL (parsed by hand: passwords may contain URL-unsafe characters). */
export async function db() {
  const m = (env.SUPABASE_DB_URL ?? "").match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:@/]+):(\d+)\/(.+)$/);
  if (!m) throw new Error("SUPABASE_DB_URL is missing or has an unexpected format (.env.local).");
  const c = new pg.Client({ user: m[1], password: m[2], host: m[3], port: +m[4], database: m[5], ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  c.rows = async (sql, params) => (await c.query(sql, params)).rows;
  return c;
}

/** The 16 content blocks and their JSON source files (same keys as src/lib/content/registry.ts). */
export const BLOCK_FILES = {
  site: "site.json", sections: "sections.json", hero: "hero.json", proof: "proof.json", experience: "experience.json",
  research: "research.json", leadership: "leadership.json", honours: "honours.json", beyond: "beyond.json",
  resume: "resume.json", contact: "contact.json", footer: "footer.json", ui: "ui.json",
  design: "design.json", animation: "animation.json",
};

/** Reads every block exactly as the site bundles it today. `projects` = the 5 project files in filename order. */
export function readJsonBlocks() {
  const dir = path.join(ROOT, "content");
  const blocks = Object.fromEntries(Object.entries(BLOCK_FILES).map(([k, f]) => [k, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))]));
  const projDir = path.join(dir, "projects");
  blocks.projects = fs.readdirSync(projDir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(projDir, f), "utf8")));
  return blocks;
}

/** Canonical JSON (object keys sorted) — Postgres jsonb does not keep key order, so hashes use this form. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const hashOf = (value) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

/** Deep equality on canonical form. */
export const sameContent = (a, b) => canonical(a) === canonical(b);

/** Validates a block against the same JSON schemas the build uses (content/schemas). Returns error strings. */
let validators;
export async function validateBlock(key, value) {
  if (!validators) {
    const { default: Ajv } = await import("ajv");
    const ajv = new Ajv({ allErrors: true, strict: false });
    const load = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", "schemas", n), "utf8"));
    validators = Object.fromEntries([...Object.keys(BLOCK_FILES), "project"].map((k) => [k, ajv.compile(load(`${k}.schema.json`))]));
  }
  const fmt = (v, where) => (v.errors ?? []).map((e) => `${where}${e.instancePath || "/"} ${e.message}`);
  if (key === "projects") {
    if (!Array.isArray(value)) return ["projects must be an array"];
    return value.flatMap((p, i) => (validators.project(p) ? [] : fmt(validators.project, `projects[${i}]`)));
  }
  return validators[key](value) ? [] : fmt(validators[key], key);
}
