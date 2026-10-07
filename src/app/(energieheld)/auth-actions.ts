"use server";

import { loadPortalAccount } from "@/lib/portal-account-loader";
import { accountLoginDestination } from "@/lib/portal-account";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authRedirectUrl, recoveryLinkError, recoveryRequestMessage, validRecoverySession, validateNewPassword, validateRecoveryEmail } from "@/lib/auth-recovery";
import {
  authErrorMessage,
  validateCredentials,
  type AuthState,
} from "@/lib/auth";

export async function register(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { error, email, password, full_name, company_name } =
    validateCredentials(formData, true);
  if (error) return { error };
  try {
    const supabase = await createClient();
    const origin = (await headers()).get("origin");
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, company_name },
        emailRedirectTo: authRedirectUrl(origin, "/auth/confirm"),
      },
    });
    if (signupError) return { error: authErrorMessage(signupError.code) };
    if (data.session) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "Die E-Mail-Bestätigung ist gerade nicht verfügbar. Bitte wenden Sie sich an den Support." };
    }
    return {
      success: "Öffnen Sie den Bestätigungslink in Ihrer E-Mail, um Ihr Firmenkonto zu aktivieren.",
      confirmationEmail: email,
    };
  } catch {
    return {
      error:
        "Die Registrierung ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.",
    };
  }
}

export async function login(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { error, email, password } = validateCredentials(formData);
  if (error) return { error };
  let destination = "/konto";
  try {
    const supabase = await createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) return { error: authErrorMessage(loginError.code) };
    destination = accountLoginDestination(await loadPortalAccount(supabase), formData.get("next"));
  } catch {
    return {
      error:
        "Die Anmeldung ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.",
    };
  }
  redirect(destination);
}

export async function logout(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error)
      return {
        error: "Abmelden fehlgeschlagen. Bitte versuchen Sie es erneut.",
      };
  } catch {
    return {
      error:
        "Abmelden ist gerade nicht möglich. Bitte versuchen Sie es erneut.",
    };
  }
  redirect("/");
}

export async function requestPasswordReset(_state: AuthState, formData: FormData): Promise<AuthState> {
  const { email, error } = validateRecoveryEmail(formData);
  if (error) return { error };
  try {
    const client = await createClient();
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl((await headers()).get("origin"), "/auth/recovery"),
    });
  } catch {
    // Keep provider failures and unknown accounts indistinguishable to callers.
  }
  return { success: recoveryRequestMessage };
}

export async function resetPassword(_state: AuthState, formData: FormData): Promise<AuthState> {
  const value = validateNewPassword(formData);
  if (value.error) return { error: value.error };
  try {
    const client = await createClient();
    if (!await validRecoverySession(client)) return { error: recoveryLinkError };
    const { error } = await client.auth.updateUser({ password: value.password });
    if (error) return { error: error.code === "weak_password" ? authErrorMessage(error.code) : "Das Passwort konnte nicht geändert werden. Bitte versuchen Sie es erneut." };
    const signedOut = await client.auth.signOut({ scope: "local" });
    if (signedOut.error) return { error: "Das Passwort wurde geändert. Bitte melden Sie sich ab und anschließend mit dem neuen Passwort an." };
  } catch {
    return { error: "Das Zurücksetzen ist gerade nicht möglich. Bitte versuchen Sie es erneut." };
  }
  redirect("/login?passwort=geaendert");
}
