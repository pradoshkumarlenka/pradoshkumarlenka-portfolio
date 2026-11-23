import { ImageResponse } from "next/og";
import { getContent } from "@/lib/content/server";

/*
 * Social preview image (Open Graph / LinkedIn / WhatsApp), generated from the
 * published content: name, brand line and tagline on the site's own colours
 * (design block). Text only — no photo, no logos.
 */
export const alt = "Pradosh Kumar Lenka — Finance & Research";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  const [hero, design] = await Promise.all([getContent("hero"), getContent("design")]);
  const { person } = hero;
  const c = design.colors;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", background: "linear-gradient(160deg, #05070f 0%, #070a14 55%, #0a0c1b 100%)", color: c.fg }}>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, color: c.lavender, textTransform: "uppercase" }}>{person.statusLine}</div>
        <div style={{ display: "flex", fontSize: 96, marginTop: 28, lineHeight: 1.05 }}>{person.name}</div>
        <div style={{ display: "flex", width: 120, height: 3, background: c.violet, marginTop: 36 }} />
        <div style={{ display: "flex", fontSize: 36, marginTop: 36, color: c.fgMuted, maxWidth: 960 }}>{person.brandLine}</div>
        <div style={{ display: "flex", fontSize: 24, marginTop: 28, letterSpacing: 4, color: c.fgSubtle, textTransform: "uppercase" }}>{`${person.tagline} · ${person.location}`}</div>
      </div>
    ),
    size,
  );
}
