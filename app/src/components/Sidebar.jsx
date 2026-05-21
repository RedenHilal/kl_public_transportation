import { memo, useState, useRef } from 'react';

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
      { id: 'realtime-ktmb', agency: 'ktmb', toggleId: 'toggle-realtime-ktmb', label: 'KTMB Trains', swatch: '#1964B7', type: 'dot', checked: false },
      { id: 'realtime-rapid-bus', agency: 'rapid-bus', toggleId: 'toggle-realtime-rapid-bus', label: 'Rapid Bus', swatch: '#0078D4', type: 'dot', checked: false },
      { id: 'realtime-mrt-feeder', agency: 'rapid-mrt', toggleId: 'toggle-realtime-mrt-feeder', label: 'MRT Feeder', swatch: '#FFCD00', type: 'dot', checked: false },
    ],
  },
];

function Sidebar({
  onToggle,
  onSearch,
  onLocate,
  status,
  busCount,
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
    return [...new Set(agencyRoutes.map(r => r.color))];
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
          <span className="search-icon">&#9740;</span>
          <input id="search-input" type="text" placeholder="Search stops or routes..." autoComplete="off"
            onChange={(e) => onSearch(e.target.value)}
          />
          <div id="search-results"></div>
        </div>

        <StatusBar status={status} busCount={busCount} lastUpdate={lastUpdate} />

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
                  : { background: item.swatch || (item.agency === 'rapid-rail' ? '#e57200' : '#115740') };

                return (
                  <label className={`layer-toggle${highlightedRoute === item.id ? ' highlighted' : ''}`} key={item.id}>
                    <input
                      type="checkbox"
                      id={item.toggleId}
                      defaultChecked={item.checked}
                      onChange={(e) => onToggle(item.id, item.id.startsWith('realtime'), e.target.checked)}
                    />
                    <span className="toggle-track" />
                    <span className="toggle-label" onClick={(e) => {
                       if (item.type === 'line') {
                          e.preventDefault();
                          onRouteClick(item.id);
                       }
                    }}>
                      <span className={`swatch${item.type === 'dot' ? ' dot' : ''}`} style={swatchStyle} />
                      {item.label}
                    </span>
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

function StatusBar({ status, busCount, lastUpdate }) {
  const labels = {
    idle: 'Real-time: paused',
    live: 'Live: active',
    empty: 'Live: no vehicles right now',
    offline: 'Real-time unavailable',
  };
  const dotClass = (status === 'live' || status === 'online') ? 'online' : status === 'empty' ? 'warning' : status === 'offline' ? '' : 'warning';
  const timeStr = lastUpdate instanceof Date ? lastUpdate.toLocaleTimeString() : lastUpdate || '';
  return (
    <div id="status-bar">
      <div className={`status-dot ${dotClass}`} />
      <span id="status-text">{labels[status] || labels.idle}</span>
      {busCount > 0 && <span id="bus-count">{busCount} vehicle{busCount !== 1 ? 's' : ''}</span>}
      {timeStr && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{timeStr}</span>}
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
