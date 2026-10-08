import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { loadEditorialQueue } from "./editorial-queue";
// Request-local only: layout and dashboard share one query, never another user's cache.
export const getEditorialQueue = cache(async () => loadEditorialQueue(await createClient()));
