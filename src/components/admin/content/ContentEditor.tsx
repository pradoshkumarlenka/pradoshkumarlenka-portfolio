"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { discardContentDraft, publishContent, saveContentDraft, type ContentActionResult } from "@/lib/admin/content-actions";
import { SchemaField, humanize, type Errors, type Schema } from "./SchemaForm";
import { card, dangerBtn, field as fieldCls, label as labelCls, primaryBtn, secondaryBtn } from "../styles";
import { StartPreviewButton } from "../AdminRequests";

interface Props {
  blockKey: string;
  schema: Schema;
  published: { data: unknown; version: number; updatedAt: string } | null;
  draft: { data: unknown; baseVersion: number | null; updatedAt: string } | null;
  fallback: unknown;
}

const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const pretty = (v: unknown) => JSON.stringify(v, null, 2);

/** Draft → publish editor for one content block. Every action is re-checked on the server. */
export function ContentEditor({ blockKey, schema, published, draft, fallback }: Props) {
  const router = useRouter();
  const saved = draft?.data ?? published?.data ?? fallback;
  const savedJson = useMemo(() => JSON.stringify(saved), [saved]);
  const [value, setValue] = useState<unknown>(() => structuredClone(saved));
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ContentActionResult | null>(null);
  const [pending, start] = useTransition();
  // Unsaved = the form value differs from what is saved, or (JSON mode) the text was edited.
  const dirty = JSON.stringify(value) !== savedJson || (mode === "json" && jsonText !== pretty(value));
  const errors: Errors = useMemo(() => {
    const e: Errors = {};
    if (result && !result.ok) for (const i of result.issues ?? []) e[i.path] ??= i.message;
    return e;
  }, [result]);
  const stale = Boolean(draft && published && draft.baseVersion !== null && draft.baseVersion !== published.version);

  // Reset local state when the server sends new data (after save / publish / discard).
  const [syncedJson, setSyncedJson] = useState(savedJson);
  if (syncedJson !== savedJson) {
    setSyncedJson(savedJson);
    setValue(structuredClone(saved));
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const run = (fn: () => Promise<ContentActionResult>) =>
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.ok) router.refresh();
      } catch {
        setResult({ ok: false, error: "Not authorised, or the connection failed. Please sign in again." });
      }
    });

  const current = () => (mode === "json" ? parseJson() : value);
  function parseJson(): unknown {
    try {
      const v = JSON.parse(jsonText);
      setJsonError(null);
      return v;
    } catch (e) {
      setJsonError((e as Error).message);
      return undefined;
    }
  }
  const switchMode = (m: "form" | "json") => {
    if (m === mode) return;
    if (m === "json") { setJsonText(pretty(value)); setJsonError(null); setMode("json"); return; }
    const v = parseJson();
    if (v !== undefined) { setValue(v); setMode("form"); }
  };
  const save = () => {
    const v = current();
    if (v === undefined) return;
    if (mode === "json") setValue(v);
    run(() => saveContentDraft(blockKey, JSON.stringify(v), published?.version ?? null));
  };
  const publish = () => {
    if (!confirm("Publish this draft? Visitors will see it immediately.")) return;
    run(async () => {
      const r = await publishContent(blockKey, published?.version ?? null, note);
      if (r.ok) setNote("");
      return r;
    });
  };
  const discard = () => {
    if (!confirm("Discard the draft? The published version stays as it is.")) return;
    run(() => discardContentDraft(blockKey));
  };
  const issueList = result && !result.ok ? result.issues ?? [] : [];

  return (
    <div className="space-y-6">
      <section className={`${card} flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm`} aria-label="Status">
        <span>
          <span className="text-fg-muted">Live: </span>
          {published ? <>version {published.version} · {when(published.updatedAt)}</> : <span className="text-fg-muted">the site file (not yet in the database)</span>}
        </span>
        <span>
          <span className="text-fg-muted">Draft: </span>
          {draft ? <span className="text-lavender">saved {when(draft.updatedAt)}</span> : <span className="text-fg-muted">none</span>}
        </span>
        {dirty && <span className="text-lavender">● Unsaved changes</span>}
        <span className="flex-1" />
        <a href={`/admin/content/${blockKey}/history`} className="text-fg-muted hover:text-fg">History</a>
        <StartPreviewButton path="/" label="Preview drafts →" className="text-fg-muted hover:text-fg disabled:opacity-40"
          disabled={!draft || dirty} title={!draft ? "Save a draft to preview it" : dirty ? "Save or undo your changes first" : "See saved drafts inside the real site (in this tab)"} />
      </section>

      {stale && (
        <p role="alert" className="rounded-control border border-lavender/40 bg-lavender/10 p-3 text-sm">
          This draft was started from version {draft!.baseVersion}, but version {published!.version} has been published since. Publishing it will replace version {published!.version}.
        </p>
      )}

      {result && (
        <div role={result.ok ? "status" : "alert"} className={`rounded-control border p-3 text-sm ${result.ok ? "border-positive/40 text-positive" : "border-negative/40 text-negative"}`}>
          {result.ok ? result.message : result.error}
          {issueList.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
              {issueList.slice(0, 20).map((i, k) => (
                <li key={k}><span className="font-mono">{i.path.split("/").filter(Boolean).map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : humanize(p))).join(" › ") || "Block"}</span>: {i.message}</li>
              ))}
              {issueList.length > 20 && <li>…and {issueList.length - 20} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Editor mode" className="inline-flex rounded-chip border border-line p-0.5 text-sm">
          {(["form", "json"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => switchMode(m)}
              className={`rounded-chip px-4 py-1.5 ${mode === m ? "bg-violet text-on-violet" : "text-fg-muted hover:text-fg"}`}>
              {m === "form" ? "Form" : "JSON (advanced)"}
            </button>
          ))}
        </div>
        {dirty && <button type="button" className={secondaryBtn} onClick={() => { setValue(structuredClone(saved)); setResult(null); if (mode === "json") setJsonText(pretty(saved)); }}>Undo unsaved changes</button>}
      </div>

      <section className={`${card} p-5`}>
        {mode === "form" ? (
          <SchemaField schema={schema} value={value} onChange={setValue} path="" name="" errors={errors} depth={0} />
        ) : (
          <div>
            <label htmlFor="json" className={labelCls}>Block as JSON</label>
            <textarea id="json" spellCheck={false} className={`${fieldCls} min-h-[28rem] font-mono text-xs leading-relaxed`} value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }} aria-invalid={jsonError ? true : undefined} />
            {jsonError && <p className="mt-1 text-xs text-negative">Not valid JSON: {jsonError}</p>}
          </div>
        )}
      </section>

      <section className={`${card} sticky bottom-3 z-10 flex flex-wrap items-end gap-3 p-4 shadow-lg backdrop-blur`} aria-label="Actions">
        <button type="button" className={primaryBtn} disabled={pending || (!dirty && Boolean(draft))} onClick={save}>
          {pending ? "Working…" : "Save draft"}
        </button>
        <div className="flex min-w-[12rem] flex-1 items-end gap-3">
          <div className="flex-1">
            <label htmlFor="note" className={labelCls}>Change note (optional)</label>
            <input id="note" className={fieldCls} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated phone number" />
          </div>
          <button type="button" className={secondaryBtn} disabled={pending || !draft || dirty} onClick={publish}
            title={!draft ? "Save a draft first" : dirty ? "Save your changes first" : undefined}>
            Publish
          </button>
        </div>
        {draft && <button type="button" className={dangerBtn} disabled={pending} onClick={discard}>Discard draft</button>}
      </section>
    </div>
  );
}
