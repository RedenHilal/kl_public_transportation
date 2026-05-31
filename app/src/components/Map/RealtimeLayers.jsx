import { Source, Layer } from 'react-map-gl/maplibre';

const EMPTY = { type: 'FeatureCollection', features: [] };

// Renders the live vehicle fleet as a SINGLE GeoJSON source (not vector tiles).
// One fetch of the whole fleet (~120 small points) means every vehicle is drawn
// from the same snapshot at every zoom level — no per-zoom tile generations, no
// tile-boundary flicker, and no double-buffer needed. The `data` FeatureCollection
// is supplied by the parent (useRealtime hook).
export function RealtimeLayers({ visibility, data }) {
  const fc = data && data.features ? data : EMPTY;
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
    <Source id="realtime" type="geojson" data={fc}>
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
