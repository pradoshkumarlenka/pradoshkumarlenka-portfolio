/**
 * Font loading. The families here are placeholders until final typography is
 * chosen: swap the imports below and every component follows, because they
 * only reference --font-body / --font-heading / --font-numeric via theme.css.
 */
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";

export const bodyFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const headingFont = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-heading",
});

export const numericFont = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-numeric",
});

export const fontVariables = [bodyFont.variable, headingFont.variable, numericFont.variable].join(" ");
