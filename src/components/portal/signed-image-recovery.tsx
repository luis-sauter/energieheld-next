'use client';

import { useEffect } from 'react';
import { installSignedImageRecovery } from '@/lib/signed-image-recovery';

export function SignedImageRecovery() {
  useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (origin && key) return installSignedImageRecovery(document, new URL(origin).origin, key);
  }, []);
  return null;
}
