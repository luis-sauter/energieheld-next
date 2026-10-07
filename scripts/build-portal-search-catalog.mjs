import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Derived at build time from the actual public JSX, never maintained separately.
// Only allowlisted public editorial components: no auth/admin/owner copy.
const sources = [
  ['/', 'Startseite', ['src/app/(energieheld)/page.tsx', 'src/components/portal/travel-finder.tsx']],
  ['/unterkuenfte-a-z', 'Unterkünfte A–Z', ['src/components/portal/travel-directory.tsx', 'src/components/portal/travel-finder.tsx']],
  ['/mottoreisen', 'Mottoreisen', ['src/app/(energieheld)/mottoreisen/page.tsx']],
  ['/reiseziele', 'Reiseziele', ['src/app/(energieheld)/reiseziele/page.tsx']],
  ['/werbung', 'Werbung auf DAS Reiseportal', ['src/app/(energieheld)/werbung/page.tsx']],
  ['/fuer-unternehmen', 'Für Unternehmen', ['src/app/(energieheld)/fuer-unternehmen/page.tsx']],
  ['/login', 'Einloggen', ['src/app/(energieheld)/login/page.tsx', 'src/components/auth/auth-form.tsx']],
  ['/registrieren', 'Firma registrieren', ['src/app/(energieheld)/registrieren/page.tsx', 'src/components/auth/auth-form.tsx']],
];
const root = new URL('../', import.meta.url);
export function publicJsxCopy(source) {
  const file = ts.createSourceFile('public.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const texts = [];
  function visit(node) {
    if (ts.isJsxText(node)) texts.push(node.text);
    // Visible literal values (e.g. intro props), not metadata/IDs/CSS/asset paths.
    if (ts.isJsxAttribute(node) && ['title', 'intro', 'label', 'description'].includes(node.name.getText(file)) && node.initializer && ts.isStringLiteral(node.initializer)) texts.push(node.initializer.text);
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) texts.push(node.expression.text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...new Set(texts.map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean))].join(' ');
}
export async function buildCatalog() {
  const pages = await Promise.all(sources.map(async ([url, title, files]) => ({
    url, title, body: (await Promise.all(files.map(async file => publicJsxCopy(await readFile(new URL(file, root), 'utf8'))))).join(' '),
  })));
  const directory = new URL('src/data/generated/', root);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('public-search-pages.json', directory), `${JSON.stringify(pages, null, 2)}\n`);
  return pages;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildCatalog();
