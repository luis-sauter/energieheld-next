export type BreadcrumbItem = { name: string; path: string };
export function portalBreadcrumbs(name: string, path: string, parent?: BreadcrumbItem): BreadcrumbItem[] {
  return [{ name: "Startseite", path: "/" }, ...(parent ? [parent] : []), { name, path }];
}
