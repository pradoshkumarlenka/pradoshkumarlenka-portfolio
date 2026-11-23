import Image from "next/image";

/**
 * Shared 3:2 picture frame for project and research cards (.project-image-frame
 * in globals.css). The pictures are 3:2 too, so they show whole — never stretched
 * or cropped. `position` only matters if a picture of another shape is used.
 */
export function ProjectImage({
  src,
  alt,
  position = "center",
  sizes,
  className = "",
}: {
  src: string;
  alt: string;
  position?: string;
  sizes: string;
  className?: string;
}) {
  return (
    <div className={`project-image-frame ${className}`}>
      {/* Database covers come pre-sized from /work-media (short cache), so they skip the optimiser cache. */}
      <Image src={src} alt={alt} fill sizes={sizes} style={{ objectPosition: position }} unoptimized={src.startsWith("/work-media/")} />
    </div>
  );
}
