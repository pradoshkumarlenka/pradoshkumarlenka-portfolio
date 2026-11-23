import Image from "next/image";

/**
 * Fixed-shape photo frame: the shape is reserved before the photo loads, the
 * photo fills it without stretching, and `position` chooses which part stays
 * in view when the frame trims it ("center", "70% 40%", …).
 */
export function PhotoFrame({
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
    <div className={`relative overflow-hidden bg-canvas-2 ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" style={{ objectPosition: position }} />
    </div>
  );
}
