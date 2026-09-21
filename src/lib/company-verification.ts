import type { CompanyVerification } from "@/types/portal";
// PostgREST returns a PK/FK relation as an object; tolerate array-shaped test or
// generated-client relations while never inferring a seal from mere row existence.
export function readVerification(
  value: unknown,
): CompanyVerification | undefined {
  const row = Array.isArray(value) ? value[0] : value;
  if (
    !row ||
    typeof row !== "object" ||
    row.status !== "verified" ||
    typeof row.verified_at !== "string"
  )
    return undefined;
  return {
    status: "verified",
    verified_at: row.verified_at,
    public_note: typeof row.public_note === "string" ? row.public_note : null,
  };
}
