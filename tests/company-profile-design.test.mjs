import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
registerHooks({
  resolve(s, c, next) {
    if (s === "server-only" || s === "next/cache")
      return {
        url: "data:text/javascript,export function revalidatePath(){}",
        shortCircuit: true,
      };
    if (s === "next/navigation")
      return {
        url: 'data:text/javascript,export function redirect(path){throw Error("REDIRECT:"+path)};export function notFound(){throw Error("NOT_FOUND")}',
        shortCircuit: true,
      };
    if (s.endsWith("/supabase/server"))
      return {
        url: "data:text/javascript,export async function createClient(){return globalThis.__profileTestClient}",
        shortCircuit: true,
      };
    if (s.endsWith(".module.css"))
      return {
        url: "data:text/javascript,export default {}",
        shortCircuit: true,
      };
    if (s === "next/link" || s === "next/image")
      return {
        url: `data:text/javascript,export default ${JSON.stringify(s === "next/link" ? "a" : "img")}`,
        shortCircuit: true,
      };
    if (s.startsWith("@/") || s.startsWith(".")) {
      const u = s.startsWith("@/")
        ? new URL("../src/" + s.slice(2), import.meta.url)
        : new URL(s, c.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(u.href + ext))) return next(u.href + ext, c);
    }
    return next(s, c);
  },
  load(url, c, next) {
    if (url.endsWith(".tsx"))
      return {
        format: "module",
        shortCircuit: true,
        source: transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
        }).outputText,
      };
    return next(url, c);
  },
});
const { default: DetailsPage } =
  await import("../src/app/(energieheld)/firma/profil/page.tsx");
const { default: DesignPage } =
  await import("../src/app/(energieheld)/firma/profil/gestalten/page.tsx");
const { saveProfile } =
  await import("../src/app/(energieheld)/firma/profil/actions.ts");
const { profileFields } = await import("../src/lib/company-profile.ts");
const { CompanyProfileDesigner } =
  await import("../src/components/auth/company-media-form.tsx");
const { CompanyPublication } =
  await import("../src/components/auth/company-publication.tsx");
const { ListingDetail } =
  await import("../src/components/portal/listing-detail.tsx");
const { companyProfileListing } =
  await import("../src/lib/company-presentation.ts");
const { PortalHeader } = await import("../src/components/portal/chrome.tsx");
const { energieheld } = await import("../src/config/energieheld.ts");
const { reiseportal } = await import("../src/config/reiseportal.ts");
const profile = {
  ...Object.fromEntries(profileFields.map((f) => [f, ""])),
  id: "own-profile",
  slug: "firma",
  display_name: "Bauwerk & Energie",
  tagline: "Durchdacht sanieren. Nachhaltig bauen.",
  description:
    "Wir begleiten die energetische Modernisierung von Wohngebäuden – von der Planung bis zur Umsetzung.",
  business_areas: "Fassadensanierung, Wärmedämmung und Energieberatung",
  city: "München",
  postal_code: "80331",
  region: "Bayern",
  country: "Deutschland",
  public_email: "kontakt@example.org",
  phone: "089 123456",
  website: "https://example.org",
  status: "approved",
  company_profile_categories: [
    { category_id: "daemmung" },
    { category_id: "fassade" },
  ],
  company_profile_images: [],
};
function client(authenticated = true) {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: authenticated
            ? { id: "owner", email: "owner@example.org" }
            : null,
        },
        error: null,
      }),
    },
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        update() {
          return this;
        },
        async maybeSingle() {
          return {
            data:
              table === "companies"
                ? { id: "own-company", legal_name: "Bauwerk & Energie" }
                : profile,
            error: null,
          };
        },
      };
    },
  };
}
test("profile details contain only text fields and redirect after successful save", async () => {
  globalThis.__profileTestClient = client();
  const html = renderToStaticMarkup(await DetailsPage());
  assert.match(html, /Speichern &amp; Profil gestalten/);
  assert.doesNotMatch(
    html,
    /type="file"|Logo hochladen|Unternehmensbild hinzufügen|Zur Prüfung einreichen/,
  );
  const form = new FormData();
  for (const f of profileFields) form.set(f, profile[f]);
  form.set("intent", "save");
  await assert.rejects(
    saveProfile({}, form),
    /REDIRECT:\/firma\/profil\/gestalten/,
  );
});
test("designer is server protected and renders shared profile with in-place media controls", async () => {
  globalThis.__profileTestClient = client(false);
  await assert.rejects(DesignPage(), /REDIRECT:\/login/);
  globalThis.__profileTestClient = client();
  const html = renderToStaticMarkup(await DesignPage());
  assert.match(html, /class="company-profile"/);
  assert.match(html, /Firmenlogo hinzufügen/);
  assert.match(html, /Unternehmensbilder hinzufügen/);
  assert.match(html, /Bauwerk &amp; Energie/);
  assert.match(html, /Kontakt &amp; Standort/);
  assert.match(html, /data-status="approved">Veröffentlicht/);
  assert.ok(
    html.indexOf('data-status="approved"') <
      html.indexOf('class="company-profile"'),
  );
  assert.match(html, /Öffentliches Profil ansehen/);
  assert.doesNotMatch(
    html,
    /Ihr Profil ist veröffentlicht|profile-publication/,
  );
  assert.doesNotMatch(html, /Profil zur erstmaligen Freischaltung einreichen/);
});
test("editor gallery shares the public position and preserves contain logo and all media controls", () => {
  const media = {
    logo: {
      src: "/images/energieheld-logo.jpg",
      alt: "Logo von Bauwerk & Energie",
    },
    images: [
      { id: "one", src: "/images/house.jpg", alt: "Referenzprojekt" },
      { id: "two", src: "/images/home.jpg", alt: "Modernisierung" },
    ],
  };
  const listing = companyProfileListing(profile, media);
  const html = renderToStaticMarkup(
    createElement(CompanyProfileDesigner, { listing, media }),
  );
  assert.match(html, /object-fit:contain/);
  assert.match(html, /class="gallery-main"/);
  assert.match(html, /nach links verschieben/);
  assert.match(html, /nach rechts verschieben/);
  assert.match(html, /Bild löschen/);
  assert.match(html, /Logo entfernen/);
  assert.match(html, /Bild hinzufügen/);
  assert.match(html, /class="gallery-thumbs"[\s\S]*class="gallery-add-tile"/);
  assert.doesNotMatch(
    html.split("<dialog")[0],
    /type="file"|type="text"|5 MB|Zum Ändern auf/,
  );
  assert.match(html, /<dialog[^>]*aria-labelledby="profile-upload-title"/);
  assert.doesNotMatch(html, /<dialog[^>]*\sopen/);
  assert.match(html, /Bildbeschreibung \(optional\)/);
  assert.ok(html.indexOf("gallery-main") < html.indexOf("Über Bauwerk"));
  const publicHtml = renderToStaticMarkup(
    createElement(ListingDetail, {
      listing,
      categories: energieheld.categories,
      presentation: "company",
    }),
  );
  assert.match(publicHtml, /class="gallery-main"/);
  assert.doesNotMatch(
    publicHtml,
    /Bild löschen|type="file"|gallery-add-tile|profile-editor-toolbar|thumbnail-edit-actions/,
  );
  assert.match(publicHtml, /Tätigkeitsbereiche/);
  if (process.env.PROFILE_PREVIEW_FILE) {
    const css =
      readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8") +
      readFileSync(
        new URL(
          "../src/components/portal/company-profile.css",
          import.meta.url,
        ),
        "utf8",
      );
    writeFileSync(
      process.env.PROFILE_PREVIEW_FILE,
      `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profilgestaltung – lokale Testdaten</title><style>${css}</style><body><main class="container detail-page"><div class="profile-editor-toolbar"><div><h1>Profil gestalten</h1><p>Schritt 2 von 2 · Ihre Profilvorschau</p></div><a href="#">Stammdaten bearbeiten</a></div>${html}</main></body></html>`,
    );
  }
});
test("only new or rejected profiles can request initial publication; pending and approved do not repeat review", () => {
  for (const status of ["draft", "rejected", "pending", "approved"]) {
    const html = renderToStaticMarkup(
      createElement(CompanyPublication, { status }),
    );
    assert.equal(
      html.includes("Profil zur erstmaligen Freischaltung einreichen"),
      ["draft", "rejected"].includes(status),
    );
    if (status === "approved" || status === "pending") assert.equal(html, "");
  }
});

test("editor toolbar reflects all publication states without exposing draft public links", async () => {
  globalThis.__profileTestClient = client();
  const labels = {
    draft: "Entwurf",
    pending: "Wartet auf Freischaltung",
    rejected: "Änderungen erforderlich",
    approved: "Veröffentlicht",
  };
  try {
    for (const [status, label] of Object.entries(labels)) {
      profile.status = status;
      const html = renderToStaticMarkup(await DesignPage());
      const toolbar = html.slice(0, html.indexOf('class="company-profile"'));
      assert.ok(toolbar.includes(label));
      assert.equal(
        toolbar.includes("Öffentliches Profil ansehen"),
        status === "approved",
      );
    }
  } finally {
    profile.status = "approved";
  }
});

test("full gallery disables the add tile and keeps all sorting controls in the gallery", () => {
  const media = {
    images: Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      src: `/images/test-${i}.jpg`,
      alt: `Bild ${i + 1}`,
    })),
  };
  const html = renderToStaticMarkup(
    createElement(CompanyProfileDesigner, {
      listing: companyProfileListing(profile, media),
      media,
    }),
  );
  assert.match(
    html,
    /class="gallery-add-tile" disabled="" aria-label="Alle 8 Bildplätze sind belegt"/,
  );
  assert.equal((html.match(/class="thumbnail-edit-actions"/g) ?? []).length, 8);
  assert.match(html, /Firmenlogo hinzufügen/);
});
test("Energieheld has no global false demo claim; travel preview stays unchanged", () => {
  assert.doesNotMatch(
    renderToStaticMarkup(createElement(PortalHeader, { brand: energieheld })),
    /Alle Anbieter und Angebote sind Beispieldaten/,
  );
  assert.match(
    renderToStaticMarkup(createElement(PortalHeader, { brand: reiseportal })),
    /Alle Anbieter und Angebote sind Beispieldaten/,
  );
});
