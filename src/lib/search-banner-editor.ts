import { adPlacements } from './ad-values';
import { inlineAdContext, type InlineBannerOptions } from './inline-ad-context';

export type SearchBannerRequest = { path: string; id: string; placement: string };
export async function selectSearchBannerEditor(request: SearchBannerRequest, load: (path: string) => Promise<InlineBannerOptions | undefined>) {
  if (typeof request?.path !== 'string' || !inlineAdContext(request.path, true) || typeof request.id !== 'string' ||
      request.id.length > 160 || typeof request.placement !== 'string' || !Object.hasOwn(adPlacements, request.placement))
    return { error: 'Dieses Banner kann gerade nicht geöffnet werden.' };
  // The existing loader rechecks portal_admins and current page-specific sources.
  const options = await load(request.path);
  if (!options || options.error) return { error: options?.error ?? 'Keine Berechtigung oder Banner nicht mehr verfügbar.' };
  const banner = options.banners.find(row => row.id === request.id && row.placement === request.placement);
  return banner ? { options, banner } : { error: 'Dieses Banner ist an seinem ursprünglichen Platz nicht mehr verfügbar. Bitte laden Sie die Seite neu.' };
}
