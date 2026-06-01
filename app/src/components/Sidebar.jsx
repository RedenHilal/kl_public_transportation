import { memo, useState, useRef } from 'react';
import { AGENCY_COLORS, STATION_COLOR, legendColor } from '../constants/colors';

const SECTIONS = [
  {
    title: 'Rail Transit',
    items: [
      { id: 'rail-lines', agency: 'rapid-rail', toggleId: 'toggle-rail', label: 'Rapid Rail Lines', type: 'line', checked: true },
      { id: 'rail-stops', agency: 'rapid-rail', toggleId: 'toggle-rail-stops', label: 'Rapid Rail Stations', swatch: '#D50032', type: 'dot', checked: true },
      { id: 'ktmb-stops', agency: 'ktmb', toggleId: 'toggle-ktmb-stops', label: 'KTM Stations', swatch: '#1964B7', type: 'dot', checked: true },
    ],
  },
  {
    title: 'Bus Services',
    items: [
      { id: 'bus-routes', agency: 'rapid-bus', toggleId: 'toggle-bus-routes', label: 'Rapid Bus Routes', type: 'line', checked: true },
      { id: 'bus-stops', agency: 'rapid-bus', toggleId: 'toggle-bus-stops', label: 'Rapid Bus Stops', swatch: '#2E8B57', type: 'dot', checked: true },
      { id: 'mrt-feeder-routes', agency: 'rapid-mrt', toggleId: 'toggle-mrt-routes', label: 'MRT Feeder Routes', type: 'line', checked: true },
      { id: 'mrt-feeder-stops', agency: 'rapid-mrt', toggleId: 'toggle-mrt-stops', label: 'MRT Feeder Stops', swatch: '#DAA520', type: 'dot', checked: true },
    ],
  },
  {
    title: 'Realtime',
    items: [
      { id: 'realtime-ktmb', agency: 'ktmb', toggleId: 'toggle-realtime-ktmb', label: 'KTMB Trains', type: 'marker', marker: 'chip', checked: false },
      { id: 'realtime-rapid-bus', agency: 'rapid-bus', toggleId: 'toggle-realtime-rapid-bus', label: 'Rapid Bus', type: 'marker', marker: 'arrow', checked: false },
      { id: 'realtime-mrt-feeder', agency: 'rapid-mrt', toggleId: 'toggle-realtime-mrt-feeder', label: 'MRT Feeder', type: 'marker', marker: 'arrow', checked: false },
    ],
  },
];

function Sidebar({
  onToggle,
  onSearch,
  onLocate,
  feeds,
  realtimeStatus,
  lastUpdate,
  nearbyStops,
  onNearbyStopClick,
  darkMode,
  onToggleDark,
  onHeaderClick,
  routeMetadata,
  onRouteClick,
  highlightedRoute
}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [sheetState, setSheetState] = useState('collapsed'); // collapsed, peek, expanded
  const startY = useRef(0);

  const { routes } = routeMetadata || { routes: [] };

  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startY.current;
    // Allow dragging up from collapsed/peek, but limit downward dragging
    if (sheetState === 'collapsed' && delta > 0) return;
    setDragY(delta);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const threshold = 80;
    
    if (dragY < -threshold) {
      setSheetState(prev => prev === 'collapsed' ? 'peek' : 'expanded');
    } else if (dragY > threshold) {
      setSheetState(prev => prev === 'expanded' ? 'peek' : 'collapsed');
    }
    setDragY(0);
  };

  const getAgencyColors = (agency) => {
    const agencyRoutes = routes.filter(r => r.agency === agency);
    if (agencyRoutes.length === 0) return null;
    return [...new Set(agencyRoutes.map(r => legendColor({ agency, shortName: r.shortName, routeColor: r.color })))];
  };

  return (
    <div id="sidebar" 
      className={`state-${sheetState}${isDragging ? ' dragging' : ''}`}
      style={isDragging ? { transform: `translateY(${dragY}px)` } : {}}
    >
      <div id="sidebar-header" 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
           if (window.innerWidth <= 768) {
              setSheetState(prev => prev === 'expanded' ? 'peek' : 'expanded');
           } else {
              onHeaderClick();
           }
        }}
      >
        <div>
          <div id="sidebar-handle" />
          <h1>Transit Malaysia <span>Kuala Lumpur</span></h1>
        </div>
        <div className="header-actions">
          <button className={`icon-btn${darkMode ? ' active' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleDark(); }} title="Dark mode">&#9682;</button>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onLocate(); }} title="Find nearest stop">&#9673;</button>
        </div>
      </div>

      <div id="sidebar-body">
        <div id="search-wrap">
          <span className="search-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input id="search-input" type="text" placeholder="Search stops or routes..." autoComplete="off"
            onChange={(e) => onSearch(e.target.value)}
          />
          <div id="search-results"></div>
        </div>

        <StatusBar feeds={feeds} status={realtimeStatus} lastUpdate={lastUpdate} />

        <div id="layer-toggles">
          {SECTIONS.map((section, i) => (
            <div key={section.title}>
              {i > 0 && <div style={{ marginTop: 8 }} />}
              <div className="section-title">{section.title}</div>
              <hr className="section-divider" />
              {section.items.map((item) => {
                const agencyColors = item.type === 'line' ? getAgencyColors(item.agency) : null;
                const swatchStyle = agencyColors && agencyColors.length > 0
                  ? { background: agencyColors.length === 1 ? agencyColors[0] : `linear-gradient(90deg, ${agencyColors.slice(0, 5).join(', ')})` }
                  : { background: AGENCY_COLORS[item.agency] || STATION_COLOR };
                const isRealtime = item.id.startsWith('realtime');

                return (
                  <label className={`layer-toggle${highlightedRoute === item.id ? ' highlighted' : ''}`} key={item.id}>
                    <input
                      type="checkbox"
                      id={item.toggleId}
                      defaultChecked={item.checked}
                      onChange={(e) => onToggle(item.id, isRealtime, e.target.checked)}
                    />
                    <span className="toggle-track" />
                    <span className="toggle-label" onClick={(e) => {
                       if (item.type === 'line') {
                          e.preventDefault();
                          onRouteClick(item.id);
                       }
                    }}>
                      {item.type === 'marker'
                        ? <MarkerSwatch shape={item.marker} color={AGENCY_COLORS[item.agency] || STATION_COLOR} />
                        : <span className={`swatch${item.type === 'dot' ? ' dot' : ''}`} style={swatchStyle} />}
                      {item.label}
                    </span>
                    {isRealtime && <LiveCount feed={(feeds || []).find(f => f.agency === item.agency)} />}
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        <NearbyStops stops={nearbyStops} onStopClick={onNearbyStopClick} />
      </div>
    </div>
  );
}

// Swatch for realtime rows: mirrors the live marker drawn on the map — a colored
// rounded chip (KTMB, no heading data) or an up-pointing arrow (bus / feeder).
function MarkerSwatch({ shape, color }) {
  if (shape === 'chip') {
    return <span className="swatch chip" style={{ background: color }} />;
  }
  return (
    <span className="swatch arrow" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill={color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M12 3 L19 21 L12 16 L5 21 Z" />
      </svg>
    </span>
  );
}

// Compact per-agency live count shown next to each realtime toggle.
function LiveCount({ feed }) {
  let text = '—';      // not yet loaded / no status
  let cls = 'live-count';
  if (feed) {
    if (!feed.ok) { text = 'offline'; cls += ' offline'; }
    else if (feed.vehicles > 0) { text = `${feed.vehicles} live`; cls += ' active'; }
    else { text = 'none'; cls += ' none'; }
  }
  return <span className={cls}>{text}</span>;
}

// Summary of live realtime data: total vehicles across feeds + last update time.
function StatusBar({ feeds, status, lastUpdate }) {
  const list = feeds || [];
  const anyOk = list.some(f => f.ok);
  const total = list.reduce((s, f) => s + (f.ok ? (f.vehicles || 0) : 0), 0);
  const loading = status === 'idle' && list.length === 0;

  let text;
  let dotClass;
  if (loading) { text = 'Connecting to live data…'; dotClass = 'warning'; }
  else if (!anyOk) { text = 'Realtime unavailable'; dotClass = ''; }
  else if (total > 0) { text = `${total} live vehicle${total !== 1 ? 's' : ''}`; dotClass = 'online'; }
  else { text = 'No live vehicles right now'; dotClass = 'warning'; }

  const timeStr = lastUpdate instanceof Date ? lastUpdate.toLocaleTimeString() : (lastUpdate || '');
  return (
    <div id="status-bar">
      <div className={`status-dot ${dotClass}`} />
      <span id="status-text">{text}</span>
      {timeStr && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>updated {timeStr}</span>}
    </div>
  );
}

function NearbyStops({ stops, onStopClick }) {
  return (
    <div id="nearby-stops">
      <div className="section-title">Nearest Stops</div>
      <hr className="section-divider" />
      <div id="nearby-list">
        {!stops || stops.length === 0
          ? 'Enable location to see nearby stops'
          : stops.map((s, i) => (
              <div className="stop-row" key={i} onClick={() => onStopClick(s)}>
                <span>{s.stop_name || 'Unnamed'}</span>
                <span className="stop-dist">{s.dist < 1 ? (s.dist * 1000).toFixed(0) + ' m' : s.dist.toFixed(1) + ' km'}</span>
              </div>
            ))
        }
      </div>
    </div>
  );
}

export default memo(Sidebar);

export { SECTIONS };
