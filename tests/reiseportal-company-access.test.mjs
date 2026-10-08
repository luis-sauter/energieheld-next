import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    const virtual = {
      "next/link": 'export default "a"',
      "next/image": 'export default "img"',
      "next/navigation": 'export function redirect(path){throw Error("REDIRECT:"+path)}',
    };
    if (specifier.endsWith('/portal-account-server')) return {url:'data:text/javascript,export async function getPortalAccount(){globalThis.__companyAccessClientCalls++;const access=globalThis.__companyAccessRole;return {access,hasCompany:access==="forbidden",user:access==="unauthenticated"?null:{email:"test@example.org",user_metadata:{full_name:"Louis Sauter"}}}}',shortCircuit:true};
    if (specifier.endsWith('/editorial-queue-server')) return {url:'data:text/javascript,export async function getEditorialQueue(){return {counts:{profiles:0,advertising:0,verifications:0,total:0},tasks:[]}}',shortCircuit:true};
    if (virtual[specifier]) return { url: `data:text/javascript,${virtual[specifier]}`, shortCircuit: true };
    if (specifier.endsWith(".css")) return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    if (specifier.endsWith("/supabase/server")) return {
      url: 'data:text/javascript,export async function createClient(){globalThis.__companyAccessClientCalls++;return {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{message:"Bitte Adresse ergänzen"},error:null})})})}),auth:{getUser:async()=>({data:{user:{id:"user",email:"louis@example.org",user_metadata:{full_name:"Louis Sauter"}}}})}}}', shortCircuit: true,
    };
    if (specifier.endsWith("/auth-actions")) return { url: 'data:text/javascript,export async function logout(){return {}}', shortCircuit: true };
    if (specifier.endsWith("/admin-review")) return {
      url: 'data:text/javascript,export async function checkAdmin(){return globalThis.__companyAccessRole}', shortCircuit: true,
    };
    if (specifier.endsWith("/company-dashboard")) return {
      url: 'data:text/javascript,export async function loadCompanyDashboard(){return globalThis.__companyDashboard}', shortCircuit: true,
    };
    if (specifier.endsWith("/dashboard-analytics")) return {
      url: 'data:text/javascript,export function analyticsPeriod(){return "30d"};export async function loadCompanyMetrics(){globalThis.__metricsCalls=(globalThis.__metricsCalls||0)+1;return {data:null,error:null}}', shortCircuit: true,
    };
    if (specifier.endsWith("/dashboard/metrics")) return {
      url: 'data:text/javascript,export function MetricCards(){return null};export function CompanyOverviewMetrics(){return null}', shortCircuit: true,
    };
    if (specifier.endsWith("/quality/quality-request-form")) return {
      url: 'data:text/javascript,export function QualityRequestForm(){return null}', shortCircuit: true,
    };
    if (specifier.endsWith("/auth/auth-form")) return {
      url: 'data:text/javascript,export function LogoutButton(){return "Logout"}', shortCircuit: true,
    };
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? new URL("../src/" + specifier.slice(2), import.meta.url)
        : new URL(specifier, context.parentURL);
      for (const ext of [".ts", ".tsx"])
        if (existsSync(new URL(base.href + ext))) return next(base.href + ext, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx")) return {
      format: "module", shortCircuit: true,
      source: transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});

const { default: Layout } = await import("../src/app/(energieheld)/layout.tsx");
const { default: CompanyPage } = await import("../src/app/(energieheld)/firma/page.tsx");

test("shared layout reads existing server auth and renders guest, company and admin links", async () => {
  for (const [role, expected] of [
    ["unauthenticated", ""],
    ["forbidden", "LS"],
    ["admin", "LS"],
  ]) {
    globalThis.__companyAccessRole = role;
    globalThis.__companyAccessClientCalls = 0;
    const html = renderToStaticMarkup(await Layout({ children: createElement("p", null, "Inhalt") }));
    assert.equal(globalThis.__companyAccessClientCalls, 1);
    const header = html.split("</header>")[0];
    assert.match(header, new RegExp(role === "admin" ? 'href="/admin"' : role === "forbidden" ? 'href="/firma"' : 'href="/fuer-unternehmen"'));
    assert.match(header, /aria-label="Kontomenü öffnen"/);
    assert.doesNotMatch(header, /href="\/login"/);
    if (expected) assert.match(header, new RegExp(`>${expected}<`));
  }
});

test("company dashboard keeps profile, designer, inquiry, ads, analytics and logout reachable", async () => {
  globalThis.__companyDashboard = {
    authenticated: true, email: "test@example.org", company: { legal_name: "Demo GmbH" },
    profile: { status: "approved", display_name: "Demo GmbH", city: "Berlin", company_quality_reviews: null, company_quality_requests: null },
  };
  const html = renderToStaticMarkup(await CompanyPage());
  for (const href of ["/firma/profil", "/firma/profil/gestalten", "/firma/anfragen", "/firma/werbung", "/firma/statistiken"])
    assert.match(html, new RegExp(`href="${href}`));
  assert.match(html, /Logout/);
  assert.doesNotMatch(html, /Energieheld|Öffentliche Gewerke/);
  globalThis.__companyDashboard = { authenticated: false };
  await assert.rejects(CompanyPage(), /REDIRECT:\/login/);
});

test("existing account and admin routes remain present", () => {
  for (const route of [
    "registrieren", "login", "firma", "firma/profil", "firma/profil/gestalten",
    "firma/anfragen", "firma/werbung", "firma/statistiken", "admin", "admin/werbung", "admin/firmen/[id]", "admin/firmen/[id]/vorschau",
  ]) assert.ok(existsSync(new URL(`../src/app/(energieheld)/${route}/page.tsx`, import.meta.url)), route);
});

test("onboarding precedes navigation and skips analytics for unpublished states; approved keeps metrics", async () => {
  for (const [status, title] of [["draft", "Ihr Profil vorbereiten"], ["pending", "Ihr Profil wird geprüft"], ["rejected", "Änderungen erforderlich"], ["approved", "Profil veröffentlicht"]]) {
    globalThis.__companyDashboard = { authenticated: true, profile: { status, slug: "real-profile", display_name: "Existing name" } };
    globalThis.__metricsCalls = 0;
    const html = renderToStaticMarkup(await CompanyPage({ searchParams: Promise.resolve({ willkommen: "1" }) }));
    assert.ok(html.indexOf(title) < html.indexOf('<nav'));
    assert.equal(globalThis.__metricsCalls, status === "approved" ? 1 : 0);
    if (status !== "approved") assert.doesNotMatch(html, /Leistungsüberblick/);
    else assert.match(html, /href="\/unterkuenfte\/real-profile"/);
    assert.match(html, /Angebotsanfragen/);
    assert.equal(html.includes("Bitte Adresse ergänzen"), status === "rejected");
  }
});
