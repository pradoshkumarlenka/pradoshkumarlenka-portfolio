/** Pages the draft preview may open (no open redirects: only these shapes, same origin). */
const PREVIEW_PATH = /^\/(?:(?:projects|research|work)\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

export function safePreviewPath(input: unknown): string {
  return typeof input === "string" && PREVIEW_PATH.test(input) ? input : "/";
}
