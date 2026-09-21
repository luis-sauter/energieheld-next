export type AuthState = { error?: string; success?: string };

function field(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

export function validateCredentials(data: FormData, signup = false) {
  const email = field(data, "email").trim();
  const password = field(data, "password");
  const full_name = field(data, "full_name").trim();
  const company_name = field(data, "company_name").trim();
  let error: string | undefined;
  if (
    !email ||
    !password ||
    (signup &&
      (!full_name || !company_name || !field(data, "password_confirmation")))
  ) {
    error = "Bitte füllen Sie alle Pflichtfelder aus.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
  } else if (signup && password.length < 8) {
    error = "Das Passwort muss mindestens 8 Zeichen lang sein.";
  } else if (signup && password !== field(data, "password_confirmation")) {
    error = "Die Passwörter stimmen nicht überein.";
  }
  return { error, email, password, full_name, company_name };
}

export function authErrorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials":
      return "E-Mail-Adresse oder Passwort ist falsch.";
    case "email_not_confirmed":
      return "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.";
    case "user_already_exists":
    case "email_exists":
      return "Die Registrierung konnte nicht abgeschlossen werden. Falls Sie bereits registriert sind, melden Sie sich bitte an.";
    case "weak_password":
      return "Bitte wählen Sie ein stärkeres Passwort mit mindestens 8 Zeichen.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Zu viele Versuche. Bitte warten Sie einige Minuten und versuchen Sie es erneut.";
    default:
      return "Die Anmeldung oder Registrierung ist gerade nicht möglich. Bitte versuchen Sie es später erneut.";
  }
}

export function profileStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Entwurf",
    pending: "Zur Prüfung eingereicht",
    approved: "Freigegeben",
    rejected: "Änderungen erforderlich",
  };
  return labels[status] ?? "Unbekannter Status";
}
