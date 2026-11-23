"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ContactFile, ContactLink } from "@/content/types";

const ICONS: Record<ContactLink["kind"], string> = { email: "@", phone: "☏", linkedin: "in" };

/**
 * CONTACT — verified details only (content/contact.json): email (mail app +
 * copy), phone, LinkedIn and city, beside the formal headshot. No form: there is
 * no backend to send one, and a form that pretends to send would mislead.
 */
export function ContactSection({ contact, headshot }: { contact: ContactFile; headshot: string | null }) {
  const [toast, setToast] = useState<{ ok: boolean } | null>(null);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (value: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = false;
    }
    setToast({ ok });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-16">
      <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface/55 shadow-card backdrop-blur-[3px]">
        {contact.links.map((link) => {
          const external = link.kind === "linkedin";
          return (
            <li key={link.kind} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:flex-nowrap sm:px-7 sm:py-5">
              <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-sm text-lavender">
                {ICONS[link.kind]}
              </span>
              <a
                href={link.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group min-w-0 flex-1 rounded-sm max-sm:basis-[calc(100%-3.5rem)]"
              >
                <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle">{link.label}</span>
                <span className="mt-0.5 block break-words text-[15px] text-fg underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-lavender sm:text-lg">
                  {link.value}
                  {external && (
                    <>
                      {" "}
                      <span aria-hidden="true">↗</span>
                      <span className="sr-only"> {contact.labels.opensInNewTab}</span>
                    </>
                  )}
                </span>
              </a>
              {link.kind === "email" && (
                <button
                  type="button"
                  onClick={() => copy(link.value)}
                  aria-label={`${contact.labels.copy} ${link.label.toLowerCase()} ${link.value}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-chip border border-line-strong px-4 text-xs text-fg transition-colors hover:border-lavender max-sm:ml-14"
                >
                  {contact.labels.copy}
                </button>
              )}
            </li>
          );
        })}
        {contact.location && (
          <li className="flex items-center gap-4 px-5 py-4 sm:px-7 sm:py-5">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-sm text-lavender">
              ◎
            </span>
            <p className="text-base text-fg-muted sm:text-lg">{contact.location}</p>
          </li>
        )}
      </ul>

      {headshot && (
        <figure className="mx-auto w-full max-w-[18rem] overflow-hidden rounded-panel border border-line shadow-card">
          <div className="relative aspect-[4/5]">
            <Image src={headshot} alt={contact.headshotAlt} fill sizes="288px" className="object-cover" />
          </div>
        </figure>
      )}

      <p
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-chip border px-4 py-2 text-sm shadow-raised transition-opacity duration-200 motion-reduce:transition-none ${
          toast ? "opacity-100" : "opacity-0"
        } ${toast && !toast.ok ? "border-negative/50 bg-canvas text-fg" : "border-violet/50 bg-canvas text-fg"}`}
      >
        {toast ? (toast.ok ? `✓ ${contact.labels.copied}` : contact.labels.copyFailed) : ""}
      </p>
    </div>
  );
}
