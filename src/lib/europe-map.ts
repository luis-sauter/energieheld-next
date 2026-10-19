export type MapLocation = { id: string; lat: number; lon: number; precision?: string };
export type MapView = { x: number; y: number; width: number; height: number };
export const MAP_WIDTH = 1400;
export const MAP_HEIGHT = 620;
export const FULL_MAP_VIEW: MapView = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };
// Exactly the previous default after one .8 Plus step, centered.
export const INITIAL_MAP_VIEW: MapView = { x: 140, y: 62, width: 1120, height: 496 };

export function pinTransform(location: MapLocation, view: MapView): string {
  const [x, y] = projectLocation(location.lat, location.lon);
  return `translate(${x} ${y}) scale(${view.width / MAP_WIDTH})`;
}

// Spherical Lambert conformal conic, standard parallels 43° / 62°,
// central meridian 10° E. The exact same transform builds the local SVG.
const radians = Math.PI / 180;
const p1 = 43 * radians, p2 = 62 * radians;
const n = Math.log(Math.cos(p1) / Math.cos(p2)) /
  Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
const f = Math.cos(p1) * Math.pow(Math.tan(Math.PI / 4 + p1 / 2), n) / n;
const rho0 = f / Math.pow(Math.tan(Math.PI / 4 + 49 * radians / 2), n);

export function projectLocation(lat: number, lon: number): [number, number] {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) >= 90 || Math.abs(lon) > 180)
    throw new RangeError("Invalid geographic coordinate");
  const rho = f / Math.pow(Math.tan(Math.PI / 4 + lat * radians / 2), n);
  const theta = n * (lon - 10) * radians;
  // Stable serialized SVG attributes across server/client math runtimes.
  const stable = (value: number) => Math.round(value * 1e6) / 1e6;
  return [stable(MAP_WIDTH / 2 + rho * Math.sin(theta) * 2050),
    stable(MAP_HEIGHT / 2 - (rho0 - rho * Math.cos(theta)) * 2050)];
}

export function clampMapView(view: MapView): MapView {
  const width = Math.max(MAP_WIDTH / 5, Math.min(MAP_WIDTH, view.width));
  const height = width * MAP_HEIGHT / MAP_WIDTH;
  return { x: Math.max(0, Math.min(MAP_WIDTH - width, view.x)),
    y: Math.max(0, Math.min(MAP_HEIGHT - height, view.y)), width, height };
}

export function zoomMap(view: MapView, factor: number, anchor = { x: .5, y: .5 }): MapView {
  const width = Math.max(MAP_WIDTH / 5, Math.min(MAP_WIDTH, view.width * factor));
  const height = width * MAP_HEIGHT / MAP_WIDTH;
  return clampMapView({ x: view.x + (view.width - width) * anchor.x,
    y: view.y + (view.height - height) * anchor.y, width, height });
}

export function publicMapLocations(locations: MapLocation[], publicIds: ReadonlySet<string>): MapLocation[] {
  const seen = new Set<string>();
  return locations.filter(location => {
    if (!publicIds.has(location.id) || seen.has(location.id) || !Number.isFinite(location.lat) ||
        !Number.isFinite(location.lon) || location.lat < 34 || location.lat > 72 || location.lon < -25 || location.lon > 45) return false;
    seen.add(location.id);
    return true;
  }).map(({ id, lat, lon, precision }) => ({ id, lat, lon, ...(precision === 'street' ? { precision } : {}) }));
}
