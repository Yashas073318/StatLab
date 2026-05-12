import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { clearNotification } from '../../store/slices/uiSlice';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};
const COLORS = {
  success: 'var(--accent-emerald)',
  error: 'var(--accent-rose)',
  info: 'var(--accent-blue)',
  warning: 'var(--accent-amber)',
};

export default function Notification({ type = 'info', message }) {
  const dispatch = useDispatch();
  const Icon = ICONS[type] || Info;
  const color = COLORS[type];

  return (
    <div className="fade-in" style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--bg-card)',
      border: `1px solid ${color}40`,
      borderRadius: 14,
      padding: '0.875rem 1.25rem',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}20`,
      maxWidth: 360, minWidth: 260,
      backdropFilter: 'blur(16px)',
    }}>
      <Icon size={18} color={color} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', flex: 1 }}>{message}</span>
      <button onClick={() => dispatch(clearNotification())} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', padding: 2, display: 'flex',
      }}>
        <X size={14} />
      </button>
    </div>
  );
}
