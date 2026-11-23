import type { ElementType, HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: ElementType;
  /** Adds the hover state: 2px lift and accent border. */
  interactive?: boolean;
  className?: string;
}

/** Elevated surface used for experience, project, certificate and other cards. */
export function Card({ children, as: Tag = "div", interactive = false, className = "", ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      className={`rounded-card border border-line bg-surface shadow-card ${
        interactive
          ? "transition-[transform,border-color,background-color] duration-500 ease-premium hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Small pill label (status, outcome, honest labels like "Paper trading"). */
export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "positive";
  className?: string;
}) {
  const tones = {
    neutral: "border-line text-fg-muted",
    accent: "border-violet/40 text-lavender",
    positive: "border-positive/40 text-positive",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-chip border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
