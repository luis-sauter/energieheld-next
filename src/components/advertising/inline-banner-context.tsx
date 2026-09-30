"use client";

import { createContext, useContext } from "react";
import type { AdPlacementId, ActiveAd } from "@/lib/ad-values";

export const InlineBannerContext = createContext<{
  overrides: Partial<Record<AdPlacementId, ActiveAd | null>>;
  open: (placement: AdPlacementId, campaignId?: string) => void;
  hasBanner?: (placement: AdPlacementId) => boolean;
} | null>(null);

export const useInlineBanners = () => useContext(InlineBannerContext);
