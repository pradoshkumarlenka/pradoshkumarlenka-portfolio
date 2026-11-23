// CONTENT CHECKER — runs automatically before `npm run dev` and `npm run build`
// (or on its own: `npm run check:content`).
//
// 1. Regenerates content/schemas/*.json from src/content/types.ts (editor hints + checking).
// 2. Checks every file in /content and explains problems in plain English.
// 3. Warns about images/files that are referenced but not in /public yet.
// 4. Regenerates src/content/generated/projects.ts (the list of project files).
//
// Exits with an error (and the site will not start) only when a file is broken.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { createGenerator } from "ts-json-schema-generator";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const SCHEMAS = path.join(CONTENT, "schemas");
const PUBLIC = path.join(ROOT, "public");

/** Each content file → the TypeScript type that describes it. */
const FILES = {
  "site.json": "SiteFile",
  "sections.json": "SectionsFile",
  "hero.json": "HeroFile",
  "proof.json": "ProofFile",
  "experience.json": "ExperienceFile",
  "research.json": "ResearchFile",
  "leadership.json": "LeadershipFile",
  "honours.json": "HonoursFile",
  "beyond.json": "BeyondFile",
  "resume.json": "ResumeFile",
  "contact.json": "ContactFile",
  "footer.json": "FooterFile",
  "ui.json": "UiFile",
  "design.json": "DesignFile",
  "animation.json": "AnimationFile",
};
const PROJECT_TYPE = "ProjectFile";
const schemaName = (type) => type.replace(/File$/, "").toLowerCase() + ".schema.json";

const errors = [];
const warnings = [];

/* ---------------------------------------------------------------- 1. Schemas */
fs.mkdirSync(SCHEMAS, { recursive: true });
const generator = createGenerator({
  path: path.join(ROOT, "src/content/types.ts"),
  tsconfig: path.join(ROOT, "tsconfig.json"),
  skipTypeCheck: true,
  additionalProperties: false, // unknown (misspelt) field names are reported
  expose: "none",
  topRef: false,
});
const schemas = {};
for (const type of [...Object.values(FILES), PROJECT_TYPE]) {
  const schema = generator.createSchema(type);
  schemas[type] = schema;
  const file = path.join(SCHEMAS, schemaName(type));
  const text = JSON.stringify(schema, null, 2) + "\n";
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text);
}

/* ---------------------------------------------------------------- 2. Checking */
const ajv = new Ajv({ allErrors: true, strict: false });
const validators = Object.fromEntries(Object.entries(schemas).map(([t, s]) => [t, ajv.compile(s)]));

/** "/items/0/label" → "items → 1st entry → label" */
function where(instancePath) {
  if (!instancePath) return "the top of the file";
  return instancePath
    .split("/")
    .slice(1)
    .map((part) => (/^\d+$/.test(part) ? `entry #${Number(part) + 1}` : `"${part}"`))
    .join(" → ");
}
const TYPE_WORDS = { string: "text (in quotes)", number: "a number (no quotes)", boolean: "true or false", array: "a list [ … ]", object: "a group { … }" };

function explain(err) {
  const at = where(err.instancePath);
  switch (err.keyword) {
    case "required":
      return `${at}: "${err.params.missingProperty}" is missing.`;
    case "additionalProperties":
      return `${at}: "${err.params.additionalProperty}" is not a known field here. Check the spelling (field names are case-sensitive).`;
    case "type":
      return `${at}: should be ${TYPE_WORDS[err.params.type] ?? err.params.type}.`;
    case "enum":
      return `${at}: must be one of: ${err.params.allowedValues.map((v) => JSON.stringify(v)).join(", ")}.`;
    case "const":
      return `${at}: must be ${JSON.stringify(err.params.allowedValue)}.`;
    default:
      return `${at}: ${err.message}.`;
  }
}

function load(file, type) {
  const full = path.join(CONTENT, file);
  if (!fs.existsSync(full)) {
    errors.push(`content/${file} is missing. Restore it from a backup.`);
    return null;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    errors.push(
      `content/${file} could not be read: ${e.message}\n    Usual causes: a missing or extra comma, a missing quote ", or a missing } or ].`,
    );
    return null;
  }
  const validate = validators[type];
  if (!validate(data)) {
    // Report the most useful messages once each.
    const seen = new Set();
    for (const err of validate.errors) {
      if (err.keyword === "anyOf" || err.keyword === "oneOf" || err.keyword === "if") continue;
      const msg = explain(err);
      if (!seen.has(msg)) {
        seen.add(msg);
        errors.push(`content/${file} → ${msg}`);
      }
    }
  }
  return data;
}

const isUrl = (s) => /^https?:\/\//i.test(s ?? "");
const inPublic = (p) => !!p && !isUrl(p) && fs.existsSync(path.join(PUBLIC, decodeURIComponent(p.replace(/^\/+/, ""))));
function expectFile(p, what, file) {
  if (!p) return;
  if (!p.startsWith("/")) errors.push(`content/${file} → ${what}: "${p}" should start with "/" (a path inside the public folder).`);
  else if (!inPublic(p)) warnings.push(`content/${file} → ${what}: public${p} not found yet (a placeholder is shown until it is added).`);
}

const data = {};
for (const [file, type] of Object.entries(FILES)) data[file] = load(file, type);

// Projects: one file each.
const projectDir = path.join(CONTENT, "projects");
const projectFiles = fs.existsSync(projectDir) ? fs.readdirSync(projectDir).filter((f) => f.endsWith(".json")).sort() : [];
const projects = projectFiles.map((f) => ({ file: f, data: load(`projects/${f}`, PROJECT_TYPE) }));

/* Extra checks a schema cannot express. */
const hero = data["hero.json"];
if (hero) expectFile(hero.portrait?.image, "portrait.image", "hero.json");
if (hero?.introVideo) for (const k of ["src", "poster", "backdrop", "captions"]) expectFile(hero.introVideo[k], `introVideo.${k}`, "hero.json");
const contact = data["contact.json"];
if (contact) expectFile(contact.headshot, "headshot", "contact.json");
const resume = data["resume.json"];
if (resume) expectFile(resume.file, "file", "resume.json");
resume?.variants?.forEach((v, i) => v.file && !v.file.startsWith("/media/") && expectFile(v.file, `variants → entry #${i + 1} → file`, "resume.json"));
data["honours.json"]?.certifications?.forEach((c, i) => c.image && expectFile(c.image, `certifications → entry #${i + 1} → image`, "honours.json"));
if (data["research.json"]?.image) expectFile(data["research.json"].image, "image", "research.json");
for (const { file, data: p } of projects) if (p?.image) expectFile(p.image, "image", `projects/${file}`);
data["beyond.json"]?.items?.forEach((b, i) => b.image && expectFile(b.image, `items → entry #${i + 1} → image`, "beyond.json"));
{
  const seen = new Set();
  for (const b of data["beyond.json"]?.items ?? []) {
    if (seen.has(b.id)) errors.push(`content/beyond.json → "id" "${b.id}" is used twice. Each card needs its own id.`);
    seen.add(b.id);
  }
}
data["research.json"]?.resources?.forEach((r, i) => !isUrl(r.href) && expectFile(r.href, `resources → entry #${i + 1} → href`, "research.json"));

data["proof.json"]?.items?.forEach((item, i) => {
  if (!item.dots) return;
  const { total, lit } = item.dots;
  if (!(total > 0 && total <= 600)) errors.push(`content/proof.json → items → entry #${i + 1} → dots → "total" must be between 1 and 600.`);
  if (!(lit >= 0 && lit <= total)) errors.push(`content/proof.json → items → entry #${i + 1} → dots → "lit" must be between 0 and "total".`);
});

const slugs = new Map();
const orders = new Map();
for (const { file, data: p } of projects) {
  if (!p) continue;
  const f = `projects/${file}`;
  if (slugs.has(p.slug)) errors.push(`content/${f} → "slug" "${p.slug}" is already used by content/projects/${slugs.get(p.slug)}. Each project needs its own slug.`);
  slugs.set(p.slug, file);
  if (p.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) errors.push(`content/${f} → "slug" must use lowercase letters, numbers and hyphens only (e.g. "my-project").`);
  if (orders.has(p.order)) warnings.push(`content/${f} → "order" ${p.order} is also used by ${orders.get(p.order)} (they will appear next to each other).`);
  orders.set(p.order, file);
  const link = p.link ?? {};
  if (link.type === "case-study" && !p.caseStudy) errors.push(`content/${f} → link "type" is "case-study" but this project has no "caseStudy". Add one, or change the link type.`);
  if (link.type === "page" && !/^\/[^/]/.test(link.href ?? "")) errors.push(`content/${f} → link "type" is "page", so "href" must be a path on this site, e.g. "/research/securitization-x-ray".`);
  if (link.type === "link" && !isUrl(link.href)) errors.push(`content/${f} → link "type" is "link", so "href" must be a full web address starting with https://`);
  if (link.type === "file") {
    if (!link.href) errors.push(`content/${f} → link "type" is "file", so "href" must be the file path, e.g. "/projects/${p.slug}/report.pdf".`);
    else expectFile(link.href, "link → href", f);
  }
  p.resources?.forEach((r, i) => {
    if (r.fileType === "link") {
      if (!isUrl(r.href)) errors.push(`content/${f} → resources → entry #${i + 1}: a "link" needs a full https:// address.`);
    } else expectFile(r.href, `resources → entry #${i + 1} → href`, f);
    if (r.preview) expectFile(r.preview, `resources → entry #${i + 1} → preview`, f);
  });
}

/* ------------------------------------------------------- 4. Projects list */
const generatedDir = path.join(ROOT, "src/content/generated");
fs.mkdirSync(generatedDir, { recursive: true });
const index =
  "// AUTO-GENERATED by scripts/content.mjs — do not edit.\n" +
  "// Lists every file in content/projects. Add or remove a project file and it updates on the next `npm run dev`.\n" +
  projectFiles.map((f, i) => `import p${i} from "../../../content/projects/${f}";`).join("\n") +
  `\n\nexport const projectFiles: unknown[] = [${projectFiles.map((_, i) => `p${i}`).join(", ")}];\n`;
const indexFile = path.join(generatedDir, "projects.ts");
if (!fs.existsSync(indexFile) || fs.readFileSync(indexFile, "utf8") !== index) fs.writeFileSync(indexFile, index);

/* ------------------------------------------------------------- Report */
const total = Object.keys(FILES).length + projectFiles.length;
if (warnings.length) {
  console.log(`\n⚠  Content notes (${warnings.length}) — the site still works:`);
  warnings.forEach((w) => console.log("   • " + w));
}
if (errors.length) {
  console.error(`\n✖  Content problems (${errors.length}) — please fix these, then save and run again:`);
  errors.forEach((e) => console.error("   • " + e));
  console.error("");
  process.exit(1);
}
console.log(`✔  Content OK — ${total} files checked (${projectFiles.length} projects).`);
