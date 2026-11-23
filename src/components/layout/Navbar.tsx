"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { useNavItems, usePerson, useUi } from "@/lib/content/client";
import { scrollToTarget } from "@/lib/lenis";
import { ReadingProgress } from "./ReadingProgress";

/**
 * Sticky site navigation: PKL monogram + section links + reading progress.
 * Links come from the `sections` list in content.ts (anything with a navLabel).
 * On project pages the links point back to the homepage sections.
 */
export function Navbar() {
  const ui = useUi();
  const person = usePerson();
  const navItems = useNavItems();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [active, setActive] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Highlight the section currently in the middle of the screen.
  useEffect(() => {
    if (!isHome) return;
    const targets = navItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isHome, navItems]);

  // Solid background once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleSectionClick = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    setMenuOpen(false);
    if (!isHome) return; // let Next navigate to /#id
    e.preventDefault();
    scrollToTarget(id);
    history.replaceState(null, "", `#${id}`);
  };

  const handleMonogramClick = (e: MouseEvent<HTMLAnchorElement>) => {
    setMenuOpen(false);
    if (!isHome) return;
    e.preventDefault();
    scrollToTarget(0);
    history.replaceState(null, "", "/");
  };

  return (
    <header
      data-site-nav
      className={`sticky top-0 z-50 border-b transition-colors duration-500 ease-premium ${
        scrolled || menuOpen
          ? "border-line bg-canvas/85 backdrop-blur-md"
          : "border-transparent bg-canvas/40 backdrop-blur-sm"
      }`}
    >
      <ReadingProgress />

      <nav
        aria-label="Primary"
        className="mx-auto flex h-[var(--nav-height)] max-w-[var(--container-max)] items-center justify-between px-[var(--gutter)]"
      >
        <Link
          href="/"
          onClick={handleMonogramClick}
          className="font-display text-xl tracking-[0.12em] text-fg transition-colors hover:text-lavender"
          // Starts with the visible text ("PKL") so voice-control users can say what they see (WCAG 2.5.3).
          aria-label={`${person.monogram} — ${person.name}, home`}
        >
          {person.monogram}
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive = isHome && active === item.id;
            return (
              <li key={item.id}>
                <Link
                  href={`/#${item.id}`}
                  onClick={(e) => handleSectionClick(e, item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`rounded-chip px-3 py-2 text-sm transition-colors duration-300 ease-premium ${
                    isActive ? "text-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile toggle */}
        <button
          type="button"
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-control text-fg-muted hover:text-fg lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? ui.navigation.closeMenu : ui.navigation.openMenu}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" className="relative block h-3 w-5">
            <span
              className={`absolute left-0 h-px w-5 bg-current transition-transform duration-300 ease-premium ${
                menuOpen ? "top-1.5 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 h-px w-5 bg-current transition-transform duration-300 ease-premium ${
                menuOpen ? "top-1.5 -rotate-45" : "top-3"
              }`}
            />
          </span>
        </button>
      </nav>

      {/* Mobile menu */}
      <div id="mobile-menu" hidden={!menuOpen} className="border-t border-line lg:hidden">
        <ul className="mx-auto max-w-[var(--container-max)] px-[var(--gutter)] py-3">
          {navItems.map((item) => (
            <li key={item.id}>
              <Link
                href={`/#${item.id}`}
                onClick={(e) => handleSectionClick(e, item.id)}
                className="block py-3 text-base text-fg-muted transition-colors hover:text-fg"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
