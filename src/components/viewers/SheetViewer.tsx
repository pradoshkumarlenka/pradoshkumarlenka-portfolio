"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkBook, WorkSheet, CellObject } from "xlsx";
import { ViewerStatus } from "./ViewerModal";
import { fill } from "@/lib/content/selectors";
import { useUi } from "@/lib/content/client";

const ROW_H = 28;
const HEAD_H = 28;
const ROWNUM_W = 52;
const OVERSCAN = 6;

type SheetModel = {
  name: string;
  ws: WorkSheet;
  rows: number; // data extent (0-based last index + 1)
  cols: number;
  widths: number[];
  offsets: number[]; // left offset of each column
  totalWidth: number;
};

type XLSXModule = typeof import("xlsx");

/** Real data extent: SheetJS "!ref" can be inflated by formatting, so scan the cells. */
function extent(X: XLSXModule, ws: WorkSheet) {
  let rows = 0;
  let cols = 0;
  for (const key of Object.keys(ws)) {
    if (key[0] === "!") continue;
    const { r, c } = X.utils.decode_cell(key);
    if (r + 1 > rows) rows = r + 1;
    if (c + 1 > cols) cols = c + 1;
  }
  return { rows, cols };
}

/** What Excel shows in the cell (formatted text when available). Values only; nothing is executed. */
function display(cell: CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w !== undefined) return cell.w;
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  if (cell.t === "d" && cell.v instanceof Date) return cell.v.toLocaleDateString();
  if (cell.v === undefined || cell.v === null) return "";
  return String(cell.v);
}

function buildModel(X: XLSXModule, name: string, ws: WorkSheet): SheetModel {
  const { rows, cols } = extent(X, ws);
  const declared = ws["!cols"] ?? [];
  const widths: number[] = [];
  for (let c = 0; c < cols; c++) {
    const d = declared[c];
    let w = d?.wpx ?? (d?.wch ? d.wch * 7 + 12 : 0);
    if (!w) {
      let chars = 4;
      for (let r = 0; r < Math.min(rows, 300); r++) chars = Math.max(chars, display(ws[X.utils.encode_cell({ r, c })]).length);
      w = chars * 7.4 + 18;
    }
    widths.push(Math.round(Math.min(Math.max(w, 56), 340)));
  }
  const offsets: number[] = [];
  let x = 0;
  for (const w of widths) {
    offsets.push(x);
    x += w;
  }
  return { name, ws, rows, cols, widths, offsets, totalWidth: x };
}

/**
 * Internal, read-only Excel workbook preview (SheetJS). Real sheet names and
 * cell values; rows and columns are virtualized so large sheets stay fast.
 * Formulas are NOT recalculated (cached values shown); macros never run.
 */
export function SheetViewer({ src }: { src: string }) {
  const ui = useUi();
  const [X, setX] = useState<XLSXModule | null>(null);
  const [book, setBook] = useState<WorkBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, left: 0, w: 800, h: 500 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mod, res] = await Promise.all([import("xlsx"), fetch(src)]);
        if (!res.ok) throw new Error(`file not found (HTTP ${res.status})`);
        const data = await res.arrayBuffer();
        // Values + formats only: no VBA, no formulas evaluated, no external links followed.
        const wb = mod.read(data, { type: "array", cellDates: true, bookVBA: false, cellFormula: false, cellHTML: false });
        if (!cancelled) {
          setX(mod);
          setBook(wb);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const sheets = useMemo(
    () => (X && book ? book.SheetNames.map((name) => buildModel(X, name, book.Sheets[name])) : []),
    [X, book],
  );
  const sheet = sheets[active];

  // Viewport tracking for virtualization.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const sync = () => setView({ top: el.scrollTop, left: el.scrollLeft, w: el.clientWidth, h: el.clientHeight });
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sheet]);

  const switchTo = (i: number) => {
    setActive(i);
    scroller.current?.scrollTo({ top: 0, left: 0 });
  };

  if (error) return <ViewerStatus kind="error">{fill(ui.viewer.workbookError, { error })}</ViewerStatus>;
  if (!X || !book) return <ViewerStatus kind="loading">{ui.viewer.loadingWorkbook}</ViewerStatus>;

  const firstRow = sheet ? Math.max(0, Math.floor(view.top / ROW_H) - OVERSCAN) : 0;
  const lastRow = sheet ? Math.min(sheet.rows, Math.ceil((view.top + view.h) / ROW_H) + OVERSCAN) : 0;
  let firstCol = 0;
  let lastCol = 0;
  if (sheet) {
    const left = view.left;
    const right = view.left + view.w;
    while (firstCol < sheet.cols - 1 && sheet.offsets[firstCol] + sheet.widths[firstCol] < left) firstCol++;
    lastCol = firstCol;
    while (lastCol < sheet.cols && sheet.offsets[lastCol] < right) lastCol++;
    firstCol = Math.max(0, firstCol - 2);
    lastCol = Math.min(sheet.cols, lastCol + 2);
  }
  const visibleCols = Array.from({ length: Math.max(0, lastCol - firstCol) }, (_, i) => firstCol + i);

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Worksheets" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 pt-2 [scrollbar-width:thin]">
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => switchTo(i)}
            className={`shrink-0 rounded-t-[8px] border border-b-0 px-3 py-1.5 text-xs transition-colors duration-150 ${
              i === active ? "border-line-strong bg-surface text-fg" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {sheet && sheet.rows === 0 ? (
        <ViewerStatus kind="info">{ui.viewer.emptySheet}</ViewerStatus>
      ) : sheet ? (
        <div
          ref={scroller}
          role="grid"
          aria-label={`${sheet.name}: ${sheet.rows} rows × ${sheet.cols} columns`}
          aria-rowcount={sheet.rows + 1}
          aria-colcount={sheet.cols + 1}
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-auto bg-canvas font-mono text-[12px]"
        >
          <div style={{ width: ROWNUM_W + sheet.totalWidth, height: HEAD_H + sheet.rows * ROW_H, position: "relative" }}>
            {/* Column letters (sticky top) */}
            <div className="sticky top-0 z-20 flex" style={{ height: HEAD_H, width: ROWNUM_W + sheet.totalWidth }} role="row">
              <div className="sticky left-0 z-30 border-b border-r border-line bg-surface" style={{ width: ROWNUM_W }} />
              {visibleCols.map((c) => (
                <div
                  key={c}
                  role="columnheader"
                  className="absolute flex items-center justify-center border-b border-r border-line bg-surface text-fg-subtle"
                  style={{ left: ROWNUM_W + sheet.offsets[c], width: sheet.widths[c], height: HEAD_H }}
                >
                  {X.utils.encode_col(c)}
                </div>
              ))}
            </div>
            {/* Rows */}
            {Array.from({ length: lastRow - firstRow }, (_, i) => firstRow + i).map((r) => (
              <div key={r} role="row" className="absolute left-0" style={{ top: HEAD_H + r * ROW_H, height: ROW_H, width: ROWNUM_W + sheet.totalWidth }}>
                <div
                  role="rowheader"
                  className="sticky left-0 z-10 flex h-full items-center justify-end border-b border-r border-line bg-surface pr-2 text-fg-subtle"
                  style={{ width: ROWNUM_W }}
                >
                  {r + 1}
                </div>
                {visibleCols.map((c) => {
                  const cell = sheet.ws[X.utils.encode_cell({ r, c })] as CellObject | undefined;
                  const text = display(cell);
                  const numeric = cell?.t === "n" || cell?.t === "d";
                  return (
                    <div
                      key={c}
                      role="gridcell"
                      title={text.length * 7 > sheet.widths[c] ? text : undefined}
                      className={`absolute top-0 h-full truncate border-b border-r border-line/70 px-2 leading-[28px] ${
                        numeric ? "text-right text-fg" : "text-left text-fg"
                      } ${cell?.t === "e" ? "text-negative" : ""}`}
                      style={{ left: ROWNUM_W + sheet.offsets[c], width: sheet.widths[c] }}
                    >
                      {text}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="shrink-0 border-t border-line px-4 py-2 text-[11px] text-fg-subtle">
        {ui.viewer.workbookNote}
        {sheet ? ` ${sheet.name}: ${sheet.rows.toLocaleString()} rows × ${sheet.cols} columns.` : ""}
      </p>
    </div>
  );
}
