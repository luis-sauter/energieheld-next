import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
export async function createMediaTestDatabase(current = false) {
  const db = new PGlite();
  await db.exec(await read("../fixtures/company-schema.sql"));
  await db.exec(await read("../fixtures/company-media-schema.sql"));
  for (const file of [
    "20260916145904_add_company_categories_and_admin_assignment.sql",
    "20260916195841_grant_public_company_profile_read.sql",
    "20260916202508_company_profile_media.sql",
  ])
    await db.exec(await read("../../supabase/migrations/" + file));
  if (current) {
    // The minimal fixture uses a shorter policy name; match the verified live name.
    await db.exec(
      "alter policy profiles_owner_update on company_profiles rename to company_profiles_owner_update",
    );
    await db.exec(
      await read(
        "../../supabase/migrations/20260917091406_independent_profile_content.sql",
      ),
    );
  }
  return db;
}
