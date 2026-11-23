"use client";

import { useId, useState } from "react";
import { field as fieldCls, secondaryBtn } from "../styles";
import { MediaPicker } from "../media/MediaPicker";

/** Which media-library files fit a field (null = no picker: video, captions, plain text). */
const ASSET_KEY = /(image|src|poster|backdrop|photo|headshot|download|thumbnail|cover|file|preview)$/i;
function pickerKind(name: string, schema: Schema): "image" | "pdf" | null {
  const desc = schema.description ?? "";
  if (!ASSET_KEY.test(name) && !/\/public/i.test(desc)) return null;
  if (/video|\.vtt|caption|\.mp4/i.test(`${name} ${desc}`)) return null;
  if (/pdf|file|download|resume|résumé|document/i.test(`${name} ${desc}`)) return "pdf";
  return "image";
}

/*
 * SCHEMA FORM — a form generated from a block's JSON schema (content/schemas).
 * Supports exactly what those schemas use: object, array, string, number,
 * integer, boolean, enum, const, nullable types (["string","null"]) and
 * anyOf variants told apart by a const "kind". The server validates again.
 * Values are rendered by React as plain text: nothing is ever injected as HTML.
 */

export type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  description?: string;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
};
type Json = unknown;
type Obj = Record<string, Json>;
export type Errors = Record<string, string>;

const smallLabel = "mb-1 block text-xs font-medium text-fg-muted";
const help = "mt-1 text-xs text-fg-subtle";
// min 24×24 px targets (WCAG 2.2 target size)
const linkBtn = "inline-flex min-h-6 min-w-6 items-center justify-center px-1 text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-30 disabled:no-underline";

export const humanize = (k: string) =>
  k === "$schema" ? "Schema" : k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());

const typesOf = (s: Schema): string[] => (Array.isArray(s.type) ? s.type : s.type ? [s.type] : []);
const isObj = (v: Json): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** A sensible empty value for a schema (used when adding list entries or fields). */
export function defaultFor(s: Schema): Json {
  if (s.const !== undefined) return s.const;
  if (s.anyOf?.length) return defaultFor(s.anyOf[0]);
  if (s.enum?.length) return s.enum[0];
  const t = typesOf(s);
  if (t.includes("null")) return null;
  switch (t[0]) {
    case "object": {
      const o: Obj = {};
      for (const k of s.required ?? []) if (s.properties?.[k]) o[k] = defaultFor(s.properties[k]);
      return o;
    }
    case "array": return [];
    case "number": case "integer": return 0;
    case "boolean": return false;
    default: return "";
  }
}

/** A short title for a list entry: its first name-like text field. */
function entryTitle(v: Json, i: number): string {
  if (typeof v === "string") return v || `Entry ${i + 1}`;
  if (isObj(v)) {
    for (const k of ["title", "name", "label", "heading", "kind", "caption", "value", "id", "slug", "text"]) {
      const x = v[k];
      if (typeof x === "string" && x.trim()) return x.length > 70 ? x.slice(0, 70) + "…" : x;
    }
  }
  return `Entry ${i + 1}`;
}

const LONG_KEYS = /(summary|body|description|text|quote|paragraph|blurb|intro|note|detail|lede|story|about|caption|bio)/i;
const fieldId = (path: string) => `f${path.replace(/[^A-Za-z0-9]/g, "_")}`;

function ErrorText({ path, errors }: { path: string; errors: Errors }) {
  return errors[path] ? <p id={`${fieldId(path)}-err`} className="mt-1 text-xs text-negative">{errors[path]}</p> : null;
}
/** Errors under this path (for collapsed groups). */
const errorsWithin = (path: string, errors: Errors) => Object.keys(errors).filter((p) => p === path || p.startsWith(path + "/")).length;

interface FieldProps {
  schema: Schema;
  value: Json;
  onChange: (v: Json) => void;
  path: string;
  name: string;
  errors: Errors;
  depth: number;
  /** Set by the parent object: picking a library file can also fill an empty alt text next to it. */
  onPickMedia?: (url: string, alt: string) => void;
}

export function SchemaField(props: FieldProps) {
  const { schema, value, onChange, path, name, errors } = props;
  const id = fieldId(path);
  const aria = { "aria-invalid": errors[path] ? true : undefined, "aria-describedby": errors[path] ? `${id}-err` : undefined };
  const title = humanize(name);
  const desc = schema.description ? <p className={help}>{schema.description}</p> : null;

  if (schema.anyOf?.length) return <VariantField {...props} />;
  if (schema.const !== undefined) {
    return (
      <div>
        <span className={smallLabel}>{title}</span>
        <p className="font-mono text-xs text-fg-subtle">{String(schema.const)}</p>
      </div>
    );
  }
  const types = typesOf(schema);
  if (types.includes("null") && types.length === 2) {
    const inner: Schema = { ...schema, type: types.find((t) => t !== "null") };
    const isNull = value === null || value === undefined;
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} className={smallLabel}>{title}</label>
          <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <input type="checkbox" checked={isNull} onChange={(e) => onChange(e.target.checked ? null : defaultFor(inner))} />
            None
          </label>
        </div>
        {!isNull && <SchemaField {...props} schema={{ ...inner, description: undefined }} name="" />}
        {isNull && <p className="text-xs text-fg-subtle">Not set.</p>}
        {desc}
        <ErrorText path={path} errors={errors} />
      </div>
    );
  }
  const t = types[0];
  if (t === "object") return <ObjectField {...props} />;
  if (t === "array") return <ArrayField {...props} />;

  const labelEl = name ? <label htmlFor={id} className={smallLabel}>{title}</label> : null;
  if (schema.enum) {
    return (
      <div>
        {labelEl}
        <select id={id} className={fieldCls} value={String(value ?? "")} onChange={(e) => onChange(schema.enum!.find((x) => String(x) === e.target.value))} {...aria}>
          {schema.enum.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
        </select>
        {desc}
        <ErrorText path={path} errors={errors} />
      </div>
    );
  }
  if (t === "boolean") {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} {...aria} />
          {title}
        </label>
        {desc}
        <ErrorText path={path} errors={errors} />
      </div>
    );
  }
  if (t === "number" || t === "integer") return <NumberField {...props} integer={t === "integer"} />;

  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  if (schema.pattern === "^#[0-9a-fA-F]{6}$") {
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-2">
          <input type="color" aria-label={`${title} colour picker`} className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-line-strong bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(text) ? text : "#000000"} onChange={(e) => onChange(e.target.value)} />
          <input id={id} className={`${fieldCls} font-mono`} value={text} maxLength={7} onChange={(e) => onChange(e.target.value)} {...aria} />
        </div>
        {desc}
        <ErrorText path={path} errors={errors} />
      </div>
    );
  }
  const picker = name ? pickerKind(name, schema) : null;
  if (picker) {
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-2">
          <input id={id} className={`${fieldCls} font-mono text-xs`} value={text} onChange={(e) => onChange(e.target.value)} {...aria} />
          <MediaPicker kind={picker} onPick={(url, alt) => (props.onPickMedia ? props.onPickMedia(url, alt) : onChange(url))} />
        </div>
        {desc}
        <ErrorText path={path} errors={errors} />
      </div>
    );
  }
  const long = text.length > 90 || text.includes("\n") || LONG_KEYS.test(name);
  return (
    <div>
      {labelEl}
      {long ? (
        <textarea id={id} className={`${fieldCls} min-h-24 resize-y leading-relaxed`} rows={Math.min(12, Math.max(3, Math.ceil(text.length / 90)))} value={text} onChange={(e) => onChange(e.target.value)} {...aria} />
      ) : (
        <input id={id} className={fieldCls} value={text} onChange={(e) => onChange(e.target.value)} {...aria} />
      )}
      {desc}
      <ErrorText path={path} errors={errors} />
    </div>
  );
}

function NumberField({ schema, value, onChange, path, name, errors, integer }: FieldProps & { integer: boolean }) {
  const id = fieldId(path);
  const [text, setText] = useState(value === undefined || value === null ? "" : String(value));
  // Keep what is being typed ("1.", "-"), but follow outside changes (reorder, JSON mode).
  const shown = text === "" || text === "-" || Number(text) === value ? text : String(value ?? "");
  return (
    <div>
      {name && <label htmlFor={id} className={smallLabel}>{humanize(name)}</label>}
      {schema.minimum !== undefined && schema.maximum !== undefined && (
        <div className="mb-1.5 flex items-center gap-3">
          <input
            type="range"
            aria-label={`${humanize(name || "value")} slider`}
            className="flex-1 accent-violet"
            min={schema.minimum}
            max={schema.maximum}
            step={integer ? 1 : Math.max((schema.maximum - schema.minimum) / 200, 0.001)}
            value={typeof value === "number" ? value : schema.minimum}
            onChange={(e) => { const n = Number(e.target.value); setText(String(n)); onChange(integer ? Math.trunc(n) : n); }}
          />
          <span className="tabular w-24 text-right font-mono text-[11px] text-fg-subtle">{schema.minimum} – {schema.maximum}</span>
        </div>
      )}
      <input
        id={id}
        inputMode="decimal"
        className={`${fieldCls} tabular font-mono`}
        value={shown}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(integer ? Math.trunc(n) : n);
        }}
        aria-invalid={errors[path] ? true : undefined}
      />
      {schema.description && <p className={help}>{schema.description}</p>}
      <ErrorText path={path} errors={errors} />
    </div>
  );
}

function ObjectField({ schema, value, onChange, path, name, errors, depth }: FieldProps) {
  const obj = isObj(value) ? value : {};
  const props = Object.entries(schema.properties ?? {}).filter(([k]) => k !== "$schema");
  const required = new Set(schema.required ?? []);
  const set = (k: string, v: Json) => onChange({ ...obj, [k]: v });
  const remove = (k: string) => { const next = { ...obj }; delete next[k]; onChange(next); };
  const body = (
    <div className="grid gap-4 [&>*]:min-w-0">
      {props.map(([k, s]) => {
        const p = `${path}/${k}`;
        if (!required.has(k) && !(k in obj)) {
          return (
            <div key={k} className="flex items-center justify-between gap-3 rounded-control border border-dashed border-line px-3 py-2">
              <span className="text-xs text-fg-subtle">{humanize(k)} <span className="text-fg-subtle/70">(optional, not set)</span></span>
              <button type="button" className={linkBtn} onClick={() => set(k, defaultFor(s))}>+ Add</button>
            </div>
          );
        }
        return (
          <div key={k} className="relative">
            <SchemaField schema={s} value={obj[k]} onChange={(v) => set(k, v)} path={p} name={k} errors={errors} depth={depth + 1}
              onPickMedia={(url, alt) => {
                const next: Obj = { ...obj, [k]: url };
                const altKey = ["alt", `${k}Alt`].find((a) => a in (schema.properties ?? {}) && !obj[a]);
                if (altKey && alt) next[altKey] = alt;
                onChange(next);
              }} />
            {!required.has(k) && (
              <button type="button" className={`${linkBtn} absolute right-0 top-0`} onClick={() => remove(k)} aria-label={`Remove ${humanize(k)}`}>Remove</button>
            )}
          </div>
        );
      })}
      <ErrorText path={path} errors={errors} />
    </div>
  );
  if (depth === 0 || !name) return body;
  return <Group title={humanize(name)} description={schema.description} errorCount={errorsWithin(path, errors)} defaultOpen={depth <= 1}>{body}</Group>;
}

function Group({ title, description, errorCount, defaultOpen, children, actions }: { title: string; description?: string; errorCount: number; defaultOpen: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    // The entry controls sit beside the summary, not inside it (no buttons nested in an interactive summary).
    <div className="relative min-w-0">
      <details open={defaultOpen || errorCount > 0} className="group min-w-0 rounded-control border border-line bg-canvas/30">
        <summary className={`flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm text-fg marker:hidden ${actions ? "pr-36" : ""}`}>
          <span aria-hidden className="text-fg-subtle transition-transform group-open:rotate-90">›</span>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {errorCount > 0 && <span className="rounded-chip bg-negative/15 px-2 text-[11px] text-negative">{errorCount} to fix</span>}
        </summary>
        <div className="border-t border-line px-3 py-4">
          {description && <p className={`${help} -mt-1 mb-4`}>{description}</p>}
          {children}
        </div>
      </details>
      {actions && <div className="absolute right-2 top-1.5">{actions}</div>}
    </div>
  );
}

function ArrayField({ schema, value, onChange, path, name, errors, depth }: FieldProps) {
  const list = Array.isArray(value) ? value : [];
  const itemSchema = schema.items ?? {};
  const simple = !typesOf(itemSchema).some((t) => t === "object" || t === "array") && !itemSchema.anyOf;
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  // Removes ONLY entry i, from the draft. Nothing changes on the live site until Publish;
  // until then "Discard draft" undoes it, and after publishing History → Restore does.
  const removeAt = (i: number) => {
    const label = entryTitle(list[i], i);
    if (!confirm(`Remove “${label}”?\n\nThis only changes your draft. If this entry is published it stays on the website until you publish; you can undo with “Discard draft” or later with History → Restore. Linked media files are not deleted.`)) return;
    onChange(list.filter((_, k) => k !== i));
  };
  const add = () => onChange([...list, defaultFor(itemSchema)]);
  const controls = (i: number) => (
    <span className="flex shrink-0 items-center gap-2" onClick={(e) => e.preventDefault()}>
      <button type="button" className={linkBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move entry ${i + 1} up`}>↑</button>
      <button type="button" className={linkBtn} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move entry ${i + 1} down`}>↓</button>
      <button type="button" className={`${linkBtn} hover:text-negative`} onClick={() => removeAt(i)} aria-label={`Remove entry ${i + 1}`}>Remove</button>
    </span>
  );
  const body = (
    <div className="grid gap-3 [&>*]:min-w-0">
      {list.length === 0 && <p className="text-xs text-fg-subtle">No entries.</p>}
      {list.map((v, i) =>
        simple ? (
          <div key={i} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <SchemaField schema={itemSchema} value={v} onChange={(nv) => onChange(list.map((x, k) => (k === i ? nv : x)))} path={`${path}/${i}`} name="" errors={errors} depth={depth + 1} />
            </div>
            <div className="pt-2.5">{controls(i)}</div>
          </div>
        ) : (
          <Group key={i} title={`${i + 1}. ${entryTitle(v, i)}`} errorCount={errorsWithin(`${path}/${i}`, errors)} defaultOpen={false} actions={controls(i)}>
            <SchemaField schema={itemSchema} value={v} onChange={(nv) => onChange(list.map((x, k) => (k === i ? nv : x)))} path={`${path}/${i}`} name="" errors={errors} depth={0} />
          </Group>
        ),
      )}
      <div><button type="button" className={secondaryBtn} onClick={add}>+ Add entry</button></div>
      <ErrorText path={path} errors={errors} />
    </div>
  );
  if (!name) return body;
  return <Group title={`${humanize(name)} (${list.length})`} description={schema.description} errorCount={errorsWithin(path, errors)} defaultOpen={depth <= 1 && list.length <= 8}>{body}</Group>;
}

function VariantField({ schema, value, onChange, path, name, errors, depth }: FieldProps) {
  const variants = schema.anyOf ?? [];
  const id = useId();
  const discriminator = (s: Schema) => Object.entries(s.properties ?? {}).find(([, p]) => p.const !== undefined);
  const current = Math.max(0, variants.findIndex((s) => {
    const d = discriminator(s);
    return d && isObj(value) && value[d[0]] === d[1].const;
  }));
  const label = (s: Schema, i: number) => String(discriminator(s)?.[1].const ?? `Layout ${i + 1}`);
  return (
    <Group title={humanize(name || "layout")} description={schema.description} errorCount={errorsWithin(path, errors)} defaultOpen={depth <= 1}>
      <div className="mb-4">
        <label htmlFor={id} className={smallLabel}>Layout</label>
        <select
          id={id}
          className={fieldCls}
          value={current}
          onChange={(e) => {
            if (!confirm("Switching the layout replaces this block's fields with empty ones. Continue?")) return;
            onChange(defaultFor(variants[Number(e.target.value)]));
          }}
        >
          {variants.map((s, i) => <option key={i} value={i}>{label(s, i)}</option>)}
        </select>
      </div>
      <SchemaField schema={variants[current]} value={value} onChange={onChange} path={path} name="" errors={errors} depth={0} />
    </Group>
  );
}
