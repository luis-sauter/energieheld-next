import { readFileSync, writeFileSync, appendFileSync, mkdirSync, copyFileSync, existsSync, unlinkSync } from "node:fs";
import { extname } from "node:path";

// Reproducible audit of the supplied Joomla export. Existing Cloud profiles
// and potential duplicates are deliberate exclusions, never merge targets.
const root = new URL("../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8").replace(/^\uFEFF/, ""));
const companies = read(".legacy-reiseportal/normalized/companies.json").companies;
const candidates = read(".legacy-reiseportal/normalized/company-candidates.json");
const articles = new Map(read(".legacy-reiseportal/raw/articles.json").data.map((article) =>
  [Number(article.id), article.attributes]));
const manifest = read(".legacy-reiseportal/normalized/company-media-manifest.json");
const byId = new Map(companies.map((company) => [Number(company.legacy.joomla_article_id), company]));
const imported = new Map([
  [443, "bayerischer-wald"], [450, "anni-romantikhaeuschen"], [452, "golfhotel-andreus"],
  [457, "hotel-zur-post"], [458, "wirodive-tauchreisen"], [464, "hoeflehner"],
  [465, "schafhuber"], [468, "wirthshof"], [470, "pension-sonnenhof"], [480, "villner-hof"],
]);
const duplicates = new Map([
  [508, "Unveröffentlicht; gleiche Adresse, Telefonnummer und Homepage wie 507/454."],
  [507, "Gleicher Anbieter wie 454 (Adresse, Telefon, Name); keine automatische Auswahl."],
  [503, "Gleicher Anbieter wie 502 (Adresse, Telefon, E-Mail, Homepage); unterschiedliche Themenartikel."],
  [502, "Gleicher Anbieter wie 503 (Adresse, Telefon, E-Mail, Homepage); unterschiedliche Themenartikel."],
  [486, "Gleiche Adresse und Telefonnummer wie bereits importierter Höflehner (464)."],
  [475, "Unveröffentlicht; gleicher Anbieter wie bereits importierter Artikel 450."],
  [454, "Gleicher Anbieter wie 507 (Adresse, Telefon, Name)."],
]);
const notProviders = new Map([
  [462, "Tourismusverband und Radregion, kein eigener Reise-/Unterkunftsanbieter."],
  [461, "Radweg als Route, kein eigener Reise-/Unterkunftsanbieter."],
  [444, "Unveröffentlichter Autoservice, kein Reiseanbieter."],
  [424, "Unveröffentlichter Medien-/TV-Eintrag, kein Reiseanbieter."],
]);
const insufficient = new Map([
  [455, "Nur Name, Adresse und Telefon; weder Beschreibung noch Homepage, E-Mail oder zuordenbare Bilder."],
]);
const themeKeys = new Map([
  ["Natur pur", "theme:natur-pur"], ["Nordic Walking", "theme:nordic-walking"],
  ["Radwandern", "theme:radwandern"], ["Wanderurlaub", "theme:wanderurlaub"],
  ["Familienurlaub", "theme:familienurlaub"], ["Golfurlaub", "theme:golfurlaub"],
  ["Tauchurlaub", "theme:tauchurlaub"], ["Urlaub am Wasser", "theme:urlaub-am-wasser"],
  ["Campingurlaub", "theme:campingurlaub"], ["Romantik zu zweit", "theme:romantik-zu-zweit"],
  ["Wellnessangebote", "theme:wellnessangebote"], ["Geschäftsreisen", "theme:geschaeftsreisen"],
]);
const mediaChoices = new Map(Object.entries({
  506: { logo: "logo-quer.jpg", images: ["750x400-haus.jpg", "750x400-familie.jpg"] },
  505: { images: ["hotel-01-750x400.jpg", "hotel-02-750x400.jpg"] },
  504: { logo: "Logo_Koenigsleitner.png", images: ["Hotel-500x500-1.jpg", "Innen-2-375x250.jpg"] },
  501: { images: ["1.jpg", "2.jpg"] },
  473: { logo: "logo_blausee-transparent.png", images: ["blausee_imagebild.jpg", "blausee-sommer-1_ohneauto.jpg"] },
  471: { images: ["1_hotel_appartamenti_san_cassiano_alta_badia_10.jpg", "1_hotel_appartamenti_san_cassiano_alta_badia_20.jpg"] },
  469: { logo: "logo.png", images: ["3.jpg", "5.jpg"] },
  467: { images: ["02-Chalet.jpg", "04-Chalet.jpg"] },
  466: { logo: "logo-color.png", images: [] },
  463: { images: [] },
  460: { images: ["1.jpg", "2.jpg"] },
  459: { logo: "logo-subaqua-d0f09947f94b1ba02587c76c9628e496.png", images: [] },
  456: { logo: "Logo1.png", images: ["7.png", "8.png"] },
  453: { logo: "oversum-logo.png", images: ["impressionen-02.jpg", "_87X0787.jpg"] },
  451: { logo: "logo.jpg", images: ["Stock_02.jpg", "Stock_05.jpg"] },
  449: { logo: "logo.jpg", images: ["ostsee_04-wohn-essbereich-steuerbord_9394.jpg", "ostsee_07-schlafen-steuerbord_9421.jpg"] },
  448: { logo: "logo.jpg", images: ["IMG_4535.jpg", "8282732.jpg"] },
  447: { images: ["Pillnitzer_Apartment_6_001.jpg", "Pillnitzer_Apartment_6_003.jpg"] },
  446: { logo: "logo.jpg", images: ["Garten_Startseite.jpg", "w2romannshorn2.jpg"] },
  442: { logo: "logo-neue-schanke_NEU_05.04.2023.png", images: ["Haus.jpg", "6.jpg"] },
}).map(([id, value]) => [Number(id), value]));

const slugify = (value) => value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe")
  .replace(/ü/g, "ue").replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/&/g, " und ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const decode = (value) => value.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
const plain = (html) => decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ").trim();
const description = (html) => {
  if (!html) return null;
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plain(match[1])).filter((part) => part.length >= 25 && !/^https?:\/\//i.test(part));
  return (paragraphs.slice(0, 3).join("\n\n") || plain(html)) || null;
};
const accommodation = (name) => {
  if (/\bpension\b/i.test(name)) return "accommodation:pension";
  if (/\bferienwohnung\b/i.test(name)) return "accommodation:ferienwohnung";
  if (/\bcamping\b/i.test(name)) return "accommodation:camping";
  if (/hotel/i.test(name)) return "accommodation:hotel";
  return null;
};
const mediaFile = (company, filename) => {
  const matches = company.media.filter((media) => media.local_relative_path?.endsWith(` ${filename}`));
  if (!matches.length || new Set(matches.map((match) => match.local_relative_path)).size !== 1)
    throw new Error(`Missing or ambiguous Joomla medium ${company.legacy.joomla_article_id}: ${filename}`);
  const manifestFile = manifest.files.find((file) => file.RelativePath === matches[0].local_relative_path);
  if (!manifestFile || !existsSync(manifestFile.LocalPath)) throw new Error(`Missing original medium: ${filename}`);
  return { source: matches[0].source, original_path: matches[0].original_path,
    local_path: manifestFile.LocalPath, bytes: manifestFile.Bytes };
};
const rows = candidates.map((candidate) => {
  const id = Number(candidate.LegacyId);
  const company = byId.get(id);
  const rawArticle = articles.get(id);
  const name = company?.identity.name ?? candidate.Name;
  const status = imported.has(id) ? "ALREADY_IMPORTED"
    : duplicates.has(id) ? "POSSIBLE_DUPLICATE"
      : notProviders.has(id) ? "NOT_A_TRAVEL_PROVIDER"
        : insufficient.has(id) ? "INSUFFICIENT_DATA" : company ? "SAFE_IMPORT" : "UNCLEAR";
  const reason = imported.has(id) ? `Cloud-Profil ${imported.get(id)} vorhanden.`
    : duplicates.get(id) ?? notProviders.get(id) ?? insufficient.get(id)
      ?? (status === "SAFE_IMPORT" ? "Veröffentlichter Reise-/Unterkunftsanbieter mit Originalkontakt und Artikelbeleg." : "Keine veröffentlichte Firmen-Normalisierung.");
  const rawThemes = company ? [...new Set([
    ...Object.values(company.classification.business_category_raw ?? {}),
    ...Object.values(company.classification.tags_raw ?? {}),
  ])] : [];
  const themes = rawThemes.filter((value) => themeKeys.has(value)).map((value) => themeKeys.get(value));
  const audience = [...new Set([
    ...(rawThemes.includes("Familienurlaub") ? ["audience:familie"] : []),
    ...(rawThemes.includes("Romantik zu zweit") ? ["audience:paar"] : []),
  ])];
  const type = company ? accommodation(name) : null;
  const address = company?.address ?? { address: candidate.Address, street_no: candidate.StreetNo,
    zip: candidate.ZIP, city: candidate.City, country: candidate.Country };
  const contact = company?.contact ?? { phone: candidate.Phone, email: candidate.Email,
    homepage: candidate.Homepage };
  const media = status === "SAFE_IMPORT" && mediaChoices.has(id) ? mediaChoices.get(id) : null;
  const legacyMedia = media ? {
    logo: media.logo ? mediaFile(company, media.logo) : null,
    images: media.images.map((filename) => mediaFile(company, filename)),
  } : { logo: null, images: [] };
  return {
    joomla_id: id, name, published: Number(candidate.Published) === 1,
    source_slug: company?.identity.slug ?? candidate.Slug,
    source_tags: Object.values(rawArticle?.tags ?? {}),
    planned_slug: status === "SAFE_IMPORT" ? slugify(name) : imported.get(id) ?? null,
    type: /tauchreisen/i.test(name) ? "Reiseveranstalter" : type ? "Unterkunft" :
      [462, 461].includes(id) ? "Tourismus/Route" : /barfusspark/i.test(name) ? "Unterkunft + Freizeit" : "Reiseanbieter/Unterkunft",
    address: [address.address, address.street_no].filter(Boolean).join(" ") || null,
    postal_code: address.zip || null, city: address.city || null, region: address.province || null,
    country: address.country || null, phone: contact.phone || null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email ?? "") ? contact.email : null,
    source_email: contact.email || null, homepage: /^https?:\/\/[^\s]+$/i.test(contact.homepage ?? "") ? contact.homepage : null,
    description: description(company?.rich_content.article_html ?? rawArticle?.text),
    media_reference_count: company?.media?.length ?? (rawArticle?.text?.match(/<img\b/gi)?.length ?? 0),
    source_logo_reference: Boolean(company?.media?.some((item) => item.source === "logo-details-bd") ||
      rawArticle?.["logo-details-bd"]?.includes("imagefile") &&
      !rawArticle?.["logo-details-bd"]?.includes('"imagefile":""')),
    logo: legacyMedia.logo, images: legacyMedia.images,
    theme_terms: themes, theme_labels: rawThemes.filter((value) => themeKeys.has(value)),
    audience_terms: audience, accommodation_terms: type ? [type] : [],
    feature_terms: [], duplicate_hint: duplicates.get(id) ?? null,
    already_in_supabase: imported.has(id), import_status: status, reason,
    source: company ? `.legacy-reiseportal/normalized/companies.json#${id}` :
      `.legacy-reiseportal/normalized/company-candidates.json#${id}; raw/articles.json#${id}`,
  };
});
if (rows.length !== candidates.length || rows.length !== 67) throw new Error("Unexpected candidate count");
const safe = rows.filter((row) => row.import_status === "SAFE_IMPORT");
if (new Set(safe.map((row) => row.planned_slug)).size !== safe.length) throw new Error("Planned slug collision");
if (safe.some((row) => !row.published || !row.name || !row.phone || !row.postal_code || !row.city))
  throw new Error("Incomplete safe import");

const sql = (value) => value == null || value === "" ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const batches = [];
for (let start = 0; start < safe.length; start += 12) batches.push(safe.slice(start, start + 12));
const migrationPaths = [];
for (const [index, batch] of batches.entries()) {
  const values = batch.map((row) => `    (${[
    row.joomla_id, row.planned_slug, row.name, row.description, row.theme_labels.join(", "),
    row.address, row.postal_code, row.city, { DE: "Deutschland", AT: "Österreich", IT: "Italien", CH: "Schweiz" }[row.country] ?? row.country,
    row.phone, row.email, row.homepage,
  ].map(sql).join(", ")})`).join(",\n");
  const assignments = batch.flatMap((row) => [...row.theme_terms, ...row.audience_terms,
    ...row.accommodation_terms, ...row.feature_terms].map((term) => `    (${sql(row.planned_slug)}, ${sql(term)})`)).join(",\n");
  const body = `-- Published Joomla articles and audit decisions: docs/reiseportal-legacy-inventory.json.\n` +
`-- Batch ${index + 1}/${batches.length}, article IDs ${batch.map((row) => row.joomla_id).join(", ")}.\n` +
`-- Only absent slugs are inserted; existing profiles, owners, RLS and media tables stay untouched.\n` +
`WITH source(joomla_id,slug,name,description,business_areas,street,postal_code,city,country,phone,public_email,website) AS (\n` +
`  VALUES\n${values}\n), new_companies AS (\n` +
`  INSERT INTO public.companies(owner_user_id,legal_name,contact_email)\n` +
`  SELECT NULL,s.name,s.public_email FROM source s\n` +
`  WHERE NOT EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.slug=s.slug)\n` +
`  RETURNING id,legal_name\n` +
`), new_profiles AS (\n` +
`  INSERT INTO public.company_profiles(company_id,slug,display_name,description,business_areas,street,postal_code,city,country,phone,public_email,website,status,approved_at)\n` +
`  SELECT c.id,s.slug,s.name,s.description,s.business_areas,s.street,s.postal_code,s.city,s.country,s.phone,s.public_email,s.website,'approved',now()\n` +
`  FROM source s JOIN new_companies c ON c.legal_name=s.name\n` +
`  RETURNING id,slug\n` +
`)\n` +
`INSERT INTO public.company_profile_travel_terms(profile_id,term_key)\n` +
`SELECT p.id,t.term_key FROM new_profiles p\n` +
`JOIN (VALUES\n${assignments}\n) AS tagged(slug,term_key) ON tagged.slug=p.slug\n` +
`JOIN public.travel_terms t ON t.term_key=tagged.term_key\n` +
`ON CONFLICT (profile_id,term_key) DO NOTHING;\n`;
  const filename = `supabase/migrations/2026092619000${index + 1}_import_verified_reiseportal_batch_${String(index + 1).padStart(2, "0")}.sql`;
  writeFileSync(new URL(filename, root), body);
  migrationPaths.push(filename);
}
// The legacy company_profiles.region column defaults to "Bayern". The four
// already-applied insert batches omitted it; correct only these 45 rows using
// their structured Joomla province values (usually absent).
const regionFilename = "supabase/migrations/20260926190005_fix_verified_reiseportal_regions.sql";
const regionValues = safe.map((row) => `  (${sql(row.planned_slug)}, ${sql(row.region)}, ${sql({ DE: "Deutschland", AT: "Österreich", IT: "Italien", CH: "Schweiz" }[row.country])})`).join(",\n");
writeFileSync(new URL(regionFilename, root), `-- Correct the pre-existing Bayern column default only on this controlled import.\n` +
  `-- No previously existing profile or company is changed. Idempotent on re-run.\n` +
  `UPDATE public.company_profiles p SET region=s.region\n` +
  `FROM (VALUES\n${regionValues}\n) AS s(slug,region,country), public.companies c\n` +
  `WHERE p.company_id=c.id AND p.slug=s.slug AND p.country=s.country\n` +
  `  AND c.owner_user_id IS NULL AND p.status='approved' AND p.region IS DISTINCT FROM s.region;\n`);
migrationPaths.push(regionFilename);

const mappingPath = new URL("src/data/reiseportal-legacy-import-media.json", root);
if (existsSync(mappingPath)) {
  const priorMapping = JSON.parse(readFileSync(mappingPath, "utf8"));
  for (const entry of Object.values(priorMapping)) {
    for (const image of [entry.logo, ...entry.images].filter(Boolean)) {
      if (!/^\/reiseportal\/unterkuenfte\/[a-z0-9-]+\/(?:logo|0[1-9])\.(?:jpg|png|webp)$/.test(image.src))
        throw new Error(`Unexpected generated medium: ${image.src}`);
      const target = new URL(`public${image.src}`, root);
      if (existsSync(target)) unlinkSync(target);
    }
  }
}
const mediaMapping = {};
let copied = 0;
for (const row of safe) {
  const selected = [row.logo, ...row.images].filter(Boolean);
  if (!selected.length) continue;
  const directory = new URL(`public/reiseportal/unterkuenfte/${row.planned_slug}/`, root);
  mkdirSync(directory, { recursive: true });
  const publicPath = (medium, position) => {
    const extension = extname(medium.local_path).toLowerCase();
    const filename = position === 0 ? `logo${extension}` : `${String(position).padStart(2, "0")}${extension}`;
    const target = new URL(filename, directory);
    copyFileSync(medium.local_path, target);
    copied++;
    return `/reiseportal/unterkuenfte/${row.planned_slug}/${filename}`;
  };
  mediaMapping[row.planned_slug] = {
    ...(row.logo ? { logo: { src: publicPath(row.logo, 0), alt: `Logo von ${row.name}` } } : {}),
    images: row.images.map((medium, i) => ({ src: publicPath(medium, i + 1), alt: `${row.name} – Originalbild ${i + 1}` })),
  };
}
writeFileSync(mappingPath, JSON.stringify(mediaMapping, null, 2) + "\n");
writeFileSync(new URL("docs/reiseportal-legacy-inventory.json", root), JSON.stringify(rows.map((row) => ({
  ...row, logo: row.logo ? { source: row.logo.source, original_path: row.logo.original_path, bytes: row.logo.bytes } : null,
  images: row.images.map((medium) => ({ source: medium.source, original_path: medium.original_path, bytes: medium.bytes })),
})), null, 2) + "\n");
const statuses = [...new Set(rows.map((row) => row.import_status))].map((status) => `${status}: ${rows.filter((row) => row.import_status === status).length}`).join(", ");
const table = rows.map((row) => `| ${row.joomla_id} | ${row.name.replaceAll("|", "\\|")} | ${row.published ? "publiziert" : "unpubliziert"} | ${row.planned_slug ?? "–"} | ${row.type} | ${row.address ? "ja" : "nein"} | ${row.phone ? "ja" : "nein"} | ${row.email ? "ja" : "nein"} | ${row.homepage ? "ja" : "nein"} | ${row.images.length}/${row.media_reference_count} | ${row.source_logo_reference ? "ja" : "nein"}/${row.logo ? "ja" : "nein"} | ${row.description ? "ja" : "nein"} | ${row.theme_terms.length} | ${row.audience_terms.length} | ${row.accommodation_terms.length} | ${row.feature_terms.length} | ${row.duplicate_hint ? "ja" : "nein"} | ${row.already_in_supabase ? "ja" : "nein"} | ${row.import_status} | ${row.reason.replaceAll("|", "\\|")} |`).join("\n");
writeFileSync(new URL("docs/reiseportal-legacy-inventory.md", root), `# Joomla-Anbieterinventar\n\nQuelle: veröffentlichte Normalisierung (63) und vollständige Kandidatenliste (67) aus \`.legacy-reiseportal\`. Die maschinenlesbare Matrix enthält Feldwerte, Originalmedienpfade und strukturierte Zuordnungen. Keine Beschreibung wurde für eine Merkmalsableitung verwendet.\n\n${statuses}. Neue Profile: ${safe.length}, in ${batches.length} Batches. Originalmedien als lokale Präsentationsdateien: ${copied}; redaktionelle Storage-Uploads behalten Vorrang.\n\n| Joomla-ID | Name | Status | Slug | Typ | Adresse | Telefon | Mail | Web | Bilder ausgewählt/Referenzen | Logo Quelle/übernommen | Beschreibung | Themes | Audience | Accommodation | Features | Dublette? | Cloud? | Importstatus | Begründung |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${table}\n\nBekannte Querverweise: 507/454/508 (Appartementhaus Salzburg), 503/502 (Salzburger Hof), 486/464 (Höflehner), 475/450 (Anni). Sie bleiben getrennt dokumentiert. Joomla 472 verweist beim Logo auf das Verzeichnis von 471; dieses fremde Bild wurde nicht übernommen. Screenshot-/Bannerdateien wurden nicht als Logos oder Galerieersatz benutzt. Artikel 459 enthält im Mail-Feld eine URL, die deshalb nicht als E-Mail importiert wird.\n\nMigrationsdateien: ${migrationPaths.map((path) => `\`${path}\``).join(", ")}.\n`);
appendFileSync(new URL("docs/reiseportal-legacy-inventory.md", root),
  "\nQuellenkonflikt: Artikel 472 hat im Joomla-Länderfeld IT, aber auch den Tag „Schweiz“, 6197 Schangnau und +41. Die ursprüngliche Importmigration bewahrt den Feldwert. Die eng begrenzte Migration `supabase/migrations/20260927090000_correct_kemmeriboden_country.sql` korrigiert nur dieses Profil auf Schweiz. Im JSON-Inventar bleibt IT als Quellenwert erhalten.\n");
console.log(JSON.stringify({ candidates: rows.length, published: companies.length, safe: safe.length, statuses, batches: batches.map((b) => b.length), copied, migrationPaths }, null, 2));
