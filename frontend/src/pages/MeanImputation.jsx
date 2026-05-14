import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cleanApi, datasetsApi } from '../api';
import { setStrategy } from '../store/slices/cleaningSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { addDataset } from '../store/slices/datasetSlice';
import { Beaker, AlertTriangle, CheckCircle, Info, X, BarChart, Settings2, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';

const TYPE_COLORS = { numeric: 'badge-blue', categorical: 'badge-violet', datetime: 'badge-cyan', unknown: 'badge-amber' };

function MiniHistogram({ values = [], skewness = 0 }) {
  if (!values || !values.length) return null;
  const max = Math.max(...values);
  // Color based on skewness: blue for normal-ish, amber for moderate, rose for high skew
  let barColor = 'var(--accent-blue)';
  if (Math.abs(skewness) > 0.5) barColor = 'var(--accent-amber)';
  if (Math.abs(skewness) > 1) barColor = 'var(--accent-rose)';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 32, padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border-subtle)' }} title={`Skewness: ${skewness?.toFixed(3)}`}>
      {values.map((v, i) => (
        <div
          key={i}
          className="mini-bar"
          style={{
            height: `${Math.max((v / max) * 100, 5)}%`,
            width: 4,
            background: barColor,
            borderRadius: '1px',
            opacity: 0.8
          }}
        />
      ))}
    </div>
  );
}

function ColumnProfileCard({ col, onOpenLargeView, strategy }) {
  const isNull = col.nullCount > 0;
  const nullPct = col.totalCount > 0 ? ((col.nullCount / col.totalCount) * 100).toFixed(1) : 0;

  return (
    <div className="stat-card glass-card-hover" style={{ padding: '1.25rem', cursor: 'pointer', position: 'relative' }} onClick={() => onOpenLargeView(col)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4 }}>{col.name}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <span className={`badge ${TYPE_COLORS[col.type] || 'badge-amber'}`} style={{ fontSize: '0.6rem', padding: '0.05rem 0.4rem' }}>{col.type}</span>
            <span className="badge badge-violet" style={{ fontSize: '0.6rem', padding: '0.05rem 0.4rem' }}>{col.uniqueCount} Unique</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {col.histogram && <MiniHistogram values={col.histogram} skewness={col.skewness} />}
          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 2, fontWeight: 700, textTransform: 'uppercase' }}>
            Skew <span style={{ color: Math.abs(col.skewness) > 0.5 ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>{col.skewness?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 16px', marginBottom: 16 }}>
        {[
          ['Mean', col.mean?.toFixed(2)],
          ['Median', col.median?.toFixed(2)],
          ['Min', col.min?.toFixed(1)],
          ['Max', col.max?.toFixed(1)],
          ['Std Dev', col.std?.toFixed(2)]
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>{v ?? '—'}</div>
          </div>
        ))}
      </div>

      {isNull && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Null Density</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--accent-rose)', fontWeight: 700 }}>{nullPct}%</span>
          </div>
          <div className="progress-bar" style={{ height: 4 }}>
            <div className="progress-fill" style={{ width: `${nullPct}%`, background: 'linear-gradient(90deg, var(--accent-amber), var(--accent-rose))' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {strategy === 'remove_incomplete' && <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>Drop Rows</span>}
        {!strategy && isNull && <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>Has Nulls</span>}
        {!isNull && <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>Clean</span>}
      </div>
    </div>
  );
}

function LargeViewModal({ col, strategy, onToggleStrategy, onClose }) {
  const isNull = col.nullCount > 0;
  const isRemoveIncomplete = strategy === 'remove_incomplete';
  const range = col.max - col.min;

  const getSkewInterpretation = (s) => {
    if (Math.abs(s) < 0.5) return { text: 'Approximately Symmetric', color: 'var(--accent-emerald)', icon: ShieldCheck };
    if (Math.abs(s) < 1) return { text: 'Moderately Skewed', color: 'var(--accent-amber)', icon: Info };
    return { text: 'Highly Skewed', color: 'var(--accent-rose)', icon: AlertTriangle };
  };

  const skewInfo = getSkewInterpretation(col.skewness || 0);
  const SkewIcon = skewInfo.icon;

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-card animate-scale-in" style={{ width: '95%', maxWidth: 650, padding: 0, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>

        {/* Header Section */}
        <div style={{ background: 'linear-gradient(135deg, rgba(99,130,255,0.1), rgba(155,107,255,0.1))', padding: '2rem', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
          <button className="btn-ghost" onClick={onClose} style={{ position: 'absolute', right: 16, top: 16, padding: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}>
            <X size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(99,130,255,0.3)' }}>
              <BarChart size={24} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>{col.name}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`badge ${TYPE_COLORS[col.type] || 'badge-amber'}`}>{col.type}</span>
                <span className="badge badge-violet">{col.uniqueCount} Unique Values</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '2rem' }}>
          {/* Main Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            {[
              ['Mean', col.mean, 'The average value of the dataset.'],
              ['Median', col.median, 'The middle value when sorted.']
            ].map(([k, v, desc]) => (
              <div key={k} className="glass-card tooltip-trigger" style={{ padding: '1.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{k}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono, monospace' }}>{v?.toFixed(2) ?? '—'}</div>
                <div className="tooltip" style={{ fontSize: '0.65rem' }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Histogram & Skewness Info */}
            <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Distribution Shape</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: skewInfo.color }}>
                  <SkewIcon size={14} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{skewInfo.text}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100, marginBottom: 16, padding: '0 8px' }}>
                {col.histogram?.map((v, i) => {
                  const max = Math.max(...col.histogram);
                  return (
                    <div key={i} style={{
                      flex: 1,
                      height: `${(v / max) * 100}%`,
                      background: i === 0 || i === col.histogram.length - 1 ? 'var(--accent-rose)' : 'var(--accent-blue)',
                      opacity: 0.6 + (v / max) * 0.4,
                      borderRadius: '2px 2px 0 0',
                      transition: '0.3s'
                    }} />
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                <span>Min: {col.min?.toFixed(1)}</span>
                <span>Max: {col.max?.toFixed(1)}</span>
              </div>
            </div>

            {/* Dispersion Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {[
                ['Std Deviation', col.std, 'Standard dispersion'],
                ['Range', range, 'Spread (Max - Min)'],
                ['IsNull Density', `${((col.nullCount / col.totalCount) * 100).toFixed(1)}%`, 'Percentage missing'],
                ['Total Rows', col.totalCount, 'Dataset size']
              ].map(([k, v, d]) => (
                <div key={k} className="glass-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{v ?? '—'}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 4 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Section */}
          {isNull ? (
            <div className="glass-card" style={{
              padding: '1.5rem',
              background: isRemoveIncomplete ? 'rgba(244, 63, 94, 0.05)' : 'rgba(99, 130, 255, 0.05)',
              border: `1px solid ${isRemoveIncomplete ? 'rgba(244, 63, 94, 0.2)' : 'rgba(99, 130, 255, 0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: isRemoveIncomplete ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 130, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isRemoveIncomplete ? <Trash2 color="var(--accent-rose)" /> : <Settings2 color="var(--accent-blue)" />}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Remove Incomplete Set</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 300 }}>
                    Currently, this column has <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>{col.nullCount}</span> missing values.
                    Enabling this will drop all rows containing these nulls.
                  </p>
                </div>
              </div>
              <label className="toggle-switch">
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => onToggleStrategy(isRemoveIncomplete ? 'Mean' : 'remove_incomplete')}>
                  <div style={{ width: 56, height: 28, background: isRemoveIncomplete ? 'var(--accent-rose)' : 'var(--bg-tertiary)', borderRadius: 14, transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  <div style={{ position: 'absolute', top: 4, left: isRemoveIncomplete ? 32 : 4, width: 20, height: 20, background: 'white', borderRadius: '50%', transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                </div>
              </label>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ color: 'var(--accent-emerald)', marginBottom: 8 }}><ShieldCheck size={32} style={{ margin: '0 auto' }} /></div>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Data Quality Verified</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This column contains no missing values and is ready for analysis.</p>
            </div>
          )}

          <div style={{ marginTop: '2rem', display: 'flex', gap: 12 }}>
            <button className="btn-primary" style={{ flex: 1, padding: '1rem' }} onClick={onClose}>
              Confirm and Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeanImputation() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { activeId } = useSelector(s => s.datasets);
  const { strategies } = useSelector(s => s.cleaning);
  const [selectedCol, setSelectedCol] = useState(null);

  const { data: nullData, isLoading } = useQuery({
    queryKey: ['dataset', activeId, 'nulls'],
    queryFn: () => cleanApi.nullMap(activeId),
    enabled: !!activeId,
    select: r => r.data,
    staleTime: Infinity,
  });

  const { mutate: applyImpute, isPending } = useMutation({
    mutationFn: (payload) => cleanApi.impute(payload),
    onSuccess: (res) => {
      dispatch(addDataset(res.data.dataset));
      qc.invalidateQueries({ queryKey: ['datasets'] });
      dispatch(showNotification({ type: 'success', message: 'Cleaning applied! New dataset version created.' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  if (!activeId) return (
    <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Info size={40} style={{ color: 'var(--accent-blue)', opacity: 0.5 }} />
        </div>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Dataset Selected</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Select a dataset in the Manager first.</p>
        <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => dispatch(setActiveModule('datasets'))}>Go to Manager</button>
      </div>
    </div>
  );

  const columns = nullData?.columns?.filter(c => c.name.toLowerCase() !== 'id' && c.type === 'numeric') || [];

  const handleApply = () => {
    const cols = columns.map(c => ({
      name: c.name,
      strategy: (strategies[c.name] || 'Mean').toLowerCase().replace(' ', '_'),
    }));
    applyImpute({ datasetId: activeId, columns: cols });
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Beaker size={22} color="var(--accent-violet)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Central Tendencies</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Examine the central tendency of your data distributions. Identify missing values and choose to remove incomplete observations to ensure analytical integrity.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />)}
        </div>
      ) : columns.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle size={40} style={{ marginBottom: 12, color: 'var(--accent-emerald)', opacity: 0.6 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>All Clear</div>
          <div style={{ fontSize: '0.875rem' }}>No numeric columns found in this dataset.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {columns.map(c => (
              <ColumnProfileCard
                key={c.name}
                col={c}
                strategy={strategies[c.name]}
                onOpenLargeView={setSelectedCol}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-primary" onClick={handleApply} disabled={isPending} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Processing...</> : <><Beaker size={15} /> Apply Changes & Save</>}
            </button>
          </div>

          {selectedCol && (
            <LargeViewModal
              col={selectedCol}
              strategy={strategies[selectedCol.name]}
              onToggleStrategy={(s) => dispatch(setStrategy({ col: selectedCol.name, strategy: s }))}
              onClose={() => setSelectedCol(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
