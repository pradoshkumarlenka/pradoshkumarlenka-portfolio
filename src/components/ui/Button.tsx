import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-chip px-6 py-3 text-sm font-medium transition-[background-color,border-color,color,transform] duration-400 ease-premium focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Dark text on violet keeps 5.7:1 contrast.
  primary: "bg-violet text-on-violet hover:bg-lavender",
  secondary: "border border-line-strong text-fg hover:border-lavender hover:bg-surface",
  ghost: "text-fg-muted hover:text-fg",
};

interface CommonProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

type ButtonAsLink = CommonProps & {
  href: string;
  /** Open in a new tab (external links, PDFs). */
  newTab?: boolean;
  /** Download instead of navigate; string = file name to save as. */
  download?: boolean | string;
} & Omit<ComponentPropsWithoutRef<"a">, "href" | "className" | "children" | "download">;

type ButtonAsButton = CommonProps & { href?: undefined } & Omit<
    ComponentPropsWithoutRef<"button">,
    "className" | "children"
  >;

/**
 * Button / link styled as a button.
 * - Internal routes render a Next <Link>.
 * - External URLs, files and downloads render a plain <a>.
 * - No href renders a <button>.
 */
export function Button(props: ButtonAsLink | ButtonAsButton) {
  const { variant = "primary", children, className = "" } = props;
  const classes = `${base} ${variants[variant]} ${className}`;

  if (props.href !== undefined) {
    const { href, newTab, download, variant: _v, className: _c, children: _ch, ...rest } = props;
    const isInternalRoute = href.startsWith("/") && !download && !newTab && !/\.[a-z0-9]+$/i.test(href);
    if (isInternalRoute) {
      return (
        <Link href={href} className={classes} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className={classes}
        download={download === true ? "" : download || undefined}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noopener noreferrer" : undefined}
        {...rest}
      >
        {children}
      </a>
    );
  }

  const { variant: _v, className: _c, children: _ch, type = "button", ...rest } = props;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
