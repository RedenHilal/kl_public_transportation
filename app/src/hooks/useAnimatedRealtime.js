import { useState, useEffect, useRef } from 'react';
import { snap, pointAt } from '../utils/polyline';

const EMPTY = { type: 'FeatureCollection', features: [] };
const DURATION = 15000; // ms to glide from old position to the newly reported one
const SNAP_PERP = 0.0015; // ~165m: max distance a vehicle may be off its route line

const keyOf = (p) => `${p.agency_name}:${p.vehicle_id || p.id}`;

// Smoothly animates live vehicles between position updates so they appear to
// travel rather than jump/blink. When the vehicle's route geometry is available
// (via `getParts`) and both endpoints snap to the same line segment, it glides
// ALONG the route line (scalar progress); otherwise it falls back to a straight
// (linear) glide — which is also what KTMB and off-route vehicles use.
//
// Designed to be called INSIDE RealtimeLayers so only that subtree re-renders.
export function useAnimatedRealtime(target, getParts) {
  const [frame, setFrame] = useState(EMPTY);
  const statesRef = useRef(new Map());

  // New target data: set each vehicle's destination (only resets the glide when
  // the destination actually changed, so motion stays continuous across refreshes).
  useEffect(() => {
    const states = statesRef.current;
    const now = performance.now();
    const seen = new Set();
    for (const f of (target?.features || [])) {
      const p = f.properties || {};
      const id = keyOf(p);
      seen.add(id);
      const [lng, lat] = f.geometry.coordinates;
      const s = states.get(id);
      if (!s) {
        states.set(id, { curLng: lng, curLat: lat, fromLng: lng, fromLat: lat, toLng: lng, toLat: lat, start: now, props: p, path: null });
      } else if (s.toLng !== lng || s.toLat !== lat) {
        s.fromLng = s.curLng; s.fromLat = s.curLat;
        s.toLng = lng; s.toLat = lat; s.start = now; s.props = p;
        s.path = planPath(getParts, p, s.curLng, s.curLat, lng, lat);
      } else {
        s.props = p; // same destination — refresh props (color/heading/etc.)
      }
    }
    for (const id of [...states.keys()]) if (!seen.has(id)) states.delete(id);
  }, [target, getParts]);

  // Animation loop: advance toward destinations; stop emitting once everything settles.
  useEffect(() => {
    let raf;
    let settledEmitted = false;
    const tick = () => {
      const states = statesRef.current;
      const now = performance.now();
      let moving = false;
      const features = [];
      for (const s of states.values()) {
        const t = Math.min((now - s.start) / DURATION, 1);
        if (t < 1) moving = true;
        if (s.path) {
          const d = s.path.fromDist + (s.path.toDist - s.path.fromDist) * t;
          [s.curLng, s.curLat] = pointAt(s.path.part, d);
        } else {
          s.curLng = s.fromLng + (s.toLng - s.fromLng) * t;
          s.curLat = s.fromLat + (s.toLat - s.fromLat) * t;
        }
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.curLng, s.curLat] }, properties: s.props });
      }
      if (moving || !settledEmitted) {
        setFrame({ type: 'FeatureCollection', features });
        settledEmitted = !moving;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return frame;
}

// Returns { part, fromDist, toDist } if both endpoints snap to the same route
// segment within tolerance, else null (caller uses linear interpolation).
function planPath(getParts, props, fromLng, fromLat, toLng, toLat) {
  if (!getParts) return null;
  const parts = getParts(props.agency_name, props.route_short_name || props.route_id);
  if (!parts) return null;
  const a = snap(parts, fromLng, fromLat);
  const b = snap(parts, toLng, toLat);
  if (!a || !b || a.partIndex !== b.partIndex) return null;
  if (a.perp > SNAP_PERP || b.perp > SNAP_PERP) return null;
  return { part: parts[a.partIndex], fromDist: a.dist, toDist: b.dist };
}
