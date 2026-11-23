/** Media library paths: /media/<uuid>/<file name> (safe in client and server code). */
export const MEDIA_PATH = /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[A-Za-z0-9._-]+$/;

/** The media id in a library path, or null. */
export function mediaIdFromPath(p: unknown): string | null {
  return typeof p === "string" ? MEDIA_PATH.exec(p.split("?")[0])?.[1] ?? null : null;
}

/** Public URL of a library file. */
export const mediaUrl = (id: string, storagePath: string) => `/media/${id}/${storagePath.split("/").pop()}`;
/** Display URL for the admin (<img>, "open file"): adds a short-lived signed preview token, because
 *  such loads cannot carry the admin tab proof. Never store it in content — use mediaUrl for that. */
export const mediaViewUrl = (id: string, storagePath: string, token: string | null) => mediaUrl(id, storagePath) + (token ? `?pt=${token}` : "");

/** Every library id referenced anywhere in a value (deep). */
export function mediaIdsIn(value: unknown): string[] {
  const ids = new Set<string>();
  const re = /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//g;
  for (const m of JSON.stringify(value ?? null).matchAll(re)) ids.add(m[1]);
  return [...ids];
}
