'use client';
import dynamic from 'next/dynamic.js';

// This boundary is rendered only after the server's existing admin check.
// Public profiles never need the media library or editorial editing bundle.
export const InlineProfileEditor = dynamic(() => import('./inline-profile-editor').then(module => module.InlineProfileEditor));
