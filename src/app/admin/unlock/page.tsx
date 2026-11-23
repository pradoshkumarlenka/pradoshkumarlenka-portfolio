import { redirect } from "next/navigation";
import { getAdminSessionWithoutTab } from "@/lib/admin/auth";
import { UnlockGate } from "@/components/admin/UnlockGate";

export const dynamic = "force-dynamic";

/** Renders no private data: only checks that this tab holds the session, then continues. */
export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await getAdminSessionWithoutTab();
  if (s.status === "signed-out") redirect(s.expired ? "/admin/login?error=expired" : "/admin/login");
  if (s.status === "not-admin") redirect("/admin/login?error=not-admin");
  if (s.status === "unconfigured") redirect("/admin/login");
  const { next } = await searchParams;
  return <UnlockGate next={typeof next === "string" ? next : null} />;
}
