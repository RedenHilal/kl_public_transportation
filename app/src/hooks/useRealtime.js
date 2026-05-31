import { useState, useEffect } from 'react';
import { REALTIME_URL } from '../constants/config';

const EMPTY = { type: 'FeatureCollection', features: [] };

// Fetches the whole live fleet (GeoJSON) plus per-feed status from the fetcher's
// /realtime.geojson endpoint. Refetched whenever `refreshKey` changes (the map
// ticks it every 15s). Returns the FeatureCollection for the map source and the
// `feeds` status array so the UI can flag empty/unavailable upstream feeds.
export function useRealtime(refreshKey) {
  const [data, setData] = useState(EMPTY);
  const [feeds, setFeeds] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | ok | error

  useEffect(() => {
    let cancelled = false;
    fetch(`${REALTIME_URL}?t=${refreshKey}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        if (cancelled) return;
        setData(json && json.features ? json : EMPTY);
        setFeeds(Array.isArray(json?.feeds) ? json.feeds : []);
        setStatus('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[realtime] fetch failed', err);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { data, feeds, status };
}
