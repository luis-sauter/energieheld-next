import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { loadEditorialQueue } from "./editorial-queue";
import { editorialFeatures } from '@/config/editorial-features';
// Request-local only: layout and dashboard share one query, never another user's cache.
export const getEditorialQueue = cache(async () => loadEditorialQueue(await createClient(), { personalVerification: editorialFeatures.personalVerification }));
