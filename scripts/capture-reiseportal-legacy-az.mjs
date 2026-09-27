// Capture the public Joomla A–Z directory as evidence, independent of the
// article candidate count. Run manually while the old site is available.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname } from "node:path";

const base = "https://das-reiseportal.com/unterk%C3%BCnfte-a-z";
const companies = JSON.parse(readFileSync(new URL("../.legacy-reiseportal/normalized/companies.json", import.meta.url), "utf8").replace(/^\uFEFF/, "")).companies;
const inventory = JSON.parse(readFileSync(new URL("../docs/reiseportal-legacy-inventory.json", import.meta.url), "utf8"));
const byId = new Map(inventory.map((item) => [item.joomla_id, item]));
const mediaManifest = JSON.parse(readFileSync(new URL("../.legacy-reiseportal/normalized/company-media-manifest.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""));

function decode(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|nbsp|uuml|ouml|auml|szlig);/gi, (_, entity) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return { amp: "&", quot: '"', apos: "'", nbsp: " ", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß" }[entity.toLowerCase()] ?? _;
  }).replace(/\s+/g, " ").trim();
}

function field(html, pattern) {
  return decode(html.match(pattern)?.[1] ?? "");
}

function profileSlug(company) {
  const id = Number(company.legacy.joomla_article_id);
  if ([507, 454].includes(id)) return "appartementhaus-salzburg";
  if ([503, 502].includes(id)) return "hotel-salzburger-hof";
  if (id === 486) return "hoeflehner";
  if (id === 455) return "ferienbauernhof-buechele";
  return byId.get(id)?.planned_slug ?? null;
}

const rows = [];
for (let page = 1; page <= 7; page++) {
  const sourceUrl = page === 1 ? base : `${base}?start=${(page - 1) * 10}`;
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Cannot read ${sourceUrl}: ${response.status}`);
  const html = await response.text();
  const starts = [...html.matchAll(/<div class="card border-light border-1 c4w_businessdirectory-(complete|basic)\b[^">]*">/g)];
  const expected = page === 7 ? 3 : 10;
  if (starts.length !== expected) throw new Error(`Page ${page}: expected ${expected} rows, got ${starts.length}`);
  for (let index = 0; index < starts.length; index++) {
    const card = html.slice(starts[index].index, starts[index + 1]?.index ?? html.indexOf("Seite ", starts[index].index));
    const name = field(card, /<h3 class="card-title[^">]*">([\s\S]*?)<\/h3>/);
    const tier = starts[index][1] === "complete" ? "CONFIRMED_PREMIUM" : "CONFIRMED_BASIC";
    const matching = companies.filter((company) => company.identity.name.trim() === name &&
      Boolean(company.classification.vip?.["2"]) === (tier === "CONFIRMED_PREMIUM"));
    if (matching.length !== 1) throw new Error(`Ambiguous Joomla match ${page}/${index + 1}: ${name} (${matching.length})`);
    const company = matching[0];
    const id = Number(company.legacy.joomla_article_id);
    const item = byId.get(id);
    rows.push({
      page, position: index + 1, visible_name: name, joomla_id: id,
      old_alias: company.identity.slug, source_url: sourceUrl,
      visible_address: field(card, /fa-map-marker-alt[^<]*<\/span>\s*<div class="small"[^>]*>([\s\S]*?)<\/div>/),
      visible_email: field(card, /href="mailto:([^"]+)"/) ||
        (card.includes("joomla-hidden-mail") ? company.contact.email ?? "" : ""),
      visible_phone: field(card, /fa-phone[^<]*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/),
      visible_website: field(card, /fa-globe[^<]*<\/span>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/),
      themes: [...card.matchAll(/<span class="badge small bg-dark bg-opacity-75[^">]*">([\s\S]*?)<\/span>/g)].map((match) => decode(match[1])),
      visible_image: field(card, /<img[^>]*src="([^"]+)"/),
      video: /data-bs-target="#businessdirectory-video-\d+"/.test(card),
      historical_package: tier, current_profile_slug: profileSlug(company),
      match_status: id === 462 || id === 461 ? "MISSING_PROVIDER" :
        [454, 502, 486].includes(id) ? "SAME_PROVIDER_DUPLICATE_SOURCE" : "EXISTING_MATCH",
      travel_provider: item?.type !== "Tourismus/Route",
    });
  }
}
if (rows.length !== 63 || new Set(rows.map((row) => row.joomla_id)).size !== 63) {
  throw new Error("The public A–Z capture does not contain 63 distinct Joomla rows");
}
writeFileSync(new URL("../docs/reiseportal-legacy-az-source.json", import.meta.url), `${JSON.stringify(rows, null, 2)}\n`);

const directoryMedia = {};
const mediaAudit = [];
for (const row of rows.filter((item) => item.travel_provider && item.historical_package === "CONFIRMED_PREMIUM")) {
  const slug = row.current_profile_slug;
  if (directoryMedia[slug]) {
    if (directoryMedia[slug].source_image !== row.visible_image) throw new Error(`Conflicting Premium images for ${slug}`);
    continue;
  }
  const sourceUrl = new URL(row.visible_image, "https://das-reiseportal.com").href;
  const entry = mediaManifest.files.find((item) => decodeURI(item.Url).toLowerCase() === decodeURI(sourceUrl).toLowerCase());
  if (!entry) throw new Error(`Missing original Premium asset: ${sourceUrl}`);
  const extension = extname(new URL(sourceUrl).pathname).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) throw new Error(`Unsupported Premium asset: ${sourceUrl}`);
  const relativeTarget = `/reiseportal/legacy-directory/${slug}${extension}`;
  const targetDirectory = new URL("../public/reiseportal/legacy-directory/", import.meta.url);
  mkdirSync(targetDirectory, { recursive: true });
  copyFileSync(entry.LocalPath, new URL(`../public${relativeTarget}`, import.meta.url));
  const checksum = createHash("sha256").update(readFileSync(entry.LocalPath)).digest("hex");
  directoryMedia[slug] = { src: relativeTarget, alt: `Historisches Verzeichnisbild von ${row.visible_name}`,
    source_image: row.visible_image };
  mediaAudit.push({ slug, joomla_id: row.joomla_id, source_url: sourceUrl,
    local_source: entry.RelativePath, target: relativeTarget, sha256: checksum });
}
if (Object.keys(directoryMedia).length !== 31) throw new Error("Expected 31 distinct, evidenced Premium media assets");
writeFileSync(new URL("../src/data/reiseportal-legacy-directory-media.json", import.meta.url),
  `${JSON.stringify(directoryMedia, null, 2)}\n`);
writeFileSync(new URL("../docs/reiseportal-legacy-az-media.json", import.meta.url),
  `${JSON.stringify(mediaAudit, null, 2)}\n`);

const cell = (value) => String(value || "–").replaceAll("|", "\\|").replaceAll("\n", " ");
const table = rows.map((row) => `| ${row.page}.${row.position} | ${cell(row.visible_name)} | ${row.joomla_id} | ${cell(row.old_alias)} | ${cell(row.visible_address)} | ${cell([row.visible_email, row.visible_phone, row.visible_website].filter(Boolean).join(" · "))} | ${cell(row.themes.join(", "))} | ${cell(row.visible_image)} | ${row.video ? "ja" : "nein"} | ${row.historical_package === "CONFIRMED_PREMIUM" ? "Complete" : "Basic"} | ${cell(row.current_profile_slug)} | ${row.travel_provider ? (directoryMedia[row.current_profile_slug] ? "Premium" : "Basic") : "–"} | ${row.match_status} |`).join("\n");
const assets = mediaAudit.map((item) => `| ${cell(item.slug)} | ${item.joomla_id} | ${cell(item.source_url)} | ${cell(item.local_source)} | ${cell(item.target)} | \`${item.sha256}\` |`).join("\n");
const markdown = `# Öffentliche Joomla-Unterkünfte A–Z: 63 sichtbare Zeilen

Quelle: [öffentliches Altverzeichnis](${base}), Seiten 1–7 mit \`?start=10\` bis \`?start=60\`, gelesen am 27.09.2026. Die Zeilen wurden direkt aus dem gerenderten öffentlichen \`c4w_businessdirectory-list\` und seinem HTML erfasst. \`c4w_businessdirectory-complete\` plus \`vip = {"2":"Complete"}\` im Joomla-Export belegen die große historische Darstellung; \`c4w_businessdirectory-basic\` die kompakte. Das belegt den Layoutstatus, nicht eine bezahlte Vertragsstufe.

Es sind 34 Complete-Zeilen und 29 Basic-Zeilen. Die beiden Salzburger-Hof-Complete-Zeilen gehören zu einem Anbieter; Appartementhaus Salzburg und Höflehner stehen je einmal in Complete und Basic. Zwei Complete-Zeilen (Neckartal Radweg, Tourismusverband Sächsische Schweiz) beschreiben keine eigene Unterkunft oder Reiseleistung; sie sind als alte öffentliche, im neuen Unterkunftsverzeichnis fehlende Einträge dokumentiert und werden nicht als Unterkunft importiert. Damit bleiben 58 eindeutige Reiseanbieter, davon 31 mit belegtem Complete-Layout. Drei zusätzliche Zeilen sind Quellen-Dubletten.

\`EXISTING_MATCH\` bedeutet eindeutige Zuordnung zu einem Profil nach der Korrektur. \`SAME_PROVIDER_DUPLICATE_SOURCE\` bedeutet eine zweite öffentliche Joomla-Zeile desselben realen Anbieters. \`MISSING_PROVIDER\` bezeichnet die zwei alten touristischen Nicht-Unterkünfte ohne neues Unterkunftsprofil. Alle 63 Joomla-IDs sind eindeutig; keine bestätigte Dublette wird als zweites Profil importiert. Die vollständigen Rohfelder stehen in [der JSON-Matrix](./reiseportal-legacy-az-source.json). Bei vor JavaScript maskierten Adressen stammt die E-Mail aus dem identischen Joomla-Kontaktfeld.

| Seite.Pos. | Öffentlicher Name | Joomla-ID | Alter Alias | Sichtbare Adresse | Sichtbarer Kontakt | Themen | Öffentliches Bild | Video | Altes Layout | Supabase-Slug | Neues Layout | Match |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table}

## Historisch verwendete Premium-Medien

Jedes dieser 31 Bilder ist das konkrete \`image_intro\` der alten Complete-Karte. Die Dateien stammen aus dem bestehenden Joomla-Medienmanifest. Der SHA-256 dokumentiert den unveränderten Kopiervorgang. Bestehende Admin-Uploads behalten bei der Anzeige Vorrang. Banner und fremde Anbieterbilder wurden nicht verwendet.

| Neues Profil | Joomla-ID | Öffentliche Original-URL | Lokales Export-Asset | Neues Asset | SHA-256 |
| --- | ---: | --- | --- | --- | --- |
${assets}

Der [vollständige Mediennachweis](./reiseportal-legacy-az-assets.json) erfasst alle 459 Joomla-Referenzen aus Artikel, Intro und Custom Fields: 439 sind den Reiseprofilen zugeordnet, 19 gehören zu den beiden touristischen Nicht-Unterkünften und eine Logo-Referenz des Kemmeriboden-Bad zeigt nachweislich auf Rü Blanch und wurde ausgeschlossen. 287 noch fehlende Originaldateien wurden zusätzlich zu bereits vorhandenen identischen Dateien ins Projekt kopiert. Die [Profil-Medienzuordnung](../src/data/reiseportal-legacy-provider-media.json) enthält die belegten Artikelgalerien und eindeutig als Logo bezeichneten Dateien. Gespeicherte Redaktionsmedien bleiben vorrangig.

Der alte Bestand verteilte 10 Zeilen auf Seiten 1–6 und 3 auf Seite 7. Die neue Suchseite zeigt den gefilterten Bestand ohne diese historische 10er-Paginierung.
`;
writeFileSync(new URL("../docs/reiseportal-legacy-az.md", import.meta.url), markdown);
console.log(`Captured ${rows.length} visible A–Z rows and ${mediaAudit.length} original Premium card images.`);
