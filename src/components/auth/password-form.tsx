"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/app/(energieheld)/auth-actions";
import type { AuthState } from "@/lib/auth";
import styles from "./auth.module.css";

export function PasswordForm({ recovery = false }: { recovery?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(recovery ? resetPassword : requestPasswordReset, {});
  return <form action={action} className={styles.form} aria-busy={pending}>
    {!state.success && <>
      {recovery ? <>
        <label className={styles.field}>Neues Passwort<input name="password" type="password" autoComplete="new-password" minLength={8} required aria-describedby="new-password-hint" /></label>
        <p id="new-password-hint">Mindestens 8 Zeichen.</p>
        <label className={styles.field}>Neues Passwort bestätigen<input name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
      </> : <label className={styles.field}>E-Mail<input name="email" type="email" autoComplete="email" required /></label>}
      <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Bitte warten …" : recovery ? "Passwort ändern" : "Link zum Zurücksetzen senden"}</button>
    </>}
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    {state.success && <p className={styles.success} role="status">{state.success}</p>}
    <Link href="/login">Zurück zum Login</Link>
  </form>;
}
