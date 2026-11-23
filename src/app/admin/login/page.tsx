import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { card } from "@/components/admin/styles";

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Request a new one.",
  "not-admin": "This account is not authorised to use the admin area.",
  expired: "You were signed out for security (inactivity or the maximum session length). Sign in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; retab?: string }> }) {
  const session = await getAdminSession();
  const { error, retab } = await searchParams;
  // ?retab=1: a locked tab asks to sign in again here (the new sign-in moves access to this tab).
  if (session.status === "admin" && !retab) redirect("/admin");
  const message = session.status === "not-admin" ? ERRORS["not-admin"] : error ? ERRORS[error] : undefined;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-4xl">Admin sign-in</h1>
      <p className="mt-2 text-sm text-fg-muted">Private area for the site owner.</p>
      {retab && session.status === "admin" && (
        <p role="status" className="mt-4 text-sm text-fg-muted">Signing in here moves admin access to this tab; any other admin tab will be locked.</p>
      )}
      <div className={`${card} mt-8 p-6`}>
        {session.status === "unconfigured" ? (
          <p role="alert" className="text-sm text-negative">Sign-in is not configured on this deployment (Supabase environment variables are missing).</p>
        ) : (
          <>
            {message && <p role="alert" className="mb-4 text-sm text-negative">{message}</p>}
            <LoginForm />
          </>
        )}
      </div>
    </div>
  );
}
