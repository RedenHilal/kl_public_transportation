import { useState, useEffect, useCallback, useRef } from 'react';
import { decodeVehiclePositions } from '../utils/gtfsrt';

const POLL_INTERVAL = 30000;
const API_URL = 'https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl';
const MIN_POLL = 15000;

export default function useRealtimeBuses(enabled) {
  const [data, setData] = useState({ type: 'FeatureCollection', features: [] });
  const [status, setStatus] = useState('idle');
  const [busCount, setBusCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const timerRef = useRef(null);
  const lastFetchRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_POLL) return;
    lastFetchRef.current = now;

    try {
      setStatus('loading');
      const resp = await fetch(API_URL);
      if (resp.status === 429) {
        console.warn('[GTFS-RT] Rate limited, will retry');
        setStatus('offline');
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buffer = await resp.arrayBuffer();
      const geojson = decodeVehiclePositions(buffer);
      console.log(`[GTFS-RT] ${geojson.features.length} buses at ${new Date().toLocaleTimeString()}`);
      setData(geojson);
      setBusCount(geojson.features.length);
      setStatus(geojson.features.length === 0 ? 'empty' : 'online');
      setLastUpdate(new Date());
    } catch (err) {
      console.warn('[GTFS-RT] fetch failed:', err.message);
      setStatus('offline');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      clearInterval(timerRef.current);
      return;
    }

    const initTimer = setTimeout(fetchData, 0);
    timerRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => {
      clearTimeout(initTimer);
      clearInterval(timerRef.current);
    };
  }, [enabled, fetchData]);

  if (!enabled) {
    return { data: { type: 'FeatureCollection', features: [] }, status: 'idle', busCount: 0, lastUpdate: null, refetch: fetchData };
  }

  return { data, status, busCount, lastUpdate, refetch: fetchData };
}
