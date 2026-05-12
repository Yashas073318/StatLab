import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { statsApi } from '../api';
import { setCorrelationField, setSpearmanResult } from '../store/slices/statsSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { GitCompare, Info, AlertTriangle } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SpearmanCorr() {
  const dispatch = useDispatch();
  const { activeId, activeDataset } = useSelector(s => s.datasets);
  const { correlation } = useSelector(s => s.stats);
  const { col1, col2, spearmanResult } = correlation;
  const [outlierDemo, setOutlierDemo] = useState(false);
  const [showDTable, setShowDTable] = useState(false);

  const numericCols = activeDataset?.columns?.filter(c => c.type === 'numeric').map(c => c.name) || [];

  const { mutate: runSpearman, isPending } = useMutation({
    mutationFn: (payload) => statsApi.correlationSpearman(payload),
    onSuccess: (res) => {
      dispatch(setSpearmanResult(res.data));
      dispatch(showNotification({ type: 'success', message: 'Spearman correlation computed!' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  const { mutate: runCompare, isPending: comparePending } = useMutation({
    mutationFn: (params) => statsApi.correlationCompare(params),
    onSuccess: (res) => {
      dispatch(setCorrelationField({ key: 'result', value: res.data.pearson }));
      dispatch(setSpearmanResult(res.data.spearman));
    },
  });

  if (!activeId) return (
    <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: 400 }}>
        <Info size={40} style={{ color: 'var(--accent-blue)', opacity: 0.5, marginBottom: 12 }} />
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Dataset Selected</h3>
        <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => dispatch(setActiveModule('datasets'))}>Go to Dataset Manager</button>
      </div>
    </div>
  );

  const { result: pearsonResult } = correlation;
  const showComparison = pearsonResult && spearmanResult;
  const disagreement = showComparison && Math.abs(spearmanResult.rho - pearsonResult.r) > 0.1;

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <GitCompare size={22} color="var(--accent-violet)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Spearman Rank Correlation</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Spearman (ρ) measures monotonic correlation using ranks instead of raw values — this makes it perfect for non-linear relationships and highly resilient against extreme outliers. 
          <strong style={{ color: 'var(--accent-violet)' }}> Note:</strong> Pearson (r) measures the strength of a straight-line (linear) relationship, ranging from -1 to +1. 
          The "Compare" feature clearly shows where they diverge.
        </p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        ρ = 1 − (6 Σdᵢ²) / (n(n²−1)) &nbsp;&nbsp; where dᵢ = rank(xᵢ) − rank(yᵢ)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Column Selection</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Variable X</label>
              <select className="select-field" value={col1} onChange={e => dispatch(setCorrelationField({ key: 'col1', value: e.target.value }))}>
                <option value="">Select...</option>
                {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Variable Y</label>
              <select className="select-field" value={col2} onChange={e => dispatch(setCorrelationField({ key: 'col2', value: e.target.value }))}>
                <option value="">Select...</option>
                {numericCols.filter(c => c !== col1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              <button className="btn-primary" disabled={!col1 || !col2 || isPending}
                onClick={() => runSpearman({ datasetId: activeId, col1, col2 })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Computing...</> : 'Compute Spearman ρ'}
              </button>
              <button className="btn-secondary" disabled={!col1 || !col2 || comparePending}
                onClick={() => runCompare({ datasetId: activeId, col1, col2 })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {comparePending ? 'Comparing...' : 'Compare Pearson vs Spearman'}
              </button>
            </div>
          </div>

          {/* Recommender */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 10 }}>When to Use</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '0.65rem', background: 'rgba(99,130,255,0.06)', borderRadius: 8, borderLeft: '3px solid var(--accent-blue)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 2 }}>Use Pearson when:</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Data is continuous, normally distributed, and has a linear relationship.</div>
              </div>
              <div style={{ padding: '0.65rem', background: 'rgba(155,107,255,0.06)', borderRadius: 8, borderLeft: '3px solid var(--accent-violet)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-violet)', marginBottom: 2 }}>Use Spearman when:</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Data has outliers, is ordinal, or has monotonic but non-linear relationships.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {showComparison && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Pearson vs Spearman Comparison</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { label: 'Pearson r', value: pearsonResult.r, color: 'var(--accent-blue)', desc: 'Linear correlation' },
                  { label: 'Spearman ρ', value: spearmanResult.rho, color: 'var(--accent-violet)', desc: 'Rank-based correlation' },
                ].map(({ label, value, color, desc }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '1rem', background: `${color}0d`, borderRadius: 12, border: `1px solid ${color}30` }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>{value?.toFixed(4)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{desc}</div>
                  </div>
                ))}
              </div>
              {disagreement && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.75rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10 }}>
                  <AlertTriangle size={14} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-amber)' }}>
                    |ρ − r| = {Math.abs(spearmanResult.rho - pearsonResult.r).toFixed(4)} &gt; 0.1 — The difference suggests non-linear monotonic structure or influential outliers.
                  </span>
                </div>
              )}
            </div>
          )}

          {spearmanResult && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  ['ρ (rho)', spearmanResult.rho?.toFixed(4), 'var(--accent-violet)'],
                  ['p-value', spearmanResult.pValue?.toFixed(4), 'var(--accent-blue)'],
                  ['Σd²', spearmanResult.dSquaredSum?.toFixed(2), 'var(--accent-cyan)'],
                  ['n', spearmanResult.n, 'var(--text-secondary)'],
                  ['df', spearmanResult.n - 2, 'var(--text-secondary)'],
                  ['Sig.', spearmanResult.pValue < 0.05 ? 'Yes (α=.05)' : 'No', spearmanResult.pValue < 0.05 ? 'var(--accent-emerald)' : 'var(--accent-amber)'],
                ].map(([k, v, c]) => (
                  <div key={k} className="stat-card" style={{ borderTop: `2px solid ${c}`, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: c, fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* d² table */}
              {spearmanResult.rankedPairs && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <button onClick={() => setShowDTable(!showDTable)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.875rem', padding: 0, marginBottom: showDTable ? 12 : 0 }}>
                    {showDTable ? '▲' : '▼'} Rank Differences Table (d²)
                  </button>
                  {showDTable && (
                    <div className="table-wrapper" style={{ maxHeight: 240, overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>i</th><th>x</th><th>y</th><th>rank(x)</th><th>rank(y)</th><th>d</th><th>d²</th></tr></thead>
                        <tbody>
                          {spearmanResult.rankedPairs.slice(0, 50).map((row, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{row.x?.toFixed(2)}</td>
                              <td>{row.y?.toFixed(2)}</td>
                              <td>{row.rankX?.toFixed(1)}</td>
                              <td>{row.rankY?.toFixed(1)}</td>
                              <td style={{ color: row.d > 0 ? 'var(--accent-blue)' : row.d < 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>{row.d?.toFixed(2)}</td>
                              <td>{row.dSq?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {!spearmanResult && (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <GitCompare size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Select columns and compute Spearman ρ</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
