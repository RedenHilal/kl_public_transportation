import { memo } from 'react';

const SECTIONS = [
  {
    title: 'Rail Transit',
    items: [
      { id: 'rail-lines', toggleId: 'toggle-rail', label: 'Rapid Rail Lines', swatch: '#e57200', type: 'line', checked: true },
      { id: 'rail-stops', toggleId: 'toggle-rail-stops', label: 'Rapid Rail Stations', swatch: '#D50032', type: 'dot', checked: true },
      { id: 'ktmb-stops', toggleId: 'toggle-ktmb-stops', label: 'KTM Stations', swatch: '#1964B7', type: 'dot', checked: true },
    ],
  },
  {
    title: 'Bus Services',
    items: [
      { id: 'bus-routes', toggleId: 'toggle-bus-routes', label: 'Rapid Bus Routes', swatch: '#115740', type: 'line', checked: true },
      { id: 'bus-stops', toggleId: 'toggle-bus-stops', label: 'Rapid Bus Stops', swatch: '#2E8B57', type: 'dot', checked: true },
      { id: 'mrt-feeder-routes', toggleId: 'toggle-mrt-routes', label: 'MRT Feeder Routes', swatch: '#FFCD00', type: 'line', checked: true },
      { id: 'mrt-feeder-stops', toggleId: 'toggle-mrt-stops', label: 'MRT Feeder Stops', swatch: '#DAA520', type: 'dot', checked: true },
    ],
  },
  {
    title: 'Realtime',
    items: [
      { id: 'realtime-bus', toggleId: 'toggle-realtime-bus', label: 'Live Bus Positions', swatch: '#0078D4', type: 'dot', checked: false },
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
  mobileExpanded,
  onHeaderClick,
}) {
  return (
    <div id="sidebar" className={mobileExpanded ? 'expanded' : ''}>
      <div id="sidebar-header" onClick={onHeaderClick}>
        <div>
          <div id="sidebar-handle" />
          <h1>Transit Malaysia <span>Kuala Lumpur</span></h1>
        </div>
        <div className="header-actions">
          <button className={`icon-btn${darkMode ? ' active' : ''}`} onClick={onToggleDark} title="Dark mode">&#9682;</button>
          <button className="icon-btn" onClick={onLocate} title="Find nearest stop">&#9673;</button>
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
              {section.items.map((item) => (
                <label className="layer-toggle" key={item.id}>
                  <input
                    type="checkbox"
                    id={item.toggleId}
                    defaultChecked={item.checked}
                    onChange={(e) => onToggle(item.id, item.id.startsWith('realtime'), e.target.checked)}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-label">
                    <span className={`swatch${item.type === 'dot' ? ' dot' : ''}`} style={{ background: item.swatch }} />
                    {item.label}
                  </span>
                </label>
              ))}
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
    online: 'Live: active',
    empty: 'Live: no buses right now',
    offline: 'Real-time unavailable',
  };
  const dotClass = status === 'online' ? 'online' : status === 'empty' ? 'warning' : status === 'offline' ? '' : 'warning';
  const timeStr = lastUpdate ? lastUpdate.toLocaleTimeString() : '';
  return (
    <div id="status-bar">
      <div className={`status-dot ${dotClass}`} />
      <span id="status-text">{labels[status] || labels.idle}</span>
      {busCount > 0 && <span id="bus-count">{busCount} bus{busCount !== 1 ? 'es' : ''}</span>}
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
