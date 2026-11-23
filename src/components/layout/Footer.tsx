import { getContent } from "@/lib/content/server";
import { BackToTop } from "./BackToTop";
import { Reveal } from "@/components/motion/Reveal";

/** Site footer: copyright, back-to-top link, sign-off. */
export async function Footer() {
  const footer = await getContent("footer");
  return (
    <footer className="border-t border-line">
      <Reveal distance={24} threshold={0}>
        <div className="mx-auto flex max-w-[var(--container-max)] flex-col gap-4 px-[var(--gutter)] py-10 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>{footer.copyright}</p>
          <p className="flex items-center gap-6">
            <span>{footer.signoff}</span>
            <BackToTop label={footer.backToTop} />
          </p>
        </div>
      </Reveal>
    </footer>
  );
}
