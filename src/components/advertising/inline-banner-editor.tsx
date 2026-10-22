"use client";
import dynamic from 'next/dynamic.js';
import type { ReactNode } from 'react';
import type { InlineBannerOptions } from '@/lib/inline-ad-context';

// Public pages keep their server-rendered banners without downloading the
// admin's upload, media-library, crop and category-editing code.
const AdminProvider = dynamic(() => import('./inline-banner-editor-content').then(module => module.InlineBannerProvider));
export const InlineBannerDialog = dynamic(() => import('./inline-banner-editor-content').then(module => module.InlineBannerDialog));

export function InlineBannerProvider({ options, children }: { options?: InlineBannerOptions; children: ReactNode }) {
  return options ? <AdminProvider options={options}>{children}</AdminProvider> : children;
}
