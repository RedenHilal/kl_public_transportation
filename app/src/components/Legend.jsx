import { memo } from 'react';

const LEGEND_ITEMS = [
  { type: 'line', color: '#e57200', label: 'Rapid Rail' },
  { type: 'line', color: '#115740', label: 'Rapid Bus' },
  { type: 'line', color: '#FFCD00', label: 'MRT Feeder' },
  { type: 'dot', color: '#D50032', label: 'Rail Station' },
  { type: 'dot', color: '#1964B7', label: 'KTM Station' },
  { type: 'dot', color: '#1964B7', label: 'KTMB Train', size: '8px' },
  { type: 'dot', color: '#0078D4', label: 'Rapid Bus', size: '8px' },
  { type: 'dot', color: '#FFCD00', label: 'MRT Feeder', size: '8px' },
];

function Legend() {
  return (
    <div id="legend">
      {LEGEND_ITEMS.map((item, i) => (
        <div className="legend-row" key={i}>
          {item.type === 'line' ? (
            <span className="legend-line" style={{ background: item.color }} />
          ) : (
            <span className="legend-dot" style={{ background: item.color, ...(item.size ? { width: item.size, height: item.size } : {}) }} />
          )}
          {item.label}
        </div>
      ))}
    </div>
  );
}

export default memo(Legend);
