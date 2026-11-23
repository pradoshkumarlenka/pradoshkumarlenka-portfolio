"use client";

import { useActionState, useState } from "react";
import { requestSignIn, verifyCode, type LoginState } from "@/lib/admin/login-actions";
import { field, label, primaryBtn } from "./styles";

/** Two steps: request a sign-in email, then click its link or type its code. */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, send, sending] = useActionState<LoginState, FormData>(requestSignIn, { step: "email" });
  const [checked, check, checking] = useActionState<LoginState, FormData>(verifyCode, { step: "code" });

  if (sent.step === "email") {
    return (
      <form action={send} className="space-y-4">
        <div>
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
        {sent.error && <p role="alert" className="text-sm text-negative">{sent.error}</p>}
        <button type="submit" disabled={sending} className={primaryBtn}>{sending ? "Sending…" : "Email me a sign-in link"}</button>
      </form>
    );
  }
  return (
    <form action={check} className="space-y-4">
      <p role="status" className="text-sm text-fg-muted">{sent.message}</p>
      <input type="hidden" name="email" value={email} />
      <div>
        <label htmlFor="code" className={label}>Code (if the email shows one)</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} className={`${field} font-mono tracking-[0.3em]`} />
      </div>
      {checked.error && <p role="alert" className="text-sm text-negative">{checked.error}</p>}
      <button type="submit" disabled={checking} className={primaryBtn}>{checking ? "Checking…" : "Sign in"}</button>
    </form>
  );
}
