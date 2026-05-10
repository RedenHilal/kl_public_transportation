import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

const INTERACTIVE_LAYERS = [
  'rail-lines', 'bus-routes', 'mrt-feeder-routes',
  'rail-stops', 'bus-stops', 'mrt-feeder-stops', 'ktmb-stops',
  'realtime-ktmb', 'realtime-rapid-bus', 'realtime-mrt-feeder',
];

const AGENCY_LABELS = {
  'ktmb': 'KTM',
  'rapid-rail': 'Rapid Rail',
  'rapid-bus': 'Rapid Bus',
  'rapid-mrt': 'MRT Feeder',
};

const LAYER_DEFS = [
  { id: 'rail-lines', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-rail'],
    paint: { 'line-color': ['coalesce', ['get', 'route_color'], '#e57200'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 4, 18, 7], 'line-opacity': 0.85 },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'bus-routes', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-bus'],
    paint: { 'line-color': ['coalesce', ['get', 'route_color'], '#115740'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 1.5, 18, 3], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.5, 18, 0.8] },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'mrt-feeder-routes', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-mrt'],
    paint: { 'line-color': ['coalesce', ['get', 'route_color'], '#FFCD00'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 1.5, 18, 3], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.5, 18, 0.8] },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'rail-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-rail'],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 5, 18, 9], 'circle-color': '#D50032', 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
  { id: 'bus-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-bus'], minzoom: 13,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 4, 18, 6], 'circle-color': '#2E8B57', 'circle-opacity': 0.6 } },
  { id: 'mrt-feeder-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-mrt'], minzoom: 13,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 4, 18, 6], 'circle-color': '#DAA520', 'circle-opacity': 0.6 } },
  { id: 'ktmb-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'ktmb'],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 5, 18, 9], 'circle-color': '#1964B7', 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
];

function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('transit-theme') === 'dark');
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [nearbyStops, setNearbyStops] = useState(null);
  const [visibility, setVisibility] = useState(() => {
    const v = {};
    LAYER_DEFS.forEach(l => { v[l.id] = true; });
    v['realtime-ktmb'] = false;
    v['realtime-ktmb-dir'] = false;
    v['realtime-rapid-bus'] = false;
    v['realtime-rapid-bus-dir'] = false;
    v['realtime-mrt-feeder'] = false;
    v['realtime-mrt-feeder-dir'] = false;
    return v;
  });

  const mapInstanceRef = useRef(null);

  const toggleLayer = useCallback((layerId, isRealtime, checked) => {
    if (isRealtime) {
      setRealtimeEnabled(checked);
    }
    setVisibility(prev => {
      const next = { ...prev, [layerId]: checked };
      if (isRealtime) {
        next['realtime-ktmb-dir'] = checked;
        next['realtime-rapid-bus-dir'] = checked;
        next['realtime-mrt-feeder-dir'] = checked;
      }
      return next;
    });
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('transit-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  function findNearbyStops(map, lat, lng) {
    if (!map) return;
    const features = map.querySourceFeatures('stops', { sourceLayer: 'transit_stops' });
    const stops = features
      .map(f => {
        const [flng, flat] = f.geometry.coordinates;
        const dist = getDist(lat, lng, flat, flng);
        return { ...f.properties, lon: flng, lat: flat, dist };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
    setNearbyStops(stops);
  }

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    const map = mapInstanceRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map?.flyTo({ center: [longitude, latitude], zoom: 14 });
        setTimeout(() => findNearbyStops(map, latitude, longitude), 1500);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleNearbyStopClick = useCallback((stop) => {
    mapInstanceRef.current?.flyTo({ center: [stop.lon, stop.lat], zoom: 17 });
  }, []);

  const handleSearch = useCallback((query) => {
    if (!query || query.length < 2) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const q = query.toLowerCase();

    // Search all loaded vector tiles (not just visible viewport)
    const features = map.querySourceFeatures('stops', { sourceLayer: 'transit_stops' });
    const results = features
      .filter(f => {
        const name = f.properties?.stop_name;
        return name && name.toLowerCase().includes(q);
      })
      .slice(0, 8);

    const el = document.getElementById('search-results');
    if (!el) return;
    el.innerHTML = '';
    el.classList.add('show');
    if (results.length === 0) {
      el.innerHTML = '<div class="search-item" style="text-align:center;color:var(--text-muted);">No results in loaded area — zoom or pan first</div>';
      return;
    }
    results.forEach(f => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `<span class="name">${f.properties.stop_name}</span><span class="meta">${AGENCY_LABELS[f.properties.agency] || ''}</span>`;
      div.addEventListener('click', () => {
        mapInstanceRef.current?.flyTo({ center: f.geometry.coordinates, zoom: 17 });
        el.classList.remove('show');
        document.getElementById('search-input').value = '';
      });
      el.appendChild(div);
    });
  }, []);

  const handleMapClick = useCallback((e) => {
    if (!e.features || e.features.length === 0) { setPopupInfo(null); return; }
    const feature = e.features[0];
    const props = feature.properties;
    const layerId = feature.layer?.id;

    let html = '';
    if (layerId?.startsWith('realtime-')) {
      const speed = props.speed != null ? (props.speed * 3.6).toFixed(1) + ' km/h' : 'N/A';
      const updated = props.timestamp ? new Date(props.timestamp * 1000).toLocaleTimeString() : '';
      const agencyLabel = AGENCY_LABELS[props.agency_name] || 'Live Vehicle';
      html = `<strong>${props.vehicle_id || 'Vehicle'} #${props.vehicle_label || ''}</strong>
        <span class="popup-agency">${agencyLabel}</span>
        <span>Route: ${props.route_id || 'N/A'} &#8226; ${speed}</span>
        ${updated ? `<span style="font-size:10px;color:var(--text-muted);">Updated: ${updated}</span>` : ''}`;
    } else if (layerId?.includes('stops')) {
      const agency = AGENCY_LABELS[props.agency] || '';
      html = `<strong>${props.stop_name || 'Unnamed'}</strong>`;
      if (agency) html += `<span class="popup-agency">${agency}</span>`;
      if (props.stop_code) html += `<span>Code: ${props.stop_code}</span>`;
      if (props.routes) html += `<div class="popup-detail"><span class="popup-badge">${props.routes}</span></div>`;
    } else if (layerId?.includes('routes') || layerId === 'rail-lines') {
      html = `<strong>${props.route_short_name || '?'}</strong>
        <span class="popup-agency">${AGENCY_LABELS[props.agency] || ''} Route</span>
        <span>${props.route_long_name || ''}</span>`;
    }

    if (html) setPopupInfo({ lngLat: e.lngLat, html });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setMobileExpanded(!e.matches);
    mq.addEventListener('change', handler);
    handler(mq);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const mapStyle = useMemo(() => ({
    version: 8,
    sources: {
      basemap: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'], tileSize: 256, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>' },
    },
    layers: [{ id: 'basemap-layer', type: 'raster', source: 'basemap' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  }), []);

  const handleMapLoad = useCallback((e) => {
    mapInstanceRef.current = e.target;
  }, []);

  const layerComponents = useMemo(() =>
    LAYER_DEFS.map(l => (
      <Layer key={l.id} {...l} layout={{ ...l.layout, visibility: visibility[l.id] ? 'visible' : 'none' }} />
    )), [visibility]
  );

  return (
    <>
      <Sidebar
        onToggle={toggleLayer}
        onSearch={handleSearch}
        onLocate={handleLocate}
        nearbyStops={nearbyStops}
        onNearbyStopClick={handleNearbyStopClick}
        darkMode={darkMode}
        onToggleDark={toggleDark}
        onHeaderClick={() => setMobileExpanded(prev => !prev)}
        mobileExpanded={mobileExpanded}
      />

      <div id="map-container">
        <Map
          onLoad={handleMapLoad}
          mapLib={maplibregl}
          initialViewState={{ longitude: 101.69, latitude: 3.14, zoom: 10.5 }}
          mapStyle={mapStyle}
          maxBounds={[[98.5, 0.5], [120, 7.5]]}
          interactiveLayerIds={INTERACTIVE_LAYERS}
          onClick={handleMapClick}
        >
          <Source id="routes" type="vector" tiles={['https://yuellen.my.id/martin/transit_routes/{z}/{x}/{y}']} minzoom={6} maxzoom={20} />
          <Source id="stops" type="vector" tiles={['https://yuellen.my.id/martin/transit_stops/{z}/{x}/{y}']} minzoom={8} maxzoom={20} />

          <Source id="bus-realtime" type="vector" tiles={['https://yuellen.my.id/martin/realtime_vehicle_positions/{z}/{x}/{y}']} minzoom={6} maxzoom={20}>
            <Layer
              id="realtime-ktmb"
              type="circle"
              source-layer="realtime_vehicle_positions"
              filter={['==', ['get', 'agency_name'], 'ktmb']}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 15, 7, 18, 12],
                'circle-color': '#1964B7',
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
              layout={{ visibility: visibility['realtime-ktmb'] ? 'visible' : 'none' }}
            />
            <Layer
              id="realtime-ktmb-dir"
              type="symbol"
              source-layer="realtime_vehicle_positions"
              filter={['all', ['==', ['get', 'agency_name'], 'ktmb'], ['has', 'bearing']]}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#1964B7',
                'text-halo-width': 1,
              }}
              layout={{
                visibility: visibility['realtime-ktmb-dir'] ? 'visible' : 'none',
                'text-field': '▲',
                'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 14, 18, 20],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'text-rotate': ['get', 'bearing'],
              }}
            />
            <Layer
              id="realtime-rapid-bus"
              type="circle"
              source-layer="realtime_vehicle_positions"
              filter={['==', ['get', 'agency_name'], 'rapid-bus']}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 15, 6, 18, 10],
                'circle-color': '#0078D4',
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
              layout={{ visibility: visibility['realtime-rapid-bus'] ? 'visible' : 'none' }}
            />
            <Layer
              id="realtime-rapid-bus-dir"
              type="symbol"
              source-layer="realtime_vehicle_positions"
              filter={['all', ['==', ['get', 'agency_name'], 'rapid-bus'], ['has', 'bearing']]}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#0078D4',
                'text-halo-width': 1,
              }}
              layout={{
                visibility: visibility['realtime-rapid-bus-dir'] ? 'visible' : 'none',
                'text-field': '▲',
                'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 15, 12, 18, 16],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'text-rotate': ['get', 'bearing'],
              }}
            />
            <Layer
              id="realtime-mrt-feeder"
              type="circle"
              source-layer="realtime_vehicle_positions"
              filter={['==', ['get', 'agency_name'], 'rapid-mrt']}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 15, 6, 18, 10],
                'circle-color': '#FFCD00',
                'circle-opacity': 0.9,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#333333',
              }}
              layout={{ visibility: visibility['realtime-mrt-feeder'] ? 'visible' : 'none' }}
            />
            <Layer
              id="realtime-mrt-feeder-dir"
              type="symbol"
              source-layer="realtime_vehicle_positions"
              filter={['all', ['==', ['get', 'agency_name'], 'rapid-mrt'], ['has', 'bearing']]}
              paint={{
                'text-color': '#333333',
                'text-halo-color': '#FFCD00',
                'text-halo-width': 1,
              }}
              layout={{
                visibility: visibility['realtime-mrt-feeder-dir'] ? 'visible' : 'none',
                'text-field': '▲',
                'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 15, 12, 18, 16],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'text-rotate': ['get', 'bearing'],
              }}
            />
          </Source>

          {layerComponents}

          {popupInfo && (
            <Popup
              longitude={popupInfo.lngLat.lng}
              latitude={popupInfo.lngLat.lat}
              onClose={() => setPopupInfo(null)}
              anchor="top"
            >
              <div dangerouslySetInnerHTML={{ __html: popupInfo.html }} />
            </Popup>
          )}
        </Map>
      </div>

      <Legend />
    </>
  );
}

function getDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default App;
