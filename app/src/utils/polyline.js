// Lightweight polyline math for animating live vehicles ALONG their route line
// (rather than straight-line between updates). Works in a local planar space:
// at Klang Valley scale, scaling longitude by cos(lat) makes equirectangular
// distances accurate enough for snapping/interpolating over short segments.
// No external dependency.

const LAT0 = 3.14; // ~KL; only used to scale lng so x/y are roughly isotropic
const KX = Math.cos((LAT0 * Math.PI) / 180);

const toXY = ([lng, lat]) => [lng * KX, lat];

// Parse a GeoJSON LineString/MultiLineString into "parts": each an array of
// [lng,lat] vertices with a parallel `cum` array of cumulative planar distances.
export function toParts(geojson) {
  if (!geojson) return null;
  const lines =
    geojson.type === 'MultiLineString' ? geojson.coordinates
    : geojson.type === 'LineString' ? [geojson.coordinates]
    : null;
  if (!lines) return null;
  const parts = lines
    .filter((coords) => coords && coords.length >= 2)
    .map((coords) => {
      const cum = [0];
      for (let i = 1; i < coords.length; i++) {
        const [ax, ay] = toXY(coords[i - 1]);
        const [bx, by] = toXY(coords[i]);
        cum[i] = cum[i - 1] + Math.hypot(bx - ax, by - ay);
      }
      return { coords, cum, length: cum[cum.length - 1] };
    });
  return parts.length ? parts : null;
}

// Nearest point on a single part to (lng,lat). Returns { dist, perp } where
// `dist` is the arc-length position along the part and `perp` is the planar
// perpendicular distance to the line.
function snapToPart(part, lng, lat) {
  const { coords, cum } = part;
  const [px, py] = toXY([lng, lat]);
  let best = { perp: Infinity, dist: 0 };
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = toXY(coords[i - 1]);
    const [bx, by] = toXY(coords[i]);
    const dx = bx - ax, dy = by - ay;
    const segLen2 = dx * dx + dy * dy || 1e-12;
    let t = ((px - ax) * dx + (py - ay) * dy) / segLen2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const perp = Math.hypot(px - cx, py - cy);
    if (perp < best.perp) {
      const segLen = Math.sqrt(segLen2);
      best = { perp, dist: cum[i - 1] + t * segLen };
    }
  }
  return best;
}

// Snap a point to the nearest part. Returns { partIndex, dist, perp } or null.
export function snap(parts, lng, lat) {
  if (!parts) return null;
  let best = null;
  for (let i = 0; i < parts.length; i++) {
    const s = snapToPart(parts[i], lng, lat);
    if (!best || s.perp < best.perp) best = { partIndex: i, dist: s.dist, perp: s.perp };
  }
  return best;
}

// Point at arc-length `dist` along a part, as [lng,lat].
export function pointAt(part, dist) {
  const { coords, cum, length } = part;
  const d = Math.max(0, Math.min(dist, length));
  // binary search for the segment containing d
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const segLen = cum[hi] - cum[lo] || 1e-12;
  const t = (d - cum[lo]) / segLen;
  const [ax, ay] = coords[lo];
  const [bx, by] = coords[hi];
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}
