# Auth-E-Mailvorlagen

| Hosted-Template | Datei | Betreff |
| --- | --- | --- |
| Confirm signup | confirmation.html | E-Mail-Adresse bestätigen \| DAS Reiseportal |
| Reset password | recovery.html | Passwort zurücksetzen \| DAS Reiseportal |

Die HTML-Dateien sind die versionierte Quelle. Bei einer freigegebenen Hosted-Konfiguration Betreff und HTML exakt synchronisieren. Es sind keine Secrets enthalten.

`RedirectTo` ist der von der Anwendung gesetzte, geprüfte Callbackhost mit `/auth/confirm` bzw. `/auth/recovery`; `TokenHash` wird ausschließlich von Auth beim Versand eingesetzt. Die bestehenden Endpoints verwenden `verifyOtp` mit `email`/`recovery` und prüfen Host bzw. Recovery-Sitzung. Keine Site-URL als Ersatz für einen fehlenden Redirect verwenden und keine Allowlist erweitern.

Dokumentation: [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SSR](https://supabase.com/docs/guides/auth/server-side/nextjs), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Hosted-Absender

Default SMTP ist kein eigener Produktabsender. `CUSTOM_SMTP_REQUIRED`: Eine freigegebene Konfiguration benötigt SMTP Host, Port, User, Passwort und eine technisch verifizierte From-Adresse. Sender Name: **DAS Reiseportal**. Keine Adresse oder Zugangswerte erfinden; keine Secrets in dieser Dokumentation hinterlegen.

Solange Custom SMTP nicht eingerichtet ist, sind die Dateien vorbereitet; sie beweisen keinen gebrandeten Cloud-Versand. Die aktuell deaktivierte Passwort-geändert-Benachrichtigung wird nicht eigenmächtig aktiviert.
