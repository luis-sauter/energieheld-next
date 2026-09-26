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
    if (virtual[specifier]) return { url: `data:text/javascript,${virtual[specifier]}`, shortCircuit: true };
    if (specifier.endsWith(".css")) return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    if (specifier.endsWith("/supabase/server")) return {
      url: 'data:text/javascript,export async function createClient(){globalThis.__companyAccessClientCalls++;return {}}', shortCircuit: true,
    };
    if (specifier.endsWith("/admin-review")) return {
      url: 'data:text/javascript,export async function checkAdmin(){return globalThis.__companyAccessRole}', shortCircuit: true,
    };
    if (specifier.endsWith("/company-dashboard")) return {
      url: 'data:text/javascript,export async function loadCompanyDashboard(){return globalThis.__companyDashboard}', shortCircuit: true,
    };
    if (specifier.endsWith("/dashboard-analytics")) return {
      url: 'data:text/javascript,export function analyticsPeriod(){return "30d"};export async function loadCompanyMetrics(){return {data:null,error:null}}', shortCircuit: true,
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
  for (const [role, expected, hidden] of [
    ["unauthenticated", ["/registrieren", "/login"], ["/firma", "/admin"]],
    ["forbidden", ["/firma"], ["/login", "/admin"]],
    ["admin", ["/firma", "/admin"], ["/login"]],
  ]) {
    globalThis.__companyAccessRole = role;
    globalThis.__companyAccessClientCalls = 0;
    const html = renderToStaticMarkup(await Layout({ children: createElement("p", null, "Inhalt") }));
    assert.equal(globalThis.__companyAccessClientCalls, 1);
    for (const href of expected) assert.match(html, new RegExp(`href="${href}"`));
    for (const href of hidden) assert.doesNotMatch(html.split("</header>")[0], new RegExp(`href="${href}"`));
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
    "firma/anfragen", "firma/werbung", "firma/statistiken", "admin", "admin/werbung", "admin/firmen/[id]",
  ]) assert.ok(existsSync(new URL(`../src/app/(energieheld)/${route}/page.tsx`, import.meta.url)), route);
});
