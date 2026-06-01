import { useEffect } from 'react';

// Small auto-dismissing notification, e.g. when a realtime layer is toggled on
// but its upstream feed currently has no vehicles (or is unavailable).
export function Toast({ toast, onClose, duration = 6000 }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [toast, onClose, duration]);

  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type || 'info'}`} role="status" aria-live="polite">
      <span className="toast-msg">{toast.message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Dismiss">&times;</button>
    </div>
  );
}
