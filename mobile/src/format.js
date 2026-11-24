export const STATUS_LABEL = {
  created: 'Waiting for driver',
  assigned: 'Assigned',
  loaded: 'Loaded',
  left: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const STATUS_COLOR = {
  created: '#8a6d00',
  assigned: '#1d5fbf',
  loaded: '#6b3fb5',
  left: '#b35c00',
  delivered: '#1f7a3d',
  cancelled: '#8b1e1e',
};

export const ROLE_LABEL = { admin: 'Admin', cashier: 'Cashier', driver: 'Driver' };

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const EVENT_LABEL = {
  created: 'Bill created at counter',
  assigned: 'Driver assigned',
  reassigned: 'Driver changed',
  loaded: 'Lot loaded',
  left: 'Left for delivery',
  otp_sent: 'OTP sent to customer',
  otp_resent: 'OTP sent again',
  otp_failed: 'Wrong OTP entered',
  delivered: 'Lot reached customer',
  finalized: 'Bill finalized',
  cancelled: 'Bill cancelled',
};
