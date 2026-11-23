import { Container } from "@/components/ui/Section";

/** Shown when the work database cannot be reached — never stale or guessed content. */
export function WorkUnavailable({ page = false }: { page?: boolean }) {
  const body = (
    <div role="alert" className="rounded-card border border-line bg-surface/55 px-6 py-10 text-center">
      <p className="text-fg">Research &amp; Selected Work can&apos;t be loaded right now.</p>
      <p className="mt-2 text-sm text-fg-muted">Please refresh the page in a moment.</p>
    </div>
  );
  return page ? (
    <section className="py-32">
      <Container>{body}</Container>
    </section>
  ) : (
    body
  );
}
