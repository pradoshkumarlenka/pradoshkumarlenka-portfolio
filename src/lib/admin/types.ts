/** Rows of the Supabase tables (see supabase/schema.sql). */
export type ItemState = "draft" | "published" | "archived";
export type FileKind = "pdf" | "ppt" | "pptx" | "doc" | "docx" | "xls" | "xlsx";

export interface ItemRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  description: string;
  highlights: string[];
  cover_path: string | null;
  cover_alt: string;
  work_status: string;
  state: ItemState;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttachmentRow {
  id: string;
  item_id: string;
  title: string;
  kind: FileKind;
  storage_path: string;
  preview_path: string | null;
  size_bytes: number;
  label: string | null;
  sort_order: number;
  created_at: string;
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> };
