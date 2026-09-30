"use client";

import { createContext, useContext } from "react";
import type { AdPlacementId, ActiveAd } from "@/lib/ad-values";

export const InlineBannerContext = createContext<{
  overrides: Partial<Record<AdPlacementId, ActiveAd | null>>;
  open: (placement: AdPlacementId, campaignId?: string) => void;
} | null>(null);

export const useInlineBanners = () => useContext(InlineBannerContext);
