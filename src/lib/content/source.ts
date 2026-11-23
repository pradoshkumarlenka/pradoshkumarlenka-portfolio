import "server-only";
import { STATIC_CONTENT, type ContentKey, type ContentMap } from "./registry";
import { databaseSource } from "./database-source";
import { draftSource } from "./draft-source";

/**
 * CONTENT SOURCES — where a block can come from, tried in order.
 *
 * 1. draftSource    — unpublished drafts, ONLY for the admin in Draft Mode preview
 *                     (null for everyone else, without any query);
 * 2. databaseSource — published blocks from Supabase (content_published);
 * 3. jsonSource     — the bundled content/*.json files.
 * Anything the database cannot provide (not saved, invalid, or unreachable)
 * falls through to the JSON, so visitors always get a complete page.
 */
export interface ContentSource {
  readonly name: string;
  /** The block, or null when this source does not have it. Must never throw for "not found". */
  get<K extends ContentKey>(key: K): Promise<ContentMap[K] | null>;
}

/** The permanent fallback: content/*.json bundled with the site. */
export const jsonSource: ContentSource = {
  name: "json",
  async get(key) {
    return STATIC_CONTENT[key];
  },
};

/** Sources in priority order. Keep jsonSource last — it guarantees every block resolves. */
export const SOURCES: readonly ContentSource[] = [draftSource, databaseSource, jsonSource];
