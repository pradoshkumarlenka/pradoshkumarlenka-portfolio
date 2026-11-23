import "server-only";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { ContentKey } from "./registry";
import siteSchema from "../../../content/schemas/site.schema.json";
import sectionsSchema from "../../../content/schemas/sections.schema.json";
import heroSchema from "../../../content/schemas/hero.schema.json";
import proofSchema from "../../../content/schemas/proof.schema.json";
import experienceSchema from "../../../content/schemas/experience.schema.json";
import researchSchema from "../../../content/schemas/research.schema.json";
import leadershipSchema from "../../../content/schemas/leadership.schema.json";
import honoursSchema from "../../../content/schemas/honours.schema.json";
import beyondSchema from "../../../content/schemas/beyond.schema.json";
import resumeSchema from "../../../content/schemas/resume.schema.json";
import contactSchema from "../../../content/schemas/contact.schema.json";
import footerSchema from "../../../content/schemas/footer.schema.json";
import uiSchema from "../../../content/schemas/ui.schema.json";
import projectSchema from "../../../content/schemas/project.schema.json";
import designSchema from "../../../content/schemas/design.schema.json";
import animationSchemaBase from "../../../content/schemas/animation.schema.json";
import { ANIMATION_LIMITS } from "@/lib/animation/config";

/*
 * CONTENT VALIDATION — one set of rules for every block, wherever it comes from.
 * Used by the public database source (invalid → JSON fallback) and by the
 * admin editor (invalid → not saved). Two layers:
 *   1. the JSON schema generated from src/content/types.ts (shape and types);
 *   2. safety rules a schema cannot express: safe link schemes, local-only
 *      asset paths (an external image URL would break next/image), and limits.
 */

export type JsonSchema = Record<string, unknown>;

/** The animation schema with every ANIMATION_LIMITS range (and #rrggbb colours) written in, so editors show sliders and ajv enforces the ranges. */
function withAnimationLimits(base: JsonSchema): JsonSchema {
  const schema = structuredClone(base);
  for (const [path, [min, max]] of Object.entries(ANIMATION_LIMITS as Record<string, readonly [number, number]>)) {
    let node: JsonSchema | undefined = schema;
    for (const part of path.split(".")) node = (node?.properties as Record<string, JsonSchema> | undefined)?.[part];
    if (node) Object.assign(node, { minimum: min, maximum: max });
  }
  const trail = (schema.properties as Record<string, JsonSchema>).cursorTrail?.properties as Record<string, JsonSchema> | undefined;
  for (const k of ["color", "secondaryColor"]) if (trail?.[k]) Object.assign(trail[k], { pattern: "^#[0-9a-fA-F]{6}$", description: "Hex colour, e.g. #a56bff." });
  return schema;
}
const BLOCK_SCHEMAS: Record<Exclude<ContentKey, "projects">, JsonSchema> = {
  site: siteSchema, sections: sectionsSchema, hero: heroSchema, proof: proofSchema,
  experience: experienceSchema, research: researchSchema, leadership: leadershipSchema,
  honours: honoursSchema, beyond: beyondSchema, resume: resumeSchema, contact: contactSchema,
  footer: footerSchema, ui: uiSchema, design: designSchema, animation: withAnimationLimits(animationSchemaBase),
};

/** JSON schema of a block. `projects` = an array of project files. */
export function schemaFor(key: ContentKey): JsonSchema {
  if (key === "projects") return { type: "array", minItems: 1, items: projectSchema, description: "content/projects/*.json — one entry per case study." };
  return BLOCK_SCHEMAS[key];
}

export const LIMITS = { bytes: 1_048_576, string: 20_000 } as const;

let compiled: Map<ContentKey, ValidateFunction> | null = null;
function validatorFor(key: ContentKey): ValidateFunction {
  if (!compiled) compiled = new Map();
  let v = compiled.get(key);
  if (!v) {
    v = new Ajv({ allErrors: true, strict: false }).compile(schemaFor(key));
    compiled.set(key, v);
  }
  return v;
}

export interface ContentIssue {
  /** JSON pointer, e.g. "/links/0/href" ("" = the whole block). */
  path: string;
  message: string;
}

/** Fields holding a link: href, url, verifyUrl … (not labels such as "openLink"). */
const LINK_KEY = /(href|url)$/i;
const SAFE_LINK = /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+0-9() .-]+|\/(?!\/)[^\s]*|#[^\s]*)$/i;
const DANGEROUS = /^\s*(javascript|data|vbscript|file):/i;
const LOCAL_PATH = /^\/(?!\/)[A-Za-z0-9._~\-/%() ]+$/;

/** Fields whose schema says the value is a file inside /public. */
/** File-like field names (e.g. poster, backdrop — not every description mentions /public). */
const ASSET_KEY = /(image|src|poster|backdrop|photo|headshot|download|captions|thumbnail|cover)$/i;
const isAssetField = (schema: JsonSchema | undefined, key = "", value = "") =>
  !schema?.enum &&
  ((typeof schema?.description === "string" && /\/public|inside public/i.test(schema.description)) ||
    // by name only when the value looks like a path or URL (labels such as "Download" are text)
    (ASSET_KEY.test(key) && value.includes("/")));

function safetyIssues(value: unknown, schema: JsonSchema | undefined, path: string, key: string, out: ContentIssue[]) {
  if (typeof value === "string") {
    if (value.length > LIMITS.string) out.push({ path, message: `Too long (max ${LIMITS.string} characters).` });
    if (DANGEROUS.test(value)) out.push({ path, message: "This kind of link is not allowed." });
    else if (LINK_KEY.test(key) && value !== "" && !SAFE_LINK.test(value)) out.push({ path, message: "Use a full https:// link, mailto:, tel:, or a path starting with /." });
    else if (isAssetField(schema, key, value) && value !== "" && (!LOCAL_PATH.test(value) || value.includes(".."))) out.push({ path, message: "Use a file path inside /public, starting with / (e.g. /images/photo.webp)." });
    return;
  }
  if (Array.isArray(value)) {
    const items = (schema?.items as JsonSchema | undefined) ?? undefined;
    value.forEach((v, i) => safetyIssues(v, items, `${path}/${i}`, key, out));
    return;
  }
  if (value && typeof value === "object") {
    const variants = (schema?.anyOf as JsonSchema[] | undefined) ?? [];
    const props = (schema?.properties as Record<string, JsonSchema> | undefined)
      ?? variants.map((s) => s.properties as Record<string, JsonSchema>).find((p) => p && Object.entries(p).every(([k, s]) => s.const === undefined || (value as Record<string, unknown>)[k] === s.const));
    for (const [k, v] of Object.entries(value)) safetyIssues(v, props?.[k], `${path}/${k}`, k, out);
  }
}

const describe = (e: ErrorObject): ContentIssue => {
  const at = e.instancePath;
  switch (e.keyword) {
    case "required": return { path: `${at}/${(e.params as { missingProperty: string }).missingProperty}`, message: "Required." };
    case "additionalProperties": return { path: at, message: `Unknown field “${(e.params as { additionalProperty: string }).additionalProperty}”.` };
    case "type": return { path: at, message: `Must be ${(e.params as { type: string }).type}.` };
    case "enum": return { path: at, message: `Must be one of: ${((e.params as { allowedValues: unknown[] }).allowedValues).join(", ")}.` };
    case "const": return { path: at, message: `Must be “${String((e.params as { allowedValue: unknown }).allowedValue)}”.` };
    case "anyOf": return { path: at, message: "Does not match any allowed layout." };
    case "minItems": return { path: at, message: "Needs at least one entry." };
    case "minimum": return { path: at, message: `Must be at least ${(e.params as { limit: number }).limit}.` };
    case "maximum": return { path: at, message: `Must be at most ${(e.params as { limit: number }).limit}.` };
    case "pattern": return { path: at, message: (e.params as { pattern: string }).pattern.includes("0-9a-fA-F") ? "Use a hex colour like #a56bff." : "Invalid format." };
    default: return { path: at, message: e.message ?? "Invalid." };
  }
};

/* Readability rules for the design block (WCAG contrast against the page background). */
const PAGE_BACKGROUND = "#070a14";
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const HEX = /^#[0-9a-fA-F]{6}$/;
function designIssues(value: unknown, out: ContentIssue[]) {
  const c = (value as { colors?: Record<string, string> })?.colors;
  if (!c || !Object.values(c).every((v) => typeof v === "string" && HEX.test(v))) return; // the schema reports bad colours
  const need = (k: string, against: string, min: number, what: string) => {
    const ratio = contrast(c[k], against);
    if (ratio < min) out.push({ path: `/colors/${k}`, message: `Too little contrast ${what} (${ratio.toFixed(1)}:1, needs ${min}:1).` });
  };
  for (const k of ["fg", "fgMuted", "fgSubtle", "lavender"]) need(k, PAGE_BACKGROUND, 4.5, "on the page background");
  for (const k of ["fg", "fgMuted"]) need(k, c.surface, 4.5, "on cards");
  for (const k of ["violet", "positive", "negative"]) need(k, PAGE_BACKGROUND, 3, "on the page background");
  need("onViolet", c.violet, 4.5, "on accent buttons");
}

/** All problems with a block (empty = valid and safe to publish). */
export function contentIssues(key: ContentKey, value: unknown): ContentIssue[] {
  const v = validatorFor(key);
  const issues: ContentIssue[] = v(value) ? [] : (v.errors ?? []).filter((e) => e.keyword !== "if").map(describe);
  safetyIssues(value, schemaFor(key), "", "", issues);
  if (key === "design") designIssues(value, issues);
  if (JSON.stringify(value ?? null).length > LIMITS.bytes) issues.push({ path: "", message: "This block is larger than 1 MB." });
  // de-duplicate (anyOf reports one error per variant)
  const seen = new Set<string>();
  return issues.filter((i) => { const k = i.path + "|" + i.message; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Every local file path (inside /public) a block refers to — used to warn about missing files. */
export function localAssetPaths(key: ContentKey, value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown, schema: JsonSchema | undefined, k: string) => {
    if (typeof v === "string") {
      if ((isAssetField(schema, k, v) || (LINK_KEY.test(k) && v.startsWith("/") && /\.[a-z0-9]{2,5}$/i.test(v))) && LOCAL_PATH.test(v) && !v.includes("..")) found.add(v);
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, schema?.items as JsonSchema | undefined, k));
    if (v && typeof v === "object") {
      const variants = (schema?.anyOf as JsonSchema[] | undefined) ?? [];
      const props = (schema?.properties as Record<string, JsonSchema> | undefined) ?? variants.map((s) => s.properties as Record<string, JsonSchema>).find(Boolean);
      for (const [kk, x] of Object.entries(v)) walk(x, props?.[kk], kk);
    }
  };
  walk(value, schemaFor(key), "");
  return [...found];
}

/** True when the block is valid and safe. */
export const isValidContent = (key: ContentKey, value: unknown) => contentIssues(key, value).length === 0;
