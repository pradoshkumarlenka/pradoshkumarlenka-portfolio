import type { FileKind } from "./types";

/** Field rules — the same limits the database enforces (supabase/schema.sql). */
export const LIMITS = { slug: 80, title: 200, category: 80, summary: 600, description: 20000, highlights: 12, highlight: 300, coverAlt: 300, workStatus: 40, fileTitle: 200, label: 60 } as const;

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB (bucket limit)
export const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5 MB for cover images

/** Allowed attachment formats: extension → kind + accepted MIME types. */
export const ATTACHMENT_TYPES: Record<string, { kind: FileKind; mime: string[] }> = {
  pdf: { kind: "pdf", mime: ["application/pdf"] },
  ppt: { kind: "ppt", mime: ["application/vnd.ms-powerpoint"] },
  pptx: { kind: "pptx", mime: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
  doc: { kind: "doc", mime: ["application/msword"] },
  docx: { kind: "docx", mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  xls: { kind: "xls", mime: ["application/vnd.ms-excel"] },
  xlsx: { kind: "xlsx", mime: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
};
export const COVER_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export const extOf = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");

/** Safe storage file name: lowercase letters, digits, dot, dash, underscore; keeps the extension. */
export function safeFileName(name: string) {
  const ext = extOf(name);
  const base = name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60) || "file";
  return `${base}.${ext}`.toLowerCase();
}

export const slugify = (s: string) =>
  s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, LIMITS.slug);

export interface ItemInput {
  slug: string;
  title: string;
  category: string;
  summary: string;
  description: string;
  highlights: string[];
  cover_alt: string;
  work_status: string;
}

/** Parses and validates the item form. Returns field-level errors in plain words. */
export function parseItemForm(form: FormData): { data?: ItemInput; fields?: Record<string, string> } {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const title = s("title");
  const data: ItemInput = {
    title,
    slug: s("slug") || slugify(title),
    category: s("category"),
    summary: s("summary"),
    description: s("description"),
    highlights: s("highlights").split(/\r?\n/).map((h) => h.trim()).filter(Boolean),
    cover_alt: s("cover_alt"),
    work_status: s("work_status") || "Completed",
  };
  const f: Record<string, string> = {};
  if (!data.title) f.title = "Title is required.";
  else if (data.title.length > LIMITS.title) f.title = `At most ${LIMITS.title} characters.`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.slug) || data.slug.length > LIMITS.slug) f.slug = "Use lowercase letters, numbers and single dashes (e.g. dfi-bond-portfolio).";
  if (data.category.length > LIMITS.category) f.category = `At most ${LIMITS.category} characters.`;
  if (data.summary.length > LIMITS.summary) f.summary = `At most ${LIMITS.summary} characters.`;
  if (data.description.length > LIMITS.description) f.description = `At most ${LIMITS.description} characters.`;
  if (data.highlights.length > LIMITS.highlights) f.highlights = `At most ${LIMITS.highlights} highlights.`;
  else if (data.highlights.some((h) => h.length > LIMITS.highlight)) f.highlights = `Each highlight at most ${LIMITS.highlight} characters.`;
  if (data.cover_alt.length > LIMITS.coverAlt) f.cover_alt = `At most ${LIMITS.coverAlt} characters.`;
  if (data.work_status.length > LIMITS.workStatus) f.work_status = `At most ${LIMITS.workStatus} characters.`;
  return Object.keys(f).length ? { fields: f } : { data };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
