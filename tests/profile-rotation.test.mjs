import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { selectRotatingProfiles, profileGroups, nextProfileGroup, rotationCanPlay, scheduleProfileAdvance } from "../src/lib/profile-rotation.ts";

const profiles = (count, directoryPackage = "basic") => Array.from({ length: count }, (_, index) => ({ id: `${directoryPackage}-${index}`, directoryPackage }));
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith(".module.css")) return { url: 'data:text/javascript,export default {rotation:"rotation",page:"page",pages:"pages"}', shortCircuit: true };
    if (specifier === "@/lib/profile-rotation") return next(new URL("../src/lib/profile-rotation.ts", import.meta.url).href, context);
    if (specifier === "./use-rotation-motion") return next(new URL("../src/components/portal/use-rotation-motion.ts", import.meta.url).href, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX },
    }).outputText };
    return next(url, context);
  },
});
const { ProfileRotation } = await import("../src/components/portal/profile-rotation.tsx");

test("one to six profiles have one group, no placeholders or needless controls", () => {
  assert.deepEqual(profileGroups([]), []);
  for (let count = 1; count <= 6; count++) {
    const groups = profileGroups(profiles(count));
    assert.deepEqual(groups.map((group) => group.length), [count]);
    const html = renderToStaticMarkup(createElement(ProfileRotation, { count, groups: [createElement("p", {}, "real profiles")] }));
    assert.doesNotMatch(html, /<button|tabindex|hidden=""/);
  }
});

test("7 and 12 profiles use six-sized groups without duplicates and wrap both ways", () => {
  for (const count of [7, 12]) {
    const selected = selectRotatingProfiles(profiles(count), "wandern", 1234);
    const groups = profileGroups(selected);
    assert.deepEqual(groups.map((group) => group.length), count === 7 ? [6, 1] : [6, 6]);
    for (const group of groups) assert.equal(new Set(group.map((profile) => profile.id)).size, group.length);
    assert.equal(nextProfileGroup(0, 1, groups.length), 1);
    assert.equal(nextProfileGroup(1, 1, groups.length), 0);
    assert.equal(nextProfileGroup(0, -1, groups.length), 1);
  }
});

test("maximum 30 considers a fair reproducible daily window, keeping Premium ahead of Basic", () => {
  const input = [...profiles(20), ...profiles(15, "premium")];
  const before = structuredClone(input);
  const selected = selectRotatingProfiles(input, "nature", 20000);
  assert.equal(selected.length, 30);
  assert.ok(selected.slice(0, 15).every((item) => item.directoryPackage === "premium"));
  assert.ok(selected.slice(15).every((item) => item.directoryPackage === "basic"));
  assert.deepEqual(selected, selectRotatingProfiles(input, "nature", 20000));
  assert.notDeepEqual(selected, selectRotatingProfiles(input, "nature", 20001));
  assert.deepEqual(input, before);
  const visited = new Set(Array.from({ length: 35 }, (_, day) => selectRotatingProfiles(profiles(35, "premium"), "nature", day)).flat().map((item) => item.id));
  assert.equal(visited.size, 35);
  assert.equal(selectRotatingProfiles([input[0], ...input], "nature", 0).length, 30);
});

test("priority is preserved even when Premium alone fills the 30-profile cap", () => {
  assert.ok(selectRotatingProfiles([...profiles(5), ...profiles(40, "premium")], "wellness", 5).every((item) => item.directoryPackage === "premium"));
});

test("autoplay waits six seconds, cancellation and restarting reset the full delay", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let advances = 0;
  let cancel = scheduleProfileAdvance(() => advances++);
  context.mock.timers.tick(5999);
  assert.equal(advances, 0);
  context.mock.timers.tick(1);
  assert.equal(advances, 1);
  cancel = scheduleProfileAdvance(() => advances++);
  context.mock.timers.tick(3000); cancel();
  cancel = scheduleProfileAdvance(() => advances++);
  context.mock.timers.tick(5999);
  assert.equal(advances, 1);
  context.mock.timers.tick(1);
  assert.equal(advances, 2); cancel();
});

test("motion, focus, hover, touch, visibility and explicit pause all stop autoplay", () => {
  assert.equal(rotationCanPlay(1), false);
  assert.equal(rotationCanPlay(5, false, false, false), true);
  for (let flag = 0; flag < 7; flag++) {
    const paused = Array(7).fill(false); paused[flag] = true;
    assert.equal(rotationCanPlay(5, ...paused), false);
  }
});

test("server HTML retains actual card links, only one group is exposed to keyboard and accessibility", () => {
  const groups = Array.from({ length: 5 }, (_, group) => createElement("div", {}, ...Array.from({ length: 6 }, (_, index) =>
    createElement("a", { href: `/unterkuenfte/${group * 6 + index}`, key: index }, `Profile ${group * 6 + index}`))));
  const html = renderToStaticMarkup(createElement(ProfileRotation, { count: 30, groups }));
  assert.equal((html.match(/href="\/unterkuenfte\//g) ?? []).length, 30);
  assert.equal((html.match(/hidden="" inert=""/g) ?? []).length, 4);
  assert.match(html, /Vorherige sechs Unterkünfte/);
  assert.match(html, /Nächste sechs Unterkünfte/);
  assert.match(html, /Gruppe 1 von 5/);
  assert.match(html, /disabled="" title="Bei reduzierter Bewegung/);
  assert.match(html, /Automatischen Wechsel pausieren/);
});

test("cards stay server components and existing lazy images; interaction makes no new data requests", () => {
  const detail = source("src/components/portal/discovery-detail.tsx");
  const client = source("src/components/portal/profile-rotation.tsx");
  const css = source("src/components/portal/profile-rotation.module.css");
  assert.doesNotMatch(detail, /use client/);
  assert.match(detail, /loading="lazy"/);
  assert.match(detail, /profileGroups\(selected\)/);
  assert.doesNotMatch(client, /fetch\(|supabase|AccommodationCard|Math\.random/);
  assert.match(client, /ArrowRight/);
  assert.match(client, /ArrowLeft/);
  assert.match(source("src/components/portal/use-rotation-motion.ts"), /prefers-reduced-motion/);
  assert.match(css, /\.page\[hidden\] \{ display: none/);
  assert.match(css, /min-height: calc/);
  assert.match(css, /max-width: 700px/);
  assert.match(css, /focus-visible/);
});
