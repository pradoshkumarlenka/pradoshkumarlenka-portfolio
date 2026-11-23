import type { ProjectResource } from "@/content/types";
import { ResourceRow } from "./ResourceRow";
import { getContent } from "@/lib/content/server";

interface ProjectResourcesProps {
  /** Pass the output of resolveResources() so missing files are already removed. */
  resources: ProjectResource[];
  heading?: string;
}

/**
 * Optional "Project resources" panel: one compact row per real file or link,
 * with an in-site Preview (PDF, Excel, Word, converted slides) and a separate
 * Download original. Renders NOTHING when the list is empty.
 */
export async function ProjectResources({ resources, heading }: ProjectResourcesProps) {
  if (resources.length === 0) return null;
  heading ??= (await getContent("ui")).resources.heading;
  return (
    <section aria-label={heading} className="rounded-card border border-line bg-surface/55 p-5 backdrop-blur-[3px] sm:p-6">
      <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-lavender">{heading}</h2>
      <ul className="divide-y divide-line">
        {resources.map((resource) => (
          <ResourceRow key={`${resource.href}-${resource.title}`} resource={resource} />
        ))}
      </ul>
    </section>
  );
}
