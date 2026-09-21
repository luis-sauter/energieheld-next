import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
registerHooks({
  resolve(s, c, next) {
    if (s === "next/headers")
      return {
        url: 'data:text/javascript,export async function headers(){throw Error("Headers not expected during render")}',
        shortCircuit: true,
      };
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

test("dashboard cards and campaign statistics render real zeros, empty state and zero CTR", async () => {
  const { TrafficCards, CampaignStatistics, PeriodPicker } =
    await import("../src/components/dashboard/metrics.tsx");
  const traffic = {
    profile_views: 0,
    contact_clicks: 0,
    website_clicks: 0,
    has_data: false,
  };
  const cards = renderToStaticMarkup(
    createElement(TrafficCards, { traffic, leads: 2 }),
  );
  assert.match(cards, /Noch keine Daten/);
  assert.match(cards, /Erhaltene Kontaktanfragen/);
  assert.match(cards, />2<\/dd>/);
  assert.equal((cards.match(/>0<\/dd>/g) ?? []).length, 3);
  const data = {
    today: "2026-09-18",
    campaigns: [
      {
        id: "test",
        internal_name: "Eigene Kampagne",
        status: "approved",
        approved_start_date: "2026-09-19",
        approved_end_date: "2026-10-01",
        impressions: 0,
        clicks: 0,
      },
    ],
  };
  const table = renderToStaticMarkup(
    createElement(CampaignStatistics, { data }),
  );
  assert.match(table, /Geplant/);
  assert.match(table, /0 %/);
  assert.doesNotMatch(table, /NaN|Infinity/);
  const empty = renderToStaticMarkup(
    createElement(CampaignStatistics, { data: { ...data, campaigns: [] } }),
  );
  assert.match(empty, /Noch keine Werbekampagnen/);
  const picker = renderToStaticMarkup(
    createElement(PeriodPicker, {
      period: "7",
      base: "/admin",
      view: "veroeffentlicht",
    }),
  );
  assert.match(picker, /zeitraum=7/);
  assert.match(picker, /ansicht=veroeffentlicht/);
  assert.equal((picker.match(/aria-current="page"/g) ?? []).length, 1);
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
  assert.ok(html.indexOf("profile-information") < html.indexOf("Über Bauwerk"));
  assert.ok(html.indexOf("Über Bauwerk") < html.indexOf("gallery-main"));
  assert.match(html, /aria-label="Standort"/);
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

test("inbox route redirects visitors and renders private inquiries and status controls", async () => {
  const { default: Inbox } =
    await import("../src/app/(energieheld)/firma/anfragen/page.tsx");
  globalThis.__profileTestClient = client(false);
  await assert.rejects(
    Inbox({ searchParams: Promise.resolve({}) }),
    /REDIRECT:\/login/,
  );
  globalThis.__profileTestClient = client();
  const original = globalThis.__profileTestClient.from;
  globalThis.__profileTestClient.from = (table) =>
    table === "company_leads"
      ? {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          async range() {
            return {
              data: [
                {
                  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  name: "Interessent",
                  email: "kunde@example.org",
                  phone: "089123",
                  message: "Meine Anfrage\nWeitere Angaben",
                  status: "new",
                  created_at: "2026-09-17T12:00:00Z",
                },
              ],
              error: null,
              count: 1,
            };
          },
        }
      : original(table);
  const html = renderToStaticMarkup(
    await Inbox({ searchParams: Promise.resolve({}) }),
  );
  assert.match(html, /Interessent/);
  assert.match(html, /kunde@example.org/);
  assert.match(html, /Meine Anfrage/);
  assert.match(html, /Neu/);
  assert.match(html, /Gelesen/);
  assert.match(html, /Erledigt/);
});

test("quality admin UI exposes separate verification controls; company dashboard is read-only", async () => {
  const { QualityReviewForm } =
    await import("../src/components/quality/quality-review-form.tsx");
  const { default: CompanyPage } =
    await import("../src/app/(energieheld)/firma/page.tsx");
  const review = {
    status: "verified",
    verified_at: "2026-09-17T12:00:00Z",
    public_note: "Persönlich bekannt",
  };
  const absent = renderToStaticMarkup(
    createElement(QualityReviewForm, { profileId: "test" }),
  );
  assert.match(absent, /Keine Verifizierung angefragt/);
  assert.doesNotMatch(absent, /value="verify"/);
  assert.doesNotMatch(absent, /Verifizierung entfernen/);
  const pending = renderToStaticMarkup(
    createElement(QualityReviewForm, {
      profileId: "test",
      request: {
        status: "pending",
        requested_at: "2026-09-17T12:00:00Z",
        decided_at: null,
      },
    }),
  );
  assert.match(pending, /Verifizierung angefragt am/);
  assert.match(pending, /Persönlich verifizieren/);
  assert.match(pending, /Anfrage ablehnen/);
  const present = renderToStaticMarkup(
    createElement(QualityReviewForm, { profileId: "test", review }),
  );
  assert.match(present, /Verifizierung entfernen/);
  assert.match(present, /Persönlich bekannt/);
  assert.match(present, /2026/);
  globalThis.__profileTestClient = client();
  profile.company_quality_reviews = review;
  try {
    const html = renderToStaticMarkup(await CompanyPage());
    assert.match(html, /Ihr Unternehmen ist persönlich verifiziert/);
    assert.doesNotMatch(
      html,
      /Als persönlich verifiziert markieren|Verifizierung entfernen|name="public_note"/,
    );
  } finally {
    delete profile.company_quality_reviews;
  }
});

test("company quality request form shows request states without granting decision controls", async () => {
  const { QualityRequestForm } =
    await import("../src/components/quality/quality-request-form.tsx");
  const request = {
    status: "pending",
    requested_at: "2026-09-17T12:00:00Z",
    decided_at: null,
  };
  const empty = renderToStaticMarkup(createElement(QualityRequestForm));
  assert.match(empty, /Verifizierung anfragen/);
  assert.match(empty, /Voraussetzungen und Unterlagen/);
  const pending = renderToStaticMarkup(
    createElement(QualityRequestForm, { request }),
  );
  assert.match(pending, /Verifizierung angefragt/);
  assert.match(pending, /2026/);
  assert.doesNotMatch(pending, /<button/);
  const rejected = renderToStaticMarkup(
    createElement(QualityRequestForm, {
      request: { ...request, status: "rejected" },
    }),
  );
  assert.match(rejected, /Verifizierung derzeit nicht bestätigt/);
  assert.match(rejected, /Erneut anfragen/);
  const verified = renderToStaticMarkup(
    createElement(QualityRequestForm, {
      request,
      review: {
        status: "verified",
        verified_at: request.requested_at,
        public_note: null,
      },
    }),
  );
  assert.match(verified, /Persönlich verifiziert/);
  assert.doesNotMatch(verified, /<button|Verifizierung angefragt/);
  for (const html of [empty, pending, rejected, verified])
    assert.doesNotMatch(
      html,
      /name="profile_id"|value="verify"|Anfrage ablehnen/,
    );
});

test("portal home follows the editorial section order and keeps travel clearly marked as demo", async () => {
  const { default: Home } = await import("../src/app/(energieheld)/page.tsx");
  const html = renderToStaticMarkup(createElement(Home));
  const ordered = [
    "portal-intro",
    'data-placement="top_banner"',
    'id="gewerke"',
    'id="aktuelles"',
    'id="empfehlungen"',
    'id="so-funktionierts"',
    'class="provider-cta"',
  ];
  let last = -1;
  for (const marker of ordered) {
    const current = html.indexOf(marker);
    assert.ok(current > last, `${marker} must follow the previous section`);
    last = current;
  }
  assert.equal((html.match(/class="topic-world"/g) ?? []).length, 8);
  assert.match(html, /Reise-Inspiration · Demo/);
  assert.match(html, /aria-label="Expertensuche"/);
  assert.match(html, /Sie möchten Ihr Unternehmen präsentieren/);
  assert.doesNotMatch(html, /Gutes Handwerk verdient/);
});

test("profile contact and location precede description; no invented precise map or demo directions", () => {
  const listing = companyProfileListing(profile, { images: [] });
  const render = (data) =>
    renderToStaticMarkup(
      createElement(ListingDetail, {
        listing: data,
        categories: energieheld.categories,
        presentation: "company",
      }),
    );
  const real = render({
    ...listing,
    location: {
      city: "München",
      postalCode: "80331",
      region: "Bayern",
      country: "Deutschland",
    },
  });
  assert.ok(
    real.indexOf('class="contact-card"') <
      real.indexOf('class="location-module"'),
  );
  assert.ok(
    real.indexOf('class="location-module"') < real.indexOf("Über Bauwerk"),
  );
  assert.match(real, /google.com\/maps\/search/);
  assert.match(
    real,
    /keine genaue Kartenposition|genaue Kartenposition ist hier nicht hinterlegt/,
  );
  assert.doesNotMatch(real, /<iframe/);
  const demo = render({ ...listing, isDemo: true });
  assert.doesNotMatch(demo, /google.com\/maps/);
  const empty = render({
    ...listing,
    location: { city: "", postalCode: "", region: "", country: "" },
  });
  assert.match(empty, /Standort noch nicht angegeben/);
  assert.doesNotMatch(empty, /google.com\/maps/);
});
