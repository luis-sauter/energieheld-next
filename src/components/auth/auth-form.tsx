"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, register, logout } from "@/app/(energieheld)/auth-actions";
import type { AuthState } from "@/lib/auth";
import styles from "./auth.module.css";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const signup = mode === "register";
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup ? register : login,
    {},
  );
  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      {!state.success && (
        <>
          {signup && (
            <>
              <label className={styles.field} htmlFor="full_name">
                Ansprechpartner / Name
                <input
                  id="full_name"
                  name="full_name"
                  autoComplete="name"
                  required
                />
              </label>
              <label className={styles.field} htmlFor="company_name">
                Firmenname
                <input
                  id="company_name"
                  name="company_name"
                  autoComplete="organization"
                  required
                />
              </label>
            </>
          )}
          <label className={styles.field} htmlFor="email">
            E-Mail
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className={styles.field} htmlFor="password">
            Passwort
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 8 : undefined}
              aria-describedby={signup ? "password-hint" : undefined}
              required
            />
          </label>
          {signup && (
            <>
              <p id="password-hint">Mindestens 8 Zeichen.</p>
              <label className={styles.field} htmlFor="password_confirmation">
                Passwort bestätigen
                <input
                  id="password_confirmation"
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </>
          )}
          <button
            className="button button-primary"
            disabled={pending}
            type="submit"
          >
            {pending
              ? "Bitte warten …"
              : signup
                ? "Firma registrieren"
                : "Einloggen"}
          </button>
        </>
      )}
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className={styles.success} role="status">
          {state.success}
        </p>
      )}
      <div className={styles.links}>
        <Link href={signup ? "/login" : "/registrieren"}>
          {signup
            ? "Bereits registriert? Einloggen"
            : "Noch kein Konto? Firma registrieren"}
        </Link>
      </div>
    </form>
  );
}

export function LogoutButton() {
  const [state, action, pending] = useActionState<AuthState>(logout, {});
  return (
    <form action={action}>
      <button
        type="submit"
        className="button button-primary"
        disabled={pending}
      >
        {pending ? "Abmelden …" : "Logout"}
      </button>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
