import { memo, useEffect, useRef, useState } from 'react';
import { AGENCY_LABELS } from '../constants/transit';
import { legendColor, AGENCY_COLORS, STATION_COLOR } from '../constants/colors';
import { autoScrollAll } from '../utils/marquee';

function Legend({ routeMetadata, visibility }) {
  const { routes } = routeMetadata || { routes: [] };
  const rootRef = useRef(null);
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  );

  // Marquee any route names that overflow their row; re-measure on content/size change.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    autoScrollAll(el);
    const ro = new ResizeObserver(() => autoScrollAll(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [routes, visibility]);

  // Mapping of agency to its primary route/line visibility toggle
  const AGENCY_TO_LAYER = {
    'rapid-rail': 'rail-lines',
    'rapid-bus': 'bus-routes',
    'rapid-mrt': 'mrt-feeder-routes',
    'ktmb': 'ktmb-stops', 
  };

  if (!routes || routes.length === 0) {
    const showRail = visibility?.['rail-lines'] !== false;
    const showBus = visibility?.['bus-routes'] !== false;
    
    if (!showRail && !showBus) return null;

    return (
      <div id="legend" ref={rootRef} className={collapsed ? 'collapsed' : ''}>
        <LegendHeader collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />
        {!collapsed && (
          <>
            {showRail && (
              <div className="legend-row">
                <span className="legend-line" style={{ background: AGENCY_COLORS['rapid-rail'] }} />
                Rail Transit
              </div>
            )}
            {showBus && (
              <div className="legend-row">
                <span className="legend-line" style={{ background: AGENCY_COLORS['rapid-bus'] }} />
                Bus Routes
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const grouped = routes.reduce((acc, r) => {
    if (!r || !r.agency) return acc;
    
    const layerId = AGENCY_TO_LAYER[r.agency];
    if (layerId && visibility && visibility[layerId] === false) {
      return acc;
    }

    if (!acc[r.agency]) acc[r.agency] = [];

    // Swatch color comes from the shared palette so the legend matches the map
    // (rail per line, bus per GTFS sub-group, feeder/ktmb one identity color).
    const color = legendColor({ agency: r.agency, shortName: r.shortName, routeColor: r.color });

    const existing = acc[r.agency].find(item => item && item.color === color);
    if (existing) {
      if (r.shortName && !existing.names.includes(r.shortName)) {
        existing.names.push(r.shortName);
      }
    } else {
      acc[r.agency].push({
        color,
        names: [r.shortName || '?'],
        longName: r.longName || ''
      });
    }
    return acc;
  }, {});

  const showStations = ['rail-stops', 'bus-stops', 'mrt-feeder-stops', 'ktmb-stops']
    .some(id => visibility?.[id] !== false);

  if (Object.keys(grouped).length === 0 && !showStations) return null;

  return (
    <div id="legend" ref={rootRef} className={collapsed ? 'collapsed' : ''}>
      <LegendHeader collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />
      {!collapsed && (
        <>
          <div className="legend-scroll-area">
            {Object.entries(grouped).map(([agency, agencyItems]) => (
              <div key={agency} className="legend-group">
                <div className="legend-agency-title">{AGENCY_LABELS[agency] || agency}</div>
                <div className="legend-routes-grid">
                  {agencyItems.map((item, i) => (
                    <div className="legend-row small" key={i} title={item.names.join(', ')}>
                      <span className="legend-line" style={{ background: item.color }} />
                      <span className="route-name">
                        <span className="marquee"><span className="marquee-inner">{item.names.join(', ')}</span></span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {showStations && (
            <div className="legend-fixed-footer">
               <div className="legend-row">
                  <span className="legend-dot" style={{ background: STATION_COLOR }} />
                  Stations
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LegendHeader({ collapsed, onToggle }) {
  return (
    <div className="legend-header" onClick={onToggle} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
      <span>Legend</span>
      <span className={`legend-chevron${collapsed ? '' : ' open'}`}>&#9660;</span>
    </div>
  );
}

export default memo(Legend);
