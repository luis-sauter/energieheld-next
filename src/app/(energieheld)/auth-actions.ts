"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
        ...(origin
          ? { emailRedirectTo: new URL("/auth/confirm", origin).toString() }
          : {}),
      },
    });
    if (signupError) return { error: authErrorMessage(signupError.code) };
    return {
      success: data.session
        ? "Ihre Registrierung war erfolgreich. Sie können sich jetzt anmelden."
        : "Ihre Registrierungsanfrage wurde angenommen. Bitte bestätigen Sie Ihre E-Mail-Adresse. Falls Sie bereits registriert sind, können Sie sich direkt anmelden.",
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
  try {
    const supabase = await createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) return { error: authErrorMessage(loginError.code) };
  } catch {
    return {
      error:
        "Die Anmeldung ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.",
    };
  }
  redirect("/firma");
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
