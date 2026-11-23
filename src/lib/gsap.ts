"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

/** The site's single easing curve, matching --ease-premium in theme.css. */
export const EASE_PREMIUM = "premium";

/** Register GSAP plugins once, client-side only. Import gsap from here. */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, CustomEase, useGSAP);
  CustomEase.create(EASE_PREMIUM, "0.22, 1, 0.36, 1");
  gsap.defaults({ ease: EASE_PREMIUM, duration: 0.65 });
}

export { gsap, ScrollTrigger, useGSAP };
