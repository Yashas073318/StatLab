import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { statsApi, cleanApi } from '../api';
import { setOutlierAction, setBoxplotActiveColumn } from '../store/slices/cleaningSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { addDataset } from '../store/slices/datasetSlice';
import { BarChart2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

function BoxPlotSVG({ q1, q2, q3, min, max, outliers = [], width = 260, height = 100 }) {
  const range = max - min || 1;
  const toX = v => ((v - min) / range) * (width - 40) + 20;
  const q1x = toX(q1), q2x = toX(q2), q3x = toX(q3);
  const minW = toX(Math.max(min, q1 - 1.5 * (q3 - q1)));
  const maxW = toX(Math.min(max, q3 + 1.5 * (q3 - q1)));
  const cy = height / 2;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Whisker lines */}
      <line x1={minW} y1={cy} x2={q1x} y2={cy} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      <line x1={q3x} y1={cy} x2={maxW} y2={cy} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      <line x1={minW} y1={cy - 10} x2={minW} y2={cy + 10} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      <line x1={maxW} y1={cy - 10} x2={maxW} y2={cy + 10} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      {/* IQR box */}
      <rect x={q1x} y={cy - 18} width={q3x - q1x} height={36} rx={4}
        fill="rgba(99,130,255,0.12)" stroke="rgba(99,130,255,0.5)" strokeWidth={1.5} />
      {/* Median line */}
      <line x1={q2x} y1={cy - 18} x2={q2x} y2={cy + 18} stroke="var(--accent-cyan)" strokeWidth={2.5} />
      {/* Outliers */}
      {outliers.map((o, i) => (
        <circle key={i} cx={toX(o.value)} cy={cy} r={4} fill="var(--accent-rose)" opacity={0.8} />
      ))}
    </svg>
  );
}

export default function BoxPlotIQR() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { activeId } = useSelector(s => s.datasets);
  const { outlierActions, boxplotActiveColumn } = useSelector(s => s.cleaning);
  const [iqrMultiplier, setIqrMultiplier] = useState(1.5);
  const [expanded, setExpanded] = useState(null);

  const { data: boxData, isLoading } = useQuery({
    queryKey: ['boxplot', activeId],
    queryFn: () => statsApi.boxplot(activeId),
    enabled: !!activeId,
    select: r => r.data,
  });

  const { mutate: applyOutliers, isPending } = useMutation({
    mutationFn: (payload) => cleanApi.outliers(payload),
    onSuccess: (res) => {
      dispatch(addDataset(res.data.dataset));
      qc.invalidateQueries({ queryKey: ['datasets'] });
      dispatch(showNotification({ type: 'success', message: 'Outlier treatment applied!' }));
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

  const columns = boxData ? Object.entries(boxData).map(([name, stats]) => ({ name, ...stats })) : [];
  const ACTIONS = ['Remove rows', 'Cap to whisker', 'Keep'];

  const handleApply = () => {
    const cols = columns.map(c => ({
      name: c.name,
      action: (outlierActions[c.name] || 'keep').toLowerCase().replace(' ', '_'),
    }));
    applyOutliers({ datasetId: activeId, columns: cols, iqrMultiplier });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <BarChart2 size={22} color="var(--accent-emerald)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Box Plot & IQR Outlier Removal</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Visualize distributions and remove or cap outliers using the IQR rule.</p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        Outlier if: x {'<'} Q1 − {iqrMultiplier}×IQR &nbsp;|&nbsp; x {'>'} Q3 + {iqrMultiplier}×IQR
      </div>

      {/* IQR multiplier toggle */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>IQR Multiplier:</span>
        {[1.5, 2.0, 3.0].map(m => (
          <button key={m} className={iqrMultiplier === m ? 'btn-secondary' : 'btn-ghost'}
            onClick={() => setIqrMultiplier(m)} style={{ fontSize: '0.8rem', padding: '0.35rem 1rem' }}>
            {m}× {m === 1.5 ? '(Standard)' : m === 3.0 ? '(Extreme)' : ''}
          </button>
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
          {iqrMultiplier === 1.5 ? 'Standard Tukey fences' : iqrMultiplier === 3.0 ? 'Only extreme outliers' : 'Moderate threshold'}
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />)}
        </div>
      ) : columns.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No numeric columns found for box plot analysis.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {columns.map(c => {
              const action = outlierActions[c.name] || 'Keep';
              const isExpanded = expanded === c.name;
              const outlierCount = c.outliers?.length || 0;
              return (
                <div key={c.name} className="glass-card" style={{ padding: '1.25rem', cursor: 'pointer' }}
                  onClick={() => setExpanded(isExpanded ? null : c.name)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                      {outlierCount > 0 && <span className="badge badge-rose" style={{ fontSize: '0.65rem', marginTop: 4 }}>{outlierCount} outliers</span>}
                    </div>
                    {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                  <BoxPlotSVG q1={c.q1} q2={c.q2} q3={c.q3} min={c.min} max={c.max} outliers={c.outliers || []} />
                  {isExpanded && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12, marginBottom: 12 }}>
                        {[['Min', c.min?.toFixed(2)], ['Q1', c.q1?.toFixed(2)], ['Median', c.q2?.toFixed(2)], ['Q3', c.q3?.toFixed(2)], ['Max', c.max?.toFixed(2)], ['IQR', c.iqr?.toFixed(2)]].map(([k, v]) => (
                          <div key={k} style={{ textAlign: 'center', padding: '0.4rem', background: 'rgba(99,130,255,0.06)', borderRadius: 6 }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        {ACTIONS.map(a => (
                          <button key={a} className={action === a ? 'btn-secondary' : 'btn-ghost'}
                            style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }}
                            onClick={() => dispatch(setOutlierAction({ col: c.name, action: a }))}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="btn-primary" onClick={handleApply} disabled={isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Applying...</> : <><BarChart2 size={15} /> Apply Outlier Treatment & Save</>}
          </button>
        </>
      )}
    </div>
  );
}
