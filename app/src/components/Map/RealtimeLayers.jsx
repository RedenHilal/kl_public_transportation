import { Source, Layer } from 'react-map-gl/maplibre';
import { useAnimatedRealtime } from '../../hooks/useAnimatedRealtime';

// Realtime markers: big when zoomed out (where stop dots are hidden) and shrink as
// you zoom in, converging to roughly a stop dot's size at the closest zoom.
const ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 1.1, 18, 0.85];

// One symbol layer per agency. Agencies that report a heading draw a rotated
// colored ARROW; KTMB (no bearing data) draws a non-directional colored rounded
// CHIP instead. Icon images (arrow_<hex> / chip_<hex>) are generated per route
// color on demand in App's styleimagemissing handler.
const AGENCIES = [
  { agencyId: 'realtime-ktmb', name: 'ktmb', directional: false },
  { agencyId: 'realtime-rapid-bus', name: 'rapid-bus', directional: true },
  { agencyId: 'realtime-mrt-feeder', name: 'rapid-mrt', directional: true },
];

const labelPaint = {
  'text-color': '#333333',
  'text-halo-color': '#ffffff',
  'text-halo-width': 1.5,
};

export function RealtimeLayers({ visibility, data, getParts }) {
  // Smoothly interpolate positions between updates (only this subtree re-renders).
  const fc = useAnimatedRealtime(data, getParts);

  return (
    <Source id="realtime" type="geojson" data={fc}>
      {AGENCIES.map(({ agencyId, name, directional }) => (
        <Layer
          key={agencyId}
          id={agencyId}
          type="symbol"
          filter={['==', ['get', 'agency_name'], name]}
          layout={{
            visibility: visibility[agencyId] ? 'visible' : 'none',
            'icon-image': directional ? ['get', 'arrowIcon'] : ['get', 'chipIcon'],
            'icon-rotate': directional ? ['get', 'dirBearing'] : 0,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ICON_SIZE,
          }}
        />
      ))}
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
