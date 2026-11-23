import { SiteChrome } from "@/components/layout/SiteChrome";

/** Every public page (home, project and research pages) shares the site frame. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SiteChrome>{children}</SiteChrome>;
}
