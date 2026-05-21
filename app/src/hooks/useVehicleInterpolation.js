import { useState, useEffect, useRef, useCallback } from 'react';

export function useVehicleInterpolation() {
  const [interpolatedVehicles, setInterpolatedVehicles] = useState({ type: 'FeatureCollection', features: [] });
  const vehiclesRef = useRef([]);

  useEffect(() => {
    let frame;
    const animate = () => {
      const now = Date.now() / 1000;
      const features = vehiclesRef.current.map(v => {
        const elapsed = now - v.fetch_time;
        const duration = 30; // Matches fetcher interval
        const t = Math.min(elapsed / duration, 1.2); 
        
        const lon = (v.last_lon || v.current_lon) + (v.current_lon - (v.last_lon || v.current_lon)) * t;
        const lat = (v.last_lat || v.current_lat) + (v.current_lat - (v.last_lat || v.current_lat)) * t;
        
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: { ...v, t }
        };
      });
      
      setInterpolatedVehicles({ type: 'FeatureCollection', features });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const updateVehicles = useCallback((data) => {
    vehiclesRef.current = data.map(f => ({
      ...f.properties,
      fetch_time: Date.now() / 1000
    }));
  }, []);

  return { interpolatedVehicles, updateVehicles };
}
