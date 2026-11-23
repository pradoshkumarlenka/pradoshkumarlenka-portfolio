import Image from "next/image";
import { getContent } from "@/lib/content/server";

interface MediaFrameProps {
  /** Path from resolveAsset(): a real file, or null when not supplied yet. */
  src: string | null;
  alt: string;
  /** Shown inside the placeholder, e.g. "Headshot" or "NISM campus photo". */
  placeholderLabel: string;
  /** Expected file location, shown in development to make replacement easy. */
  expectedPath?: string;
  /** CSS aspect ratio, e.g. "4 / 5" or "16 / 10". */
  aspect?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Image with a graceful fallback. When the file is missing it renders a calm,
 * clearly labelled placeholder (never a broken image, never a stock photo).
 */
export function MediaFrame({
  src,
  alt,
  placeholderLabel,
  expectedPath,
  aspect = "4 / 3",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
  className = "",
}: MediaFrameProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-card border border-line bg-canvas-2 ${className}`}
      style={{ aspectRatio: aspect }}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <ImagePlaceholder label={placeholderLabel} expectedPath={expectedPath} />
      )}
    </div>
  );
}

/** The placeholder on its own (fills its parent). */
export async function ImagePlaceholder({ label, expectedPath }: { label: string; expectedPath?: string }) {
  const ui = await getContent("ui");
  return (
    <div
      role="img"
      aria-label={`${label} (image coming soon)`}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, rgb(167 173 196 / 0.05) 0 1px, transparent 1px 12px)",
      }}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-subtle">{ui.placeholders.imagePending}</span>
      <span className="text-sm text-fg-muted">{label}</span>
      {expectedPath && process.env.NODE_ENV !== "production" && (
        <code className="mt-1 break-all font-mono text-[10px] text-fg-subtle">public{expectedPath}</code>
      )}
    </div>
  );
}
