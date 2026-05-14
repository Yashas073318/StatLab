import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { statsApi, cleanApi } from '../api';
import { setOutlierAction } from '../store/slices/cleaningSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { addDataset } from '../store/slices/datasetSlice';
import { BarChart2, Info, ChevronDown, ChevronUp, MousePointer2 } from 'lucide-react';

function BoxPlotSVG({ name, q1, q2, q3, min, max, outliers = [], width = 260, height = 100, activeRowIndex, onOutlierClick, onOutlierHover }) {
  const range = max - min || 1;
  const toX = v => ((v - min) / range) * (width - 40) + 20;
  const q1x = toX(q1), q2x = toX(q2), q3x = toX(q3);
  const minW = toX(Math.max(min, q1 - 1.5 * (q3 - q1)));
  const maxW = toX(Math.min(max, q3 + 1.5 * (q3 - q1)));
  const cy = height / 2;

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <line x1={minW} y1={cy} x2={q1x} y2={cy} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      <line x1={q3x} y1={cy} x2={maxW} y2={cy} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      <line x1={minW} y1={cy - 10} x2={minW} y2={cy + 10} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      <line x1={maxW} y1={cy - 10} x2={maxW} y2={cy + 10} stroke="rgba(99,130,255,0.6)" strokeWidth={1.5} />
      <rect x={q1x} y={cy - 18} width={Math.max(2, q3x - q1x)} height={36} rx={4}
        fill="rgba(99,130,255,0.12)" stroke="rgba(99,130,255,0.5)" strokeWidth={1.5} />
      <line x1={q2x} y1={cy - 18} x2={q2x} y2={cy + 18} stroke="var(--accent-cyan)" strokeWidth={2.5} />
      
      {outliers.map((o, i) => {
        const isActive = activeRowIndex === o.rowIndex;
        return (
          <circle 
            key={i} 
            cx={toX(o.value)} 
            cy={cy} 
            r={isActive ? 6 : 4} 
            fill={isActive ? "var(--accent-emerald)" : "var(--accent-rose)"} 
            opacity={0.8}
            className={`outlier-dot ${isActive ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onOutlierClick(o.rowIndex); }}
            onMouseEnter={(e) => onOutlierHover(o, e.target)}
            onMouseLeave={() => onOutlierHover(null, null)}
            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            data-row-index={o.rowIndex}
            data-col-name={name}
          />
        );
      })}
    </svg>
  );
}

export default function BoxPlotIQR() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { activeId } = useSelector(s => s.datasets);
  const { outlierActions } = useSelector(s => s.cleaning);
  const [iqrMultiplier, setIqrMultiplier] = useState(1.5);
  const [expanded, setExpanded] = useState(null);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [hoveredOutlier, setHoveredOutlier] = useState(null);
  const containerRef = useRef(null);
  const [lines, setLines] = useState([]);

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

  useEffect(() => {
    if (activeRowIndex === null) {
      setLines([]);
      return;
    }

    const dots = document.querySelectorAll(`.outlier-dot[data-row-index="${activeRowIndex}"]`);
    if (dots.length < 2) {
      setLines([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines = [];
    const points = Array.from(dots).map(dot => {
      const rect = dot.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top
      };
    });

    for (let i = 0; i < points.length - 1; i++) {
      newLines.push({ x1: points[i].x, y1: points[i].y, x2: points[i+1].x, y2: points[i+1].y });
    }
    setLines(newLines);
  }, [activeRowIndex, boxData, expanded]);

  if (!activeId) return (
    <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: 400 }}>
        <Info size={40} style={{ color: 'var(--accent-blue)', opacity: 0.5, marginBottom: 12 }} />
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Dataset Selected</h3>
        <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => dispatch(setActiveModule('datasets'))}>Go to Manager</button>
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
    <div style={{ padding: '2rem', position: 'relative' }} ref={containerRef}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <BarChart2 size={22} color="var(--accent-emerald)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Box Plot Interactivity</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Hover over outliers to see details. Click an outlier to map it across all columns to find multivariate anomalies.
          <strong style={{ color: 'var(--accent-emerald)' }}> Tip:</strong> Connecting lines show if the same observation (row) is an outlier in multiple variables.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="glass-card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>IQR Multiplier:</span>
          {[1.5, 3.0].map(m => (
            <button key={m} className={iqrMultiplier === m ? 'btn-secondary' : 'btn-ghost'}
              onClick={() => { setIqrMultiplier(m); setActiveRowIndex(null); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem' }}>
              {m}× {m === 1.5 ? '(Standard)' : '(Extreme)'}
            </button>
          ))}
        </div>
        {activeRowIndex !== null && (
          <button className="btn-ghost" onClick={() => setActiveRowIndex(null)} style={{ color: 'var(--accent-rose)', fontSize: '0.75rem' }}>
            Clear Mapping
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />)}
        </div>
      ) : columns.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No numeric columns found for box plot analysis.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {columns.map(c => {
              const action = outlierActions[c.name] || 'Keep';
              const isExpanded = expanded === c.name;
              const outlierCount = c.outliers?.length || 0;
              return (
                <div key={c.name} className="glass-card" style={{ padding: '1.25rem', cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div onClick={() => setExpanded(isExpanded ? null : c.name)} style={{ cursor: 'pointer', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                        {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                      </div>
                      {outlierCount > 0 && <span className="badge badge-rose" style={{ fontSize: '0.6rem', marginTop: 4 }}>{outlierCount} outliers</span>}
                    </div>
                    <MousePointer2 size={14} color="var(--accent-emerald)" opacity={activeRowIndex !== null ? 1 : 0.2} />
                  </div>
                  
                  <BoxPlotSVG 
                    name={c.name}
                    q1={c.q1} q2={c.q2} q3={c.q3} min={c.min} max={c.max} 
                    outliers={c.outliers || []} 
                    activeRowIndex={activeRowIndex}
                    onOutlierClick={setActiveRowIndex}
                    onOutlierHover={(o, el) => setHoveredOutlier(o ? { ...o, colName: c.name, rect: el.getBoundingClientRect() } : null)}
                  />

                  {isExpanded && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                        {[
                          ['Min', c.min], ['Q1', c.q1], ['Med', c.q2], 
                          ['Q3', c.q3], ['Max', c.max], ['IQR', c.iqr]
                        ].map(([k, v]) => (
                          <div key={k} style={{ textAlign: 'center', padding: '0.3rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k}</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{v?.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {ACTIONS.map(a => (
                          <button key={a} className={action === a ? 'btn-secondary' : 'btn-ghost'}
                            style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}
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
            {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Applying...</> : <><BarChart2 size={15} /> Apply Treatment</>}
          </button>

          {/* Mapping lines overlay */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            {lines.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} 
                stroke="var(--accent-emerald)" strokeWidth={2} strokeDasharray="4 2" opacity={0.6}>
                <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1s" repeatCount="indefinite" />
              </line>
            ))}
          </svg>

          {/* Outlier Tooltip */}
          {hoveredOutlier && (
            <div style={{
              position: 'fixed',
              left: hoveredOutlier.rect.left,
              top: hoveredOutlier.rect.top - 40,
              background: 'var(--bg-card)',
              border: '1px solid var(--accent-rose)',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: '0.7rem',
              zIndex: 1000,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              color: 'var(--text-primary)',
              transform: 'translateX(-50%)'
            }}>
              <div style={{ fontWeight: 700 }}>Row #{hoveredOutlier.rowIndex + 1}</div>
              <div>Value: {hoveredOutlier.value.toFixed(3)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
