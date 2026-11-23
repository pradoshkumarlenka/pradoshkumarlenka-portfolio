import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { ProjectResource } from "@/content/types";
import { MEDIA_PATH } from "@/lib/media/paths";

/**
 * Asset checks run on the server at build/render time, so a missing file
 * becomes a tidy placeholder instead of a broken image or dead link.
 * Drop the file into /public and it appears automatically.
 */

const publicDir = path.join(process.cwd(), "public");

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** True when a /public-relative path points to a real file. */
export function publicFileExists(publicPath: string | null | undefined): boolean {
  if (!publicPath || isExternal(publicPath)) return false;
  // Media-library files live in private storage; the /media route decides who may see them.
  if (MEDIA_PATH.test(publicPath.split("?")[0])) return true;
  const resolved = path.join(publicDir, decodeURIComponent(publicPath.replace(/^\/+/, "")));
  // Never resolve outside /public.
  if (!resolved.startsWith(publicDir)) return false;
  try {
    return fs.statSync(resolved).isFile();
  } catch {
    return false;
  }
}

/** Returns the path if the file exists, otherwise null (→ placeholder). */
export function resolveAsset(publicPath: string | null | undefined): string | null {
  return publicFileExists(publicPath) ? (publicPath as string) : null;
}

/** Drops a `preview` that points to a missing file (the resource falls back to download only). */
const withExistingPreview = (r: ProjectResource): ProjectResource =>
  r.preview && !publicFileExists(r.preview) ? { ...r, preview: undefined } : r;

/**
 * Keeps only resources that can actually be opened: external https links and
 * local files that exist. Missing local files are dropped (with a dev warning)
 * so visitors never see a dead resource.
 */
export function resolveResources(resources: ProjectResource[], projectSlug: string): ProjectResource[] {
  return resources.map(withExistingPreview).filter((resource) => {
    if (resource.fileType === "link" || resource.action === "external") {
      return isExternal(resource.href);
    }
    const ok = publicFileExists(resource.href);
    if (!ok && process.env.NODE_ENV !== "production") {
      console.warn(`[resources] "${projectSlug}": file not found in /public → ${resource.href} (hidden)`);
    }
    return ok;
  });
}
