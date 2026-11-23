import type { CSSProperties } from "react";
import Image from "next/image";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { PortraitHalftoneLayer } from "./PortraitHalftoneLayer";

interface HalftonePortraitProps {
  /** Output of resolveAsset(): the real photo, or null → editable placeholder. */
  src: string | null;
  alt: string;
  expectedPath: string;
  /** Plain background colour of the photo (content/hero.json). */
  backdropColor: string;
  placeholderLabel: string;
  delay?: number;
  className?: string;
}

/**
 * The real portrait. Base layer: the clear photo with a CSS dots-to-clear
 * intro (.portrait-dots-in in globals.css). On mouse devices an interactive
 * React Bits halftone print of the same photo sits on top; hovering reveals
 * the untouched photo.
 */
export function HalftonePortrait({ src, alt, expectedPath, backdropColor, placeholderLabel, delay = 0, className = "" }: HalftonePortraitProps) {
  return (
    <figure
      className={`portrait-card relative aspect-[4/5] overflow-hidden rounded-panel border border-line bg-canvas-2 shadow-raised ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(min-width: 1024px) 432px, (min-width: 640px) 360px, 300px"
          className="portrait-dots-in object-cover"
          style={{ "--d": `${delay}ms` } as CSSProperties}
        />
      ) : (
        <ImagePlaceholder label={placeholderLabel} expectedPath={expectedPath} />
      )}
      {/* Paper #120f17 as in the React Bits reference; #8b868a = the headshot's grey backdrop. */}
      {src && <PortraitHalftoneLayer src={src} paperColor="#120f17" backdropColor={backdropColor} />}
    </figure>
  );
}
