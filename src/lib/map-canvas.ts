import { MAP_HEIGHT, MAP_WIDTH, projectLocation, type MapLocation, type MapView } from './europe-map';

// Project once when the public dataset changes, never once per pin per drag.
export function projectMapPoints(locations: MapLocation[]): Float64Array {
  const points = new Float64Array(locations.length * 2);
  locations.forEach((location, index) => {
    const point = projectLocation(location.lat, location.lon);
    points[index * 2] = point[0]; points[index * 2 + 1] = point[1];
  });
  return points;
}

export function canvasMapLayout(view: MapView, width: number, height: number) {
  // Exactly the SVG's xMidYMid slice transform, including the taller mobile map.
  const scale = Math.max(width / view.width, height / view.height);
  return { scale, left: (width - view.width * scale) / 2 - view.x * scale,
    top: (height - view.height * scale) / 2 - view.y * scale,
    pinUnit: Math.max(width / MAP_WIDTH, height / MAP_HEIGHT) };
}

export function paintMapPins(context: CanvasRenderingContext2D, sprite: CanvasImageSource,
  points: Float64Array, view: MapView, width: number, height: number) {
  const { scale, left, top, pinUnit } = canvasMapLayout(view, width, height);
  let painted = 0;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] * scale + left, y = points[i + 1] * scale + top;
    // Skip only offscreen drawing; all coordinates remain in the dataset.
    if (x < -8 * pinUnit || x > width + 8 * pinUnit || y < -pinUnit || y > height + 21 * pinUnit) continue;
    context.drawImage(sprite, x - 8 * pinUnit, y - 21 * pinUnit, 16 * pinUnit, 22 * pinUnit);
    painted++;
  }
  return painted;
}

export function decodeBasicMapPoints(data: unknown): MapLocation[] {
  if (!data || typeof data !== 'object') throw Error('Invalid map response');
  const { points, total } = data as { points?: unknown; total?: unknown };
  if (!Array.isArray(points) || !Number.isSafeInteger(total) || total !== points.length || points.length > 200000)
    throw Error('Incomplete map response');
  return points.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(n => typeof n === 'number' && Number.isFinite(n)) ||
      point[0] < 34 || point[0] > 72 || point[1] < -25 || point[1] > 45) throw Error('Invalid map coordinate');
    // Rendering-only IDs. The endpoint already checked the real public IDs and
    // address fingerprints; contact/CRM data does not cross this boundary.
    return { id: `basic-map-${index}`, lat: point[0], lon: point[1] };
  });
}
