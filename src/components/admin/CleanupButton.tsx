"use client";

import { useState, useTransition } from "react";
import { cleanUpUnusedFiles } from "@/lib/admin/file-actions";
import type { ActionResult } from "@/lib/admin/types";
import { secondaryBtn } from "./styles";

/** Storage housekeeping: removes files nothing points to any more. */
export function CleanupButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" className={secondaryBtn} disabled={pending} onClick={() => start(async () => setResult(await cleanUpUnusedFiles()))}>
        {pending ? "Checking…" : "Clean up unused files"}
      </button>
      <span role="status" aria-live="polite" className={`text-xs ${result && !result.ok ? "text-negative" : "text-fg-muted"}`}>
        {result ? (result.ok ? result.message : result.error) : ""}
      </span>
    </span>
  );
}
