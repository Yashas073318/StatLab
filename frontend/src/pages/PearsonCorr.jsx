import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQuery } from '@tanstack/react-query';
import { statsApi } from '../api';
import { setCorrelationField, setCorrelationResult, setMatrixResult } from '../store/slices/statsSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { TrendingUp, Info } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, ReferenceLine } from 'recharts';

function CorrelationGauge({ r }) {
  if (r === null || r === undefined) return null;
  const angle = (r + 1) * 90; // -1 → 0°, 0 → 90°, +1 → 180°
  const color = r > 0.7 ? '#10b981' : r > 0.3 ? '#84cc16' : r < -0.7 ? '#f43f5e' : r < -0.3 ? '#f59e0b' : '#94a3c0';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={180} height={100} viewBox="0 0 180 100">
        {/* Background arc */}
        <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12} strokeLinecap="round" />
        {/* Colored segments */}
        {[['#f43f5e', 0, 36], ['#f59e0b', 36, 72], ['#94a3c0', 72, 108], ['#84cc16', 108, 144], ['#10b981', 144, 180]].map(([c, s, e]) => {
          const startRad = (s - 90) * Math.PI / 180;
          const endRad = (e - 90) * Math.PI / 180;
          const x1 = 90 + 80 * Math.cos(startRad), y1 = 90 + 80 * Math.sin(startRad);
          const x2 = 90 + 80 * Math.cos(endRad), y2 = 90 + 80 * Math.sin(endRad);
          return <path key={c} d={`M ${x1} ${y1} A 80 80 0 0 1 ${x2} ${y2}`} fill="none" stroke={c} strokeWidth={12} opacity={0.4} strokeLinecap="round" />;
        })}
        {/* Needle */}
        {(() => {
          const rad = ((angle - 90) * Math.PI) / 180;
          const nx = 90 + 65 * Math.cos(rad), ny = 90 + 65 * Math.sin(rad);
          return <>
            <circle cx={90} cy={90} r={6} fill={color} />
            <line x1={90} y1={90} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          </>;
        })()}
        <text x={10} y={98} fontSize={9} fill="#f43f5e">-1</text>
        <text x={82} y={18} fontSize={9} fill="#94a3c0">0</text>
        <text x={160} y={98} fontSize={9} fill="#10b981">+1</text>
      </svg>
      <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>{r?.toFixed(4)}</div>
    </div>
  );
}

function getInterpretation(r) {
  const a = Math.abs(r);
  if (a >= 0.9) return r > 0 ? 'Very strong positive correlation' : 'Very strong negative correlation';
  if (a >= 0.7) return r > 0 ? 'Strong positive correlation' : 'Strong negative correlation';
  if (a >= 0.5) return r > 0 ? 'Moderate positive correlation' : 'Moderate negative correlation';
  if (a >= 0.3) return r > 0 ? 'Weak positive correlation' : 'Weak negative correlation';
  return 'No linear correlation';
}

function CorrelationMatrix({ matrix, cols }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ padding: '0.5rem', color: 'var(--text-muted)', textAlign: 'left' }}></th>
            {cols.map(c => <th key={c} style={{ padding: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {cols.map((r, ri) => (
            <tr key={r}>
              <td style={{ padding: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r}</td>
              {cols.map((c, ci) => {
                const val = matrix?.[ri]?.[ci] ?? 0;
                const a = Math.abs(val);
                const bg = val > 0
                  ? `rgba(16,185,129,${a * 0.6})`
                  : `rgba(244,63,94,${a * 0.6})`;
                return (
                  <td key={c} style={{ padding: '0.5rem', textAlign: 'center', background: bg, borderRadius: 4, color: a > 0.5 ? 'white' : 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: ri === ci ? 900 : 400 }}>
                    {val.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PearsonCorr() {
  const dispatch = useDispatch();
  const { activeId, activeDataset } = useSelector(s => s.datasets);
  const { correlation } = useSelector(s => s.stats);
  const { col1, col2, selectedCols, result, matrixResult, showMatrix } = correlation;
  const [scatterData, setScatterData] = useState(null);

  const numericCols = activeDataset?.columns?.filter(c => c.type === 'numeric').map(c => c.name) || [];

  const { mutate: runPearson, isPending } = useMutation({
    mutationFn: (payload) => statsApi.correlationPearson(payload),
    onSuccess: async (res) => {
      dispatch(setCorrelationResult(res.data));
      dispatch(showNotification({ type: 'success', message: 'Pearson correlation computed!' }));
      // Also fetch scatter data
      try {
        const s = await statsApi.scatter({ datasetId: activeId, col1, col2 });
        setScatterData(s.data);
      } catch (_) {}
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  const { mutate: runMatrix, isPending: matrixPending } = useMutation({
    mutationFn: (payload) => statsApi.correlationMatrix(payload),
    onSuccess: (res) => {
      dispatch(setMatrixResult(res.data));
      dispatch(showNotification({ type: 'success', message: 'Correlation matrix computed!' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
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

  const set = (key, value) => dispatch(setCorrelationField({ key, value }));

  const toggleMatrixCol = (c) => dispatch(setCorrelationField({ key: 'selectedCols', value: selectedCols.includes(c) ? selectedCols.filter(x => x !== c) : [...selectedCols, c] }));

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <TrendingUp size={22} color="var(--accent-emerald)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Pearson Correlation</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Pearson (r) measures the strength of a straight-line (linear) relationship between two variables, ranging from -1 to +1. 
          <strong style={{ color: 'var(--accent-emerald)' }}> Note:</strong> Spearman (ρ) measures monotonic correlation using ranks instead of raw values — this makes it perfect for non-linear relationships and highly resilient against extreme outliers. 
          The "Compare" feature clearly shows where they diverge.
        </p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        r = Σ[(xᵢ−x̄)(yᵢ−ȳ)] / (n−1)sₓsᵧ &nbsp;&nbsp;∈ [−1, +1]
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Pairwise Correlation</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Variable X</label>
              <select className="select-field" value={col1} onChange={e => dispatch(setCorrelationField({ key: 'col1', value: e.target.value }))}>
                <option value="">Select column...</option>
                {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Variable Y</label>
              <select className="select-field" value={col2} onChange={e => dispatch(setCorrelationField({ key: 'col2', value: e.target.value }))}>
                <option value="">Select column...</option>
                {numericCols.filter(c => c !== col1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn-primary" disabled={!col1 || !col2 || isPending}
              onClick={() => runPearson({ datasetId: activeId, col1, col2 })}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Computing...</> : 'Compute Pearson r'}
            </button>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Correlation Matrix</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {numericCols.map(c => (
                <div key={c} onClick={() => toggleMatrixCol(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0.35rem 0.5rem', borderRadius: 6, background: selectedCols.includes(c) ? 'rgba(99,130,255,0.08)' : 'transparent' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selectedCols.includes(c) ? 'var(--accent-blue)' : 'var(--border-subtle)'}`, background: selectedCols.includes(c) ? 'var(--accent-blue)' : 'transparent', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c}</span>
                </div>
              ))}
            </div>
            <button className="btn-secondary" disabled={selectedCols.length < 2 || matrixPending}
              onClick={() => runMatrix({ datasetId: activeId, columns: selectedCols })}
              style={{ width: '100%', fontSize: '0.8rem' }}>
              {matrixPending ? 'Computing...' : `Compute Matrix (${selectedCols.length} cols)`}
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {result ? (
            <>
              <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <CorrelationGauge r={result.r} />
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', textAlign: 'center' }}>
                  {getInterpretation(result.r)}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {[['n', result.n], ['t-stat', result.tStat?.toFixed(4)], ['p-value', result.pValue?.toFixed(4)]].map(([k, v]) => (
                    <div key={k} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{v}</div>
                    </div>
                  ))}
                  <span className={`badge ${result.pValue < 0.05 ? 'badge-emerald' : 'badge-amber'}`}>
                    {result.pValue < 0.05 ? 'Statistically Significant' : 'Not Significant'} (α=0.05)
                  </span>
                </div>
              </div>

              {scatterData?.points && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Scatter Plot with Regression Line</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="rgba(99,130,255,0.06)" />
                      <XAxis dataKey="x" name={col1} type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: col1, position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 11 }} />
                      <YAxis dataKey="y" name={col2} type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
                      <Scatter data={scatterData.points} fill="rgba(99,130,255,0.6)" />
                      {scatterData.regressionLine && <Line data={scatterData.regressionLine} type="monotone" dataKey="y" stroke="var(--accent-emerald)" strokeWidth={2} dot={false} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <TrendingUp size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Select two columns and compute</div>
            </div>
          )}
          {matrixResult && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Correlation Matrix Heatmap</div>
              <CorrelationMatrix matrix={matrixResult.matrix} cols={selectedCols} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
