import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import Sidebar from './components/Sidebar';
import Legend from './components/Legend';
import { ServiceAlerts } from './components/ServiceAlerts';
import { RealtimeLayers } from './components/Map/RealtimeLayers';
import { Toast } from './components/Toast';
import { useRouteMetadata } from './hooks/useRouteMetadata';
import { useRealtime } from './hooks/useRealtime';
import { LAYER_DEFS, INTERACTIVE_LAYERS, ASSET_MAP, AGENCY_LABELS } from './constants/transit';
import { MARTIN_URL } from './constants/config';

// Maps a realtime layer toggle id to its feed agency_name (for empty-feed toasts).
const REALTIME_TOGGLE_AGENCY = {
  'realtime-ktmb': 'ktmb',
  'realtime-rapid-bus': 'rapid-bus',
  'realtime-mrt-feeder': 'rapid-mrt',
};
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('transit-theme') === 'dark');
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [nearbyStops, setNearbyStops] = useState(null);
  const [highlightedRoute, setHighlightedRoute] = useState(null);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [alerts, setAlerts] = useState([]);
  const [visibility, setVisibility] = useState(() => {
    const v = {};
    LAYER_DEFS.forEach(l => { v[l.id] = true; });
    v['realtime-ktmb'] = false;
    v['realtime-rapid-bus'] = false;
    v['realtime-mrt-feeder'] = false;
    return v;
  });

  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef(null);
  const routeMetadata = useRouteMetadata(mapLoaded ? mapInstanceRef.current : null);

  // Live fleet GeoJSON + per-feed status (for empty/unavailable detection).
  const { data: realtimeData, feeds: realtimeFeeds } = useRealtime(refreshKey);
  const feedsRef = useRef([]);
  useEffect(() => { feedsRef.current = realtimeFeeds; }, [realtimeFeeds]);
  const [toast, setToast] = useState(null);

  const toggleLayer = useCallback((layerId, isRealtime, checked) => {
    if (isRealtime) setRealtimeEnabled(checked);
    setVisibility(prev => ({ ...prev, [layerId]: checked }));

    // When a realtime layer is switched ON, warn if its upstream feed is empty/unavailable.
    if (isRealtime && checked) {
      const agency = REALTIME_TOGGLE_AGENCY[layerId];
      const fs = feedsRef.current.find((f) => f.agency === agency);
      const label = AGENCY_LABELS[agency] || 'This service';
      if (fs && !fs.ok) {
        setToast({ type: 'warn', message: `${label} live tracking is unavailable right now.` });
      } else if (fs && fs.vehicles === 0) {
        setToast({ type: 'info', message: `No live ${label} vehicles in the feed right now — the operator isn't broadcasting positions.` });
      }
    }
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('transit-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstanceRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSearch = useCallback((query) => {
    if (!query || query.length < 2 || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const q = query.toLowerCase();

    const features = map.querySourceFeatures('stops', { sourceLayer: 'transit_stops' });
    const results = features
      .filter(f => f.properties?.stop_name?.toLowerCase().includes(q))
      .slice(0, 8);

    const el = document.getElementById('search-results');
    if (!el) return;
    el.innerHTML = '';
    el.classList.add('show');
    if (results.length === 0) {
      el.innerHTML = '<div class="search-item" style="text-align:center;color:var(--text-muted);">No results in loaded area</div>';
      return;
    }
    results.forEach(f => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `<span class="name">${f.properties.stop_name}</span><span class="meta">${AGENCY_LABELS[f.properties.agency] || ''}</span>`;
      div.addEventListener('click', () => {
        map.flyTo({ center: f.geometry.coordinates, zoom: 17 });
        el.classList.remove('show');
        document.getElementById('search-input').value = '';
      });
      el.appendChild(div);
    });
  }, []);

  const handleMapClick = useCallback(async (e) => {
    if (!e.features || e.features.length === 0) { setPopupInfo(null); return; }
    const feature = e.features[0];
    const props = feature.properties;
    const layerId = feature.layer?.id;

    let html = '';
    if (layerId === 'realtime-bus' || layerId?.includes('realtime')) {
      const speed = props.speed != null ? (props.speed * 3.6).toFixed(1) + ' km/h' : 'N/A';
      const updated = props.timestamp ? new Date(props.timestamp * 1000).toLocaleTimeString() : '';
      const agencyLabel = AGENCY_LABELS[props.agency_name] || 'Live Vehicle';
      const nextStop = props.next_stop_name ? `<br/><span>Approaching: <strong>${props.next_stop_name}</strong></span>` : '';
      
      html = `<strong>${props.vehicle_id || 'Vehicle'} #${props.vehicle_label || ''}</strong>
        <span class="popup-agency">${agencyLabel}</span>
        <span>Route: ${props.route_id || 'N/A'} &#8226; ${speed}</span>
        ${nextStop}
        ${updated ? `<br/><span style="font-size:10px;color:var(--text-muted);">Updated: ${updated}</span>` : ''}`;
    } else if (layerId?.includes('stops')) {
      const agency = AGENCY_LABELS[props.agency] || '';
      html = `<strong>${props.stop_name || 'Unnamed'}</strong><span class="popup-agency">${agency}</span>`;
      if (props.agency === 'rapid-rail') {
        html += `<div class="arrivals-box"><div class="arrivals-title">Live Arrivals</div><div class="arrival-row"><span>Fetching live times...</span></div></div>`;
      }
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

  // Automated Refresh for Realtime Data
  useEffect(() => {
    if (!mapLoaded) return;

    // 1. Refresh Map Markers (every 15s)
    const refreshMarkers = () => {
      setRefreshKey(Date.now());
    };

    // 2. Fetch Service Alerts (every 60s)
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${MARTIN_URL}/service_alerts/0/0/0?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.features) setAlerts(data.features.map(f => f.properties));
      } catch (err) { console.warn('Alerts fetch failed', err); }
    };

    fetchAlerts();
    const markerInterval = setInterval(refreshMarkers, 15000);
    const alertInterval = setInterval(fetchAlerts, 60000);

    return () => {
      clearInterval(markerInterval);
      clearInterval(alertInterval);
    };
  }, [mapLoaded]);

  const handleMapLoad = useCallback((e) => {
    const map = e.target;
    mapInstanceRef.current = map;
    setMapLoaded(true);
    
    ASSET_MAP.forEach(async (asset) => {
      try {
        const image = await map.loadImage(asset.path);
        if (image && !map.hasImage(asset.id)) {
          map.addImage(asset.id, image.data);
        }
      } catch (err) {
        console.warn(`Failed to load asset: ${asset.id}`, err);
      }
    });
  }, []);

  const mapStyle = useMemo(() => ({
    version: 8,
    sources: {
      basemap: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'], tileSize: 256, attribution: '&copy; OSM &copy; CARTO' },
    },
    layers: [{ id: 'basemap-layer', type: 'raster', source: 'basemap' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  }), []);

  const layerComponents = useMemo(() =>
    LAYER_DEFS.map(l => {
      const isHighlighted = highlightedRoute === l.id;
      const paint = { ...l.paint };
      if (l.type === 'line') {
        paint['line-opacity'] = highlightedRoute ? (isHighlighted ? 1 : 0.1) : l.paint['line-opacity'];
        paint['line-width'] = isHighlighted ? 8 : l.paint['line-width'];
      }
      return (
        <Layer key={l.id} {...l} paint={paint} layout={{ ...l.layout, visibility: visibility[l.id] ? 'visible' : 'none' }} />
      );
    }), [visibility, highlightedRoute]
  );

  const handleRouteClick = useCallback((id) => {
    setHighlightedRoute(prev => prev === id ? null : id);
  }, []);

  const transformRequest = useCallback((url, resourceType) => {
    if (resourceType === 'Tile' && url.includes('realtime')) {
      const separator = url.includes('?') ? '&' : '?';
      return {
        url: `${url}${separator}cb=${Math.random().toString(36).substring(7)}`
      };
    }
    return { url };
  }, []);

  return (
    <>
      <ServiceAlerts alerts={alerts} />
      <Sidebar
        onToggle={toggleLayer}
        onSearch={handleSearch}
        onLocate={handleLocate}
        status={realtimeEnabled ? 'live' : 'idle'}
        busCount={0} // This was from useRealtimeBuses, setting to 0 or removing if not used
        lastUpdate={new Date().toLocaleTimeString()}
        nearbyStops={nearbyStops}
        onNearbyStopClick={(stop) => mapInstanceRef.current?.flyTo({ center: [stop.lon, stop.lat], zoom: 17 })}
        darkMode={darkMode}
        onToggleDark={toggleDark}
        onHeaderClick={() => setMobileExpanded(prev => !prev)}
        mobileExpanded={mobileExpanded}
        routeMetadata={routeMetadata}
        onRouteClick={handleRouteClick}
        highlightedRoute={highlightedRoute}
      />

      <div id="map-container">
        <Map
          onLoad={handleMapLoad}
          mapLib={maplibregl}
          initialViewState={{ longitude: 101.69, latitude: 3.14, zoom: 10.5 }}
          mapStyle={mapStyle}
          transformRequest={transformRequest}
          maxBounds={[[98.5, 0.5], [120, 7.5]]}
          interactiveLayerIds={[
            ...INTERACTIVE_LAYERS,
            'realtime-ktmb', 'realtime-rapid-bus', 'realtime-mrt-feeder'
          ]}
          onClick={handleMapClick}
        >
          <Source id="routes" type="vector" tiles={[`${MARTIN_URL}/transit_routes/{z}/{x}/{y}`]} minzoom={6} maxzoom={20} />
          <Source id="stops" type="vector" tiles={[`${MARTIN_URL}/transit_stops/{z}/{x}/{y}`]} minzoom={8} maxzoom={20} />
          
          {layerComponents}
          <RealtimeLayers visibility={visibility} data={realtimeData} />

          {popupInfo && (
            <Popup longitude={popupInfo.lngLat.lng} latitude={popupInfo.lngLat.lat} onClose={() => setPopupInfo(null)} anchor="top">
              <div dangerouslySetInnerHTML={{ __html: popupInfo.html }} />
            </Popup>
          )}
        </Map>
      </div>

      <Legend routeMetadata={routeMetadata} visibility={visibility} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

export default App;
