"use client";
import type { ComponentProps } from 'react';
import type { InlineBannerOptions } from '@/lib/inline-ad-context';
import { InlineBannerProvider } from './inline-banner-editor';
import { CampaignSlot } from './campaign-view';

export function ContextualCampaignSlot({ editorOptions, ...props }: ComponentProps<typeof CampaignSlot> & {
  editorOptions?: Record<string, InlineBannerOptions>;
}) {
  const options = props.ad && editorOptions?.[props.ad.id];
  const banner = options?.banners.find(item => item.id === props.ad?.id);
  // Each appearance owns its preview overrides. Editing a footer or borrowed
  // banner must not replace another banner with the same placement name.
  return options && banner ? <InlineBannerProvider options={options}>
    <CampaignSlot {...props} placement={banner.placement} searchResult={false} />
  </InlineBannerProvider> : <CampaignSlot {...props} />;
}
