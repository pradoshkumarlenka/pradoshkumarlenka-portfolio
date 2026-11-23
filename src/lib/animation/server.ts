import "server-only";
import { cache } from "react";
import { applyAnimationSettings, type AnimationConfig } from "./config";
import { getContent } from "@/lib/content/server";

/**
 * The animation settings in effect: the published "animation" block (database,
 * or content/animation.json as fallback) applied over ANIMATION_DEFAULTS,
 * clamped to ANIMATION_LIMITS. Reduced-motion preferences still override
 * everything inside the components.
 */
export const getAnimationConfig = cache(async (): Promise<AnimationConfig> => applyAnimationSettings(await getContent("animation")));
