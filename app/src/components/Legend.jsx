import { memo } from 'react';
import { AGENCY_LABELS } from '../constants/transit';

function Legend({ routeMetadata, visibility }) {
  const { routes } = routeMetadata || { routes: [] };

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
      <div id="legend">
        {showRail && (
          <div className="legend-row">
            <span className="legend-line" style={{ background: '#e57200' }} />
            Rail Transit
          </div>
        )}
        {showBus && (
          <div className="legend-row">
            <span className="legend-line" style={{ background: '#115740' }} />
            Bus Routes
          </div>
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
    
    const existing = acc[r.agency].find(item => item && item.color === r.color);
    if (existing) {
      if (r.shortName && !existing.names.includes(r.shortName)) {
        existing.names.push(r.shortName);
      }
    } else {
      acc[r.agency].push({
        color: r.color || '#888888',
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
    <div id="legend">
      <div className="legend-scroll-area">
        {Object.entries(grouped).map(([agency, agencyItems]) => (
          <div key={agency} className="legend-group">
            <div className="legend-agency-title">{AGENCY_LABELS[agency] || agency}</div>
            <div className="legend-routes-grid">
              {agencyItems.map((item, i) => (
                <div className="legend-row small" key={i} title={item.names.join(', ')}>
                  <span className="legend-line" style={{ background: item.color }} />
                  <span className="route-name">
                    {item.names.length > 2 
                      ? `${item.names.slice(0, 2).join(', ')}...` 
                      : item.names.join(', ')}
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
              <span className="legend-dot" style={{ background: '#D50032' }} />
              Stations
           </div>
        </div>
      )}
    </div>
  );
}

export default memo(Legend);
