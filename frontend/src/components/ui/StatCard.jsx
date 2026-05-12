// Reusable stat card with formula, value, and interpretation
export default function StatCard({ label, value, unit, formula, interpretation, color = 'var(--accent-blue)', size = 'md' }) {
  const valueSize = size === 'lg' ? '2rem' : size === 'sm' ? '1.1rem' : '1.5rem';
  return (
    <div className="stat-card" style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: formula ? 8 : 0 }}>
        <span style={{ fontSize: valueSize, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
          {value ?? '—'}
        </span>
        {unit && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {formula && (
        <div style={{
          fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--text-muted)', marginBottom: 6,
          padding: '0.35rem 0.65rem', background: 'rgba(99,130,255,0.06)',
          borderRadius: 6, display: 'inline-block',
        }}>
          {formula}
        </div>
      )}
      {interpretation && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {interpretation}
        </div>
      )}
    </div>
  );
}
