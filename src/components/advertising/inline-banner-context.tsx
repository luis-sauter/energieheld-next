"use client";

import { createContext, useContext } from "react";
import type { AdPlacementId, ActiveAd } from "@/lib/ad-values";
import type { InlineBanner } from "@/lib/inline-ad-context";

export const InlineBannerContext = createContext<{
  overrides: Partial<Record<AdPlacementId, ActiveAd | null>>;
  open: (placement: AdPlacementId, campaignId?: string) => void;
  hasBanner?: (placement: AdPlacementId) => boolean;
  bannerAt?: (placement: AdPlacementId) => InlineBanner | undefined;
  canMove?: (placement: AdPlacementId) => boolean;
  reordered?: () => void;
} | null>(null);

export const useInlineBanners = () => useContext(InlineBannerContext);
