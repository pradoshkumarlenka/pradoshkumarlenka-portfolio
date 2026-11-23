import { Container } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { getContent } from "@/lib/content/server";
import { SiteChrome } from "@/components/layout/SiteChrome";

export default async function NotFound() {
  const ui = await getContent("ui");
  return (
    <SiteChrome>
    <section className="py-32">
      <Container>
        <Reveal stagger={0.08}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lavender">{ui.notFound.code}</p>
          <h1 className="mt-4 font-display text-5xl text-fg">{ui.notFound.title}</h1>
          <div className="mt-10">
            <Button href="/">{ui.notFound.button}</Button>
          </div>
        </Reveal>
      </Container>
    </section>
    </SiteChrome>
  );
}
