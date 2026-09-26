import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import type { BrandConfig } from "@/types/portal";

export type HeaderNavigationItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export function headerNavigation(brand: BrandConfig): HeaderNavigationItem[] {
  return brand.navigation.map((item) => {
    if (item.href === "/mottoreisen") return {
      ...item,
      children: travelThemes.map(({ title, slug }) => ({ label: title, href: `/mottoreisen/${slug}` })),
    };
    if (item.href === "/reiseziele") return {
      ...item,
      children: destinations.map(({ title, slug }) => ({ label: title, href: `/reiseziele/${slug}` })),
    };
    return item;
  });
}
