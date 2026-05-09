import { useState, useEffect, useCallback, useRef } from 'react';
import { decodeVehiclePositions } from '../utils/gtfsrt';

const POLL_INTERVAL = 30000;
const API_URL = 'https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl';

export default function useRealtimeBuses(enabled) {
  const [data, setData] = useState({ type: 'FeatureCollection', features: [] });
  const [status, setStatus] = useState('idle');
  const [busCount, setBusCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const timerRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    try {
      const resp = await fetch(API_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buffer = await resp.arrayBuffer();
      const geojson = decodeVehiclePositions(buffer);
      setData(geojson);
      setBusCount(geojson.features.length);
      setStatus('online');
      setLastUpdate(new Date());
    } catch {
      setStatus('offline');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setBusCount(0);
      setData({ type: 'FeatureCollection', features: [] });
      clearInterval(timerRef.current);
      return;
    }

    fetchData();
    timerRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [enabled, fetchData]);

  return { data, status, busCount, lastUpdate, refetch: fetchData };
}
