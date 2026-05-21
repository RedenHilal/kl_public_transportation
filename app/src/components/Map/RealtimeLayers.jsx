import { Source, Layer } from 'react-map-gl/maplibre';
import { useState, useEffect } from 'react';

export function RealtimeLayers({ visibility, refreshKey }) {
  // Use double buffering (Source A and Source B) to prevent flickering
  const [activeBuffer, setActiveBuffer] = useState('A');
  const [bufferUrls, setBufferUrls] = useState({
    A: `https://yuellen.my.id/martin/realtime_vehicles_with_stops/{z}/{x}/{y}?t=${Date.now()}`,
    B: `https://yuellen.my.id/martin/realtime_vehicles_with_stops/{z}/{x}/{y}?t=${Date.now()}`
  });

  useEffect(() => {
    // When refreshKey changes, update the HIDDEN buffer
    const nextBuffer = activeBuffer === 'A' ? 'B' : 'A';
    setBufferUrls(prev => ({
      ...prev,
      [nextBuffer]: `https://yuellen.my.id/martin/realtime_vehicles_with_stops/{z}/{x}/{y}?t=${refreshKey}`
    }));

    // Wait a short moment for the new tiles to start loading, then swap
    // In a perfect world, we'd listen for the 'data' event, but a small delay
    // is usually enough to ensure the transition is seamless.
    const timer = setTimeout(() => {
      setActiveBuffer(nextBuffer);
    }, 1500); // 1.5s delay to allow new tiles to fetch in background

    return () => clearTimeout(timer);
  }, [refreshKey]);

  // Shared Paint Properties
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

  // Helper to render a full set of layers for a buffer
  const renderBuffer = (id) => {
    const isVisible = activeBuffer === id;
    const commonLayout = (agencyId) => ({
      'visibility': (isVisible && visibility[agencyId]) ? 'visible' : 'none',
    });

    return (
      <Source 
        id={`realtime-${id}`} 
        type="vector" 
        tiles={[bufferUrls[id]]}
        minzoom={6}
        maxzoom={20}
      >
        <Layer
          id={`realtime-ktmb-${id}`}
          type="circle"
          source-layer="realtime_vehicles_with_stops"
          filter={['==', ['get', 'agency_name'], 'ktmb']}
          layout={commonLayout('realtime-ktmb')}
          paint={ktmbPaint}
        />
        <Layer
          id={`realtime-rapid-bus-${id}`}
          type="circle"
          source-layer="realtime_vehicles_with_stops"
          filter={['==', ['get', 'agency_name'], 'rapid-bus']}
          layout={commonLayout('realtime-rapid-bus')}
          paint={busPaint}
        />
        <Layer
          id={`realtime-mrt-feeder-${id}`}
          type="circle"
          source-layer="realtime_vehicles_with_stops"
          filter={['==', ['get', 'agency_name'], 'rapid-mrt']}
          layout={commonLayout('realtime-mrt-feeder')}
          paint={mrtPaint}
        />
        <Layer
          id={`rt-labels-${id}`}
          type="symbol"
          source-layer="realtime_vehicles_with_stops"
          minzoom={14}
          layout={{
            'text-field': ['concat', ['get', 'vehicle_label'], '\n', ['coalesce', ['get', 'next_stop_name'], '']],
            'text-size': 10,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'visibility': isVisible ? 'visible' : 'none'
          }}
          paint={labelPaint}
        />
      </Source>
    );
  };

  return (
    <>
      {renderBuffer('A')}
      {renderBuffer('B')}
    </>
  );
}
