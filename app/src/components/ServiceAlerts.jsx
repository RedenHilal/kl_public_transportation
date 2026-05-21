import { AGENCY_LABELS } from '../constants/transit';

export function ServiceAlerts({ alerts }) {
  if (!alerts || !Array.isArray(alerts) || alerts.length === 0) return null;
  return (
    <div id="alerts-ticker">
      <span className="alert-badge">Alerts</span>
      <div className="ticker-wrap">
        {alerts.map((a, i) => (
          <div key={i} className="alert-item">
            <strong>{AGENCY_LABELS[a?.agency_name] || a?.agency_name || 'Transit'}:</strong> {a?.alert_header || 'Service update'}
          </div>
        ))}
      </div>
    </div>
  );
}
