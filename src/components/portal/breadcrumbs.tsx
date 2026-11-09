import { Icon } from "@/components/portal/icon";
import Link from "./navigation-link";
import type { BreadcrumbItem } from "@/lib/breadcrumbs";

export function Breadcrumbs({ items, className = "breadcrumbs" }: { items: BreadcrumbItem[]; className?: string }) {
  return <nav className={className} aria-label="Brotkrumennavigation">
    {items.map((item, index) => <span key={item.path} className="breadcrumb-item">
      {index > 0 && <span aria-hidden="true" className="breadcrumb-separator"><Icon name="chevron-right" size={20} /></span>}
      {index === items.length - 1
        ? <span aria-current="page">{item.name}</span>
        : <Link href={item.path}>{item.name}</Link>}
    </span>)}
  </nav>;
}
