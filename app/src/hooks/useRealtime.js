import { useState, useEffect, useRef } from 'react';
import { REALTIME_URL } from '../constants/config';

const EMPTY = { type: 'FeatureCollection', features: [] };

// Adds a heading to each vehicle. Every live vehicle is rendered as a directional
// arrow (never a plain dot — that's indistinguishable from a station marker), so
// `hasHeading` is always true. dirBearing prefers the current bearing, falls back
// to the vehicle's last-known non-zero heading, and finally to 0 (points up) when
// no heading was ever reported — e.g. KTMB, which broadcasts bearing 0 for every
// train. Runs in the fetch callback (not during render), so the ref access is safe.
function withHeadings(json, lastBearing) {
  if (!json || !json.features) return EMPTY;
  const features = json.features.map((f) => {
    const p = f.properties || {};
    const b = Number(p.bearing) || 0;
    if (b !== 0 && p.vehicle_id) lastBearing[p.vehicle_id] = b;
    const dirBearing = b !== 0 ? b : (lastBearing[p.vehicle_id] || 0);
    return { ...f, properties: { ...p, dirBearing, hasHeading: true } };
  });
  return { type: 'FeatureCollection', features };
}

// Fetches the whole live fleet (GeoJSON) plus per-feed status from the fetcher's
// /realtime.geojson endpoint. Refetched whenever `refreshKey` changes (the map
// ticks it every 15s). Returns the FeatureCollection for the map source and the
// `feeds` status array so the UI can flag empty/unavailable upstream feeds.
export function useRealtime(refreshKey) {
  const [data, setData] = useState(EMPTY);
  const [feeds, setFeeds] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | ok | error
  const [lastUpdate, setLastUpdate] = useState(null);
  const lastBearingRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    fetch(`${REALTIME_URL}?t=${refreshKey}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        if (cancelled) return;
        setData(withHeadings(json, lastBearingRef.current));
        setFeeds(Array.isArray(json?.feeds) ? json.feeds : []);
        setStatus('ok');
        setLastUpdate(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[realtime] fetch failed', err);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { data, feeds, status, lastUpdate };
}
