import { Source, Layer } from 'react-map-gl/maplibre';
import { useState, useEffect } from 'react';
import { REALTIME_URL } from '../../constants/config';

const EMPTY = { type: 'FeatureCollection', features: [] };

// Renders the live vehicle fleet as a SINGLE GeoJSON source (not vector tiles).
// One fetch of the whole fleet (~120 small points) means every vehicle is drawn
// from the same snapshot at every zoom level — no per-zoom tile generations, no
// tile-boundary flicker, and no double-buffer needed. Refetched whenever
// `refreshKey` changes (the parent ticks it every 15s).
export function RealtimeLayers({ visibility, refreshKey }) {
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    let cancelled = false;
    fetch(`${REALTIME_URL}?t=${refreshKey}`)
      .then((res) => (res.ok ? res.json() : EMPTY))
      .then((geojson) => { if (!cancelled) setData(geojson && geojson.features ? geojson : EMPTY); })
      .catch((err) => { console.warn('[realtime] fetch failed', err); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const vis = (agencyId) => ({ visibility: visibility[agencyId] ? 'visible' : 'none' });

  const ktmbPaint = {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 9],
    'circle-color': '#1964B7',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.9
  };
  const busPaint = {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 8],
    'circle-color': '#0078D4',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.9
  };
  const mrtPaint = {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 8],
    'circle-color': '#FFCD00',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#333333',
    'circle-opacity': 0.9
  };
  const labelPaint = {
    'text-color': '#333333',
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.5,
  };

  return (
    <Source id="realtime" type="geojson" data={data}>
      <Layer
        id="realtime-ktmb"
        type="circle"
        filter={['==', ['get', 'agency_name'], 'ktmb']}
        layout={vis('realtime-ktmb')}
        paint={ktmbPaint}
      />
      <Layer
        id="realtime-rapid-bus"
        type="circle"
        filter={['==', ['get', 'agency_name'], 'rapid-bus']}
        layout={vis('realtime-rapid-bus')}
        paint={busPaint}
      />
      <Layer
        id="realtime-mrt-feeder"
        type="circle"
        filter={['==', ['get', 'agency_name'], 'rapid-mrt']}
        layout={vis('realtime-mrt-feeder')}
        paint={mrtPaint}
      />
      <Layer
        id="rt-labels"
        type="symbol"
        minzoom={14}
        layout={{
          'text-field': ['concat', ['get', 'vehicle_label'], '\n', ['coalesce', ['get', 'next_stop_name'], '']],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
        }}
        paint={labelPaint}
      />
    </Source>
  );
}
