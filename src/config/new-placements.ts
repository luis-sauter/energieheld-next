// Explicit editorial selection approved on 2 November 2026.
// Import dates and ordinary edits never reset this two-week presentation.
export const newPlacementStarts: Readonly<Record<string,string>> = {
  '6e3b9664-f503-413a-9349-a31379881a8a': '2026-11-02T00:00:00+01:00', // Excelsior Dolomites Life Resort
  '0c8598b3-a2d2-45ad-bcbb-e19c4ee80e84': '2026-11-02T00:00:00+01:00', // JOAS guesthouse
  'd77ca77b-af21-47af-a6b1-79e2f8d4f6f8': '2026-11-02T00:00:00+01:00', // Suvretta House
  'a6249a1b-7890-45f9-9765-1c937144c114': '2026-11-02T00:00:00+01:00', // The Cambrian
  '9a1a97da-2aad-439c-973d-8416ef4b4345': '2026-11-02T00:00:00+01:00', // Hotel Schneider
  '97578023-61cb-43f8-b650-676f3baa7777': '2026-11-02T00:00:00+01:00', // Hotel Steiner
  '6b6ffc6e-cceb-49a2-8e4f-ea6aa975b6df': '2026-11-02T00:00:00+01:00', // DAS GRASECK
  '4a740b14-2efb-44de-a472-f4f135d01cf0': '2026-11-02T00:00:00+01:00', // Hotel Franks
  '1053f4b5-9c23-4ade-850d-214edebc9d4c': '2026-11-02T00:00:00+01:00', // PACHMAIR 1453 apart resort
  '790d18be-6ba8-4849-bdbb-fc3cc3489905': '2026-11-02T00:00:00+01:00', // Mountain Resort Feuerberg
  '7cbcbcf2-0df8-49db-b5e3-6c832234ea02': '2026-11-02T00:00:00+01:00', // Swiss Alpine Hotel Allalin
  '774d0a87-db37-4d89-ab68-1f5c6b3c1580': '2026-11-02T00:00:00+01:00', // Solbadhotel Sigriswil
  'fd8f5c9c-dcc7-4f8e-831d-c389a010608e': '2026-11-02T00:00:00+01:00', // DAS LUDWIG Sports Resort
  '1b457835-2067-418c-a1b9-8d0608638790': '2026-11-02T00:00:00+01:00', // Golfpark Strelasund
  '97e8cd41-abb6-4ba2-951f-fa0849ec2987': '2026-11-02T00:00:00+01:00', // Hotel Heiden
};
export function isNewPlacement(start:string|undefined,now=Date.now()) {
 const timestamp=start?Date.parse(start):NaN;
 return Number.isFinite(timestamp)&&now>=timestamp&&now-timestamp<14*24*60*60*1000;
}

// Selected existing creatives share their accommodation's original expiry.
export const newBannerProfiles: Readonly<Record<string,string>> = {
  '8011b97d-e715-4b6c-be3b-67c0cb075340': '0c8598b3-a2d2-45ad-bcbb-e19c4ee80e84', // JOAS guesthouse
  'fc467656-d75a-4d3d-b31d-a49dc6c6a2c5': '0c8598b3-a2d2-45ad-bcbb-e19c4ee80e84', // JOAS Skiurlaub
  'cf66f12b-6f5e-4bf1-8ba7-711f34be0bf2': '9a1a97da-2aad-439c-973d-8416ef4b4345', // Hotel Schneider
  '8f12cf33-2bb6-4946-81b4-4815b98dbf16': '97e8cd41-abb6-4ba2-951f-fa0849ec2987', // Hotel Heiden
};
export function isNewBannerPlacement(id:string,now=Date.now()) {
  return isNewPlacement(newPlacementStarts[newBannerProfiles[id] ?? ''],now);
}
