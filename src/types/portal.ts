export type Category = { id: string; name: string; icon: string };
export type Location = {
  city: string;
  postalCode: string;
  region: string;
  country: string;
};
export type PortalImage = { src: string; alt: string };

export type Listing = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  tagline: string;
  description: string;
  categoryIds: string[];
  location: Location;
  services: string[];
  images: PortalImage[];
  contact: { email: string; phone: string; website: string };
  isDemo: boolean;
};

// A separate presentation object, never an implicit property of a normal listing.
export type QualityBadge = { listingId: string; label: string; isDemo: true };

export type BrandConfig = {
  id: "energieheld" | "reiseportal";
  name: string;
  tagline: string;
  colors: { primary: string; accent: string; surface: string };
  providerLabel: string;
  searchLabel: string;
  cta: { label: string; href: string };
  navigation: { label: string; href: string }[];
  categories: Category[];
};

// Descriptive UI data only. Campaign selection, scheduling and billing come later.
export type AdPlacement =
  | "trade_top"
  | "trade_sidebar_1"
  | "trade_sidebar_2"
  | "trade_sidebar_3"
  | "destination_top"
  | "destination_sidebar_1"
  | "destination_sidebar_2"
  | "destination_sidebar_3";
export type AdCreative = {
  tone?: "blue" | "orange" | "green";
  id: string;
  placement: AdPlacement;
  advertiser: string;
  title: string;
  text: string;
  image: PortalImage;
  targetUrl: string;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  locations: string[];
  categoryIds: string[];
  priority: number;
  isDemo: true;
};
