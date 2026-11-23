import type { NextConfig } from "next";

/**
 * Security headers for every response. They only restrict what browsers may
 * do with the site; they do not change how it looks or behaves:
 *  - the site can be framed only by itself (blocks clickjacking; the admin
 *    draft preview frames the site from the same origin);
 *  - no MIME sniffing; referrers limited to the origin on other sites;
 *  - camera, microphone, geolocation and payment APIs disabled.
 * /media/* (library files) sets its own, stricter Content-Security-Policy in
 * its route, which also includes frame-ancestors 'self'.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // experimental.inlineCss was measured and rejected: under Fast-4G + 4x CPU throttling the
  // Hero name appeared at ~3.6 s (first visit) with inlined styles vs ~1.8 s with the normal
  // linked stylesheet, and Lighthouse TBT was higher. Keep the default (linked, cacheable CSS).
  poweredByHeader: false,
  images: {
    // Certificates and photos are served from /public and optimised to modern formats.
    formats: ["image/avif", "image/webp"],
    // Local images without query strings (as before), plus media-library files, which
    // may carry a short-lived ?pt= preview token (checked by the /media route).
    localPatterns: [{ pathname: "/**", search: "" }, { pathname: "/media/**" }],
  },
  headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/((?!media/).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      // Static files in /public keep fixed names (not content-hashed): cache for a day, then
      // revalidate in the background, so a replaced file still shows up within a day.
      ...["/photos/:path*", "/images/:path*", "/certificates/:path*", "/videos/:path*", "/vendor/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ];
  },
};

export default nextConfig;
