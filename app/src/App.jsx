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
import { MARTIN_URL, ARRIVALS_URL } from './constants/config';
import { AGENCY_COLORS, isLight, legendColor } from './constants/colors';
import { autoScrollAll } from './utils/marquee';

// Maps a realtime layer toggle id to its feed agency_name (for empty-feed toasts).
const REALTIME_TOGGLE_AGENCY = {
  'realtime-ktmb': 'ktmb',
  'realtime-rapid-bus': 'rapid-bus',
  'realtime-mrt-feeder': 'rapid-mrt',
};

// Draws an upward-pointing arrow on a canvas and returns ImageData for map.addImage.
// Rendered at 2x (registered with pixelRatio: 2) for crisp edges.
function makeArrowIcon(fill, outline) {
  const size = 44;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  ctx.translate(c, c);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.40);          // tip (north)
  ctx.lineTo(size * 0.30, size * 0.36); // bottom-right
  ctx.lineTo(0, size * 0.12);           // tail notch
  ctx.lineTo(-size * 0.30, size * 0.36);// bottom-left
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = size * 0.07;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

// Draws a colored rounded square ("chip") — a non-directional live-vehicle marker
// for feeds without a heading (KTMB), distinct from the round station dots.
function makeChipIcon(fill, outline) {
  const size = 44;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const m = size * 0.18;          // margin
  const w = size - m * 2;         // square side
  const r = size * 0.16;          // corner radius
  ctx.beginPath();
  ctx.roundRect(m, m, w, w, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = size * 0.09;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('transit-theme') === 'dark');
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
  const clickSeq = useRef(0); // guards async arrivals fetch against later clicks
  const routeMetadata = useRouteMetadata(mapLoaded ? mapInstanceRef.current : null);

  // Live fleet GeoJSON + per-feed status (for empty/unavailable detection).
  const { data: realtimeData, feeds: realtimeFeeds, status: realtimeStatus, lastUpdate: realtimeLastUpdate } = useRealtime(refreshKey);
  const feedsRef = useRef([]);
  useEffect(() => { feedsRef.current = realtimeFeeds; }, [realtimeFeeds]);
  const [toast, setToast] = useState(null);

  // route_short_name -> palette color, so live vehicles can follow their route's color.
  const routeColorMap = useMemo(() => {
    const m = {};
    (routeMetadata?.routes || []).forEach((r) => {
      if (r.agency && r.shortName) {
        m[`${r.agency}:${r.shortName}`] = legendColor({ agency: r.agency, shortName: r.shortName, routeColor: r.color });
      }
    });
    return m;
  }, [routeMetadata]);

  // Color each live vehicle by its route (falls back to agency color). Headings
  // (dirBearing/hasHeading) are already set in useRealtime. arrowIcon names a
  // per-color icon generated on demand in handleMapLoad.
  const enrichedRealtime = useMemo(() => {
    const features = (realtimeData?.features || []).map((f) => {
      const p = f.properties || {};
      const agency = p.agency_name;
      const color = routeColorMap[`${agency}:${p.route_id}`] || AGENCY_COLORS[agency] || '#37474F';
      const key = color.replace('#', '');
      return { ...f, properties: { ...p, color, arrowIcon: `arrow_${key}`, chipIcon: `chip_${key}` } };
    });
    return { type: 'FeatureCollection', features };
  }, [realtimeData, routeColorMap]);

  const toggleLayer = useCallback((layerId, isRealtime, checked) => {
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

    // Colored pill matching the route's map color (text auto-contrasts).
    const badge = (label, agency, shortName, routeColor) => {
      const c = legendColor({ agency, shortName, routeColor });
      return `<span class="popup-badge" style="background:${c};color:${isLight(c) ? '#222' : '#fff'}">${label}</span>`;
    };

    let html = '';
    if (layerId === 'realtime-bus' || layerId?.includes('realtime')) {
      const speed = props.speed != null ? (props.speed * 3.6).toFixed(1) + ' km/h' : 'N/A';
      const updated = props.timestamp ? new Date(props.timestamp * 1000).toLocaleTimeString() : '';
      const agencyLabel = AGENCY_LABELS[props.agency_name] || 'Live Vehicle';
      // KTMB has no route_id, but the fetcher resolves its line from trip_id —
      // so KTM shows a "Line" badge + destination, others show their "Route".
      const isKtm = props.agency_name === 'ktmb';
      const routeLabel = props.route_short_name || props.route_id || '—';
      const title = props.vehicle_label || props.vehicle_id || 'Vehicle';
      const destRow = props.route_long_name
        ? `<div class="popup-row"><span class="popup-key">Toward</span><span class="popup-val">${props.route_long_name}</span></div>`
        : '';
      const nextStop = props.next_stop_name
        ? `<div class="popup-row"><span class="popup-key">Approaching</span><span class="popup-val">${props.next_stop_name}</span></div>`
        : '';

      html = `<strong>${title}</strong>
        <span class="popup-agency">${agencyLabel}</span>
        <div class="popup-row"><span class="popup-key">${isKtm ? 'Line' : 'Route'}</span>${badge(routeLabel, props.agency_name, props.route_short_name || props.route_id)}</div>
        ${destRow}
        <div class="popup-row"><span class="popup-key">Speed</span><span>${speed}</span></div>
        ${nextStop}
        ${updated ? `<span style="font-size:10px;color:var(--text-muted);margin-top:4px;display:block;">Updated: ${updated}</span>` : ''}`;
    } else if (layerId?.includes('stops')) {
      const agencyLabel = AGENCY_LABELS[props.agency] || '';
      let base = `<strong>${props.stop_name || 'Unnamed'}</strong><span class="popup-agency">${agencyLabel}</span>`;
      if (props.stop_code) base += `<span>Code: ${props.stop_code}</span>`;
      const routeList = (props.routes || '').split(', ').filter(Boolean);
      if (routeList.length) {
        const badges = routeList.map((n) => badge(n, props.agency, n)).join(' ');
        base += `<div class="popup-detail badge-row">${badges}</div>`;
      }

      // Rapid Rail has no live feed (frequency-based) — fetch next scheduled
      // departures and fill the box in once they arrive. Other agencies show live
      // vehicles instead, so no schedule box for them.
      if (props.agency === 'rapid-rail') {
        const stopId = props.stop_id ?? feature.id;
        const seq = ++clickSeq.current;
        const box = (inner) => `<div class="arrivals-box"><div class="arrivals-title">Next Trains</div>${inner}</div>`;
        const loading = box(`<div class="arrival-row"><span>Loading schedule…</span></div>`);
        setPopupInfo({ lngLat: e.lngLat, html: base + loading });
        fetch(`${ARRIVALS_URL}?stop_id=${encodeURIComponent(stopId)}&agency=rapid-rail`)
          .then((r) => r.json())
          .then(({ arrivals }) => {
            if (seq !== clickSeq.current) return;
            let inner;
            if (!arrivals || arrivals.length === 0) {
              inner = `<div class="arrival-row"><span>No more trains today</span></div>`;
            } else {
              inner = arrivals.map((a) =>
                `<div class="arrival-row">${badge(a.route, 'rapid-rail', a.route)}<span class="arr-time">${a.time}</span><span class="arr-head"><span class="marquee"><span class="marquee-inner">${a.headsign || ''}</span></span></span></div>`
              ).join('');
            }
            setPopupInfo({ lngLat: e.lngLat, html: base + box(inner) });
          })
          .catch(() => {
            if (seq !== clickSeq.current) return;
            setPopupInfo({ lngLat: e.lngLat, html: base + box(`<div class="arrival-row"><span>Schedule unavailable</span></div>`) });
          });
        return;
      }
      html = base;
    } else if (layerId?.includes('routes') || layerId === 'rail-lines') {
      html = `<strong>${badge(props.route_short_name || '?', props.agency, props.route_short_name, props.route_color)}</strong>
        <span class="popup-agency">${AGENCY_LABELS[props.agency] || ''} Route</span>
        <span>${props.route_long_name || ''}</span>`;
    }

    if (html) setPopupInfo({ lngLat: e.lngLat, html });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Auto-scroll any truncated text in the popup (e.g. long train headsigns).
  // The popup content arrives in two stages (loading -> async arrivals) and
  // MapLibre re-sizes the popup after we inject content, so a single rAF can
  // measure too early. Re-run across a couple of frames + a short delay.
  useEffect(() => {
    if (!popupInfo) return;
    const run = () => autoScrollAll(document.querySelector('.maplibregl-popup-content'));
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(run); });
    const t = setTimeout(run, 350);
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(t); };
  }, [popupInfo]);

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

    // Directional arrow icons are generated on demand, one per route color, so
    // each live vehicle's arrow matches its route. Features request `arrow_<hex>`;
    // we draw it the first time it's missing (drawn pointing up so icon-rotate
    // aligns with north). Robust across HMR — no pre-registration needed.
    map.on('styleimagemissing', (e) => {
      const id = e.id;
      if (!id || map.hasImage(id)) return;
      const make = id.startsWith('arrow_') ? makeArrowIcon : id.startsWith('chip_') ? makeChipIcon : null;
      if (!make) return;
      const hex = `#${id.slice(id.indexOf('_') + 1)}`;
      try {
        map.addImage(id, make(hex, isLight(hex) ? '#333333' : '#ffffff'), { pixelRatio: 2 });
      } catch (err) {
        console.warn(`Failed to generate icon: ${id}`, err);
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
        feeds={realtimeFeeds}
        realtimeStatus={realtimeStatus}
        lastUpdate={realtimeLastUpdate}
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
          onMouseEnter={() => { const c = mapInstanceRef.current?.getCanvas(); if (c) c.style.cursor = 'pointer'; }}
          onMouseLeave={() => { const c = mapInstanceRef.current?.getCanvas(); if (c) c.style.cursor = ''; }}
          interactiveLayerIds={[
            ...INTERACTIVE_LAYERS,
            'realtime-ktmb', 'realtime-rapid-bus', 'realtime-mrt-feeder'
          ]}
          onClick={handleMapClick}
        >
          <Source id="routes" type="vector" tiles={[`${MARTIN_URL}/transit_routes/{z}/{x}/{y}`]} minzoom={6} maxzoom={20} />
          <Source id="stops" type="vector" tiles={[`${MARTIN_URL}/transit_stops/{z}/{x}/{y}`]} minzoom={8} maxzoom={20} />
          
          {layerComponents}
          <RealtimeLayers visibility={visibility} data={enrichedRealtime} />

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
