// Assign every provider-specific Joomla article/custom-field image to its
// confirmed A-Z provider. Existing copied originals are reused by SHA-256.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname } from "node:path";

const read = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
const rows = read("../docs/reiseportal-legacy-az-source.json");
const companies = read("../.legacy-reiseportal/normalized/companies.json").companies;
const manifest = read("../.legacy-reiseportal/normalized/company-media-manifest.json");
const oldCards = read("../docs/reiseportal-legacy-az-media.json");
const byId = new Map(companies.map((company) => [Number(company.legacy.joomla_article_id), company]));
const byUrl = new Map(manifest.files.map((entry) => [decodeURI(entry.Url).toLowerCase(), entry]));
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const isRasterImage = (path) => {
  const bytes = readFileSync(path);
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === ".png") return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (extension === ".webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
};
const audit = [];
const grouped = new Map();

for (const row of rows) {
  const company = byId.get(row.joomla_id);
  if (!company) throw new Error(`Missing Joomla article ${row.joomla_id}`);
  for (const medium of company.media) {
    const entry = byUrl.get(decodeURI(medium.source_url).toLowerCase());
    if (!entry || !existsSync(entry.LocalPath)) throw new Error(`Missing original ${medium.source_url}`);
    const foreign = row.joomla_id === 472 && medium.source_url.includes("/RU%20Blanch/");
    const validImage = isRasterImage(entry.LocalPath);
    const auditRow = {
      joomla_id: row.joomla_id, visible_name: row.visible_name,
      profile_slug: row.travel_provider ? row.current_profile_slug : null,
      field: medium.source, source_url: medium.source_url,
      original_path: medium.original_path, export_file: entry.RelativePath,
      sha256: sha(entry.LocalPath),
      old_card_image: medium.source_url === new URL(row.visible_image, "https://das-reiseportal.com").href,
      decision: !row.travel_provider ? "SKIP_NON_TRAVEL" : foreign ? "SKIP_FOREIGN_PROVIDER" :
        !validImage ? "SKIP_INVALID_IMAGE" : "ASSIGN",
      public_asset: null,
    };
    audit.push(auditRow);
    if (auditRow.decision !== "ASSIGN") continue;
    const group = grouped.get(row.current_profile_slug) ?? [];
    if (!group.some((item) => item.sha256 === auditRow.sha256)) group.push({ ...auditRow, source_file: entry.LocalPath });
    grouped.set(row.current_profile_slug, group);
  }
}

const existing = new Map();
for (const card of oldCards) existing.set(`${card.slug}:${card.sha256}`, card.target);
const existingBase = new URL("../public/reiseportal/unterkuenfte/", import.meta.url);
for (const [slug] of grouped) {
  const directory = new URL(`${slug}/`, existingBase);
  if (!existsSync(directory)) continue;
  for (const file of readdirSync(directory)) {
    const target = new URL(file, directory);
    if (!existsSync(target)) continue;
    existing.set(`${slug}:${sha(target)}`, `/reiseportal/unterkuenfte/${slug}/${file}`);
  }
}

let copied = 0;
const providerMedia = {};
for (const [slug, entries] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
  const assigned = [];
  const outputDir = new URL(`../public/reiseportal/legacy-provider-media/${slug}/`, import.meta.url);
  for (let index = 0; index < entries.length; index++) {
    const item = entries[index];
    let target = existing.get(`${slug}:${item.sha256}`);
    if (!target) {
      const extension = extname(new URL(item.source_url).pathname).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".webp"].includes(extension)) throw new Error(`Unsupported ${item.source_url}`);
      target = `/reiseportal/legacy-provider-media/${slug}/${String(index + 1).padStart(2, "0")}${extension}`;
      mkdirSync(outputDir, { recursive: true });
      copyFileSync(item.source_file, new URL(`../public${target}`, import.meta.url));
      existing.set(`${slug}:${item.sha256}`, target);
      copied++;
    }
    assigned.push({ ...item, target });
  }
  const logoSource = assigned.find((item) =>
    item.field === "logo-details-bd" && /logo/i.test(item.original_path)) ??
    assigned.find((item) => item.field === "contact-person-image-bd" && /logo/i.test(item.original_path));
  const gallerySources = assigned.filter((item) =>
    item.field === "article-html" || item.field.startsWith("content-image-"));
  if (!gallerySources.length) gallerySources.push(...assigned.filter((item) => item.field === "image_intro"));
  providerMedia[slug] = {
    ...(logoSource ? { logo: { src: logoSource.target, alt: `Originales Anbieterlogo von ${rows.find((row) => row.current_profile_slug === slug).visible_name}` } } : {}),
    images: gallerySources.map((item, index) => ({ src: item.target,
      alt: `Originalbild ${index + 1} von ${rows.find((row) => row.current_profile_slug === slug).visible_name}` })),
  };
}
for (const item of audit) {
  if (item.decision === "ASSIGN") item.public_asset = existing.get(`${item.profile_slug}:${item.sha256}`) ?? null;
  if (item.decision === "ASSIGN" && !item.public_asset) throw new Error(`Unassigned provider medium ${item.source_url}`);
}
if (audit.length !== 459 || grouped.size < 31) throw new Error("Incomplete Joomla media audit");
writeFileSync(new URL("../docs/reiseportal-legacy-az-assets.json", import.meta.url), `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(new URL("../src/data/reiseportal-legacy-provider-media.json", import.meta.url), `${JSON.stringify(providerMedia, null, 2)}\n`);
console.log(`Audited ${audit.length} Joomla references, mapped ${grouped.size} providers, copied ${copied} original files.`);
