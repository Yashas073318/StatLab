import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cleanApi, datasetsApi } from '../api';
import { setStrategy, setPreviewMode } from '../store/slices/cleaningSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { addDataset } from '../store/slices/datasetSlice';
import { Beaker, AlertTriangle, CheckCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react';

const STRATEGIES = ['Mean', 'Median', 'Custom Value', 'Skip'];

function InteractiveDataRow({ datasetId, column, strat, customValue }) {
  const [page, setPage] = useState(1);
  const [localNullIndices, setLocalNullIndices] = useState(new Set());

  const { data } = useQuery({
    queryKey: ['datasetPreview', datasetId, page],
    queryFn: () => datasetsApi.preview(datasetId, page),
    enabled: !!datasetId,
    select: r => r.data,
  });

  if (!data) return <div style={{ height: 40, marginTop: '1rem' }} className="skeleton" />;

  const toggleNull = (idx) => {
    setLocalNullIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const getImputedValue = () => {
    if (strat === 'Mean') return column.mean?.toFixed(2);
    if (strat === 'Median') return column.median?.toFixed(2);
    if (strat === 'Custom Value') return customValue || '0';
    return 'NaN';
  };

  return (
    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: 4 }}>
        <ChevronLeft size={16} />
      </button>

      <div style={{ display: 'flex', gap: '6px', flex: 1, overflowX: 'auto', padding: '2px' }}>
        {data.rows.map((row, i) => {
          const globalIdx = (page - 1) * 10 + i;
          const isLocalNull = localNullIndices.has(globalIdx);
          const isNativeNull = row[column.name] === null || row[column.name] === undefined || row[column.name] === '';
          const isMissing = isNativeNull || isLocalNull;

          let displayVal = row[column.name];
          if (typeof displayVal === 'number') displayVal = displayVal.toFixed(2);
          if (typeof displayVal === 'string' && displayVal.length > 6) displayVal = displayVal.substring(0, 6) + '..';

          let isImputed = false;
          if (isMissing) {
            if (strat !== 'Skip') {
              displayVal = getImputedValue();
              isImputed = true;
            } else {
              displayVal = 'NaN';
            }
          }

          return (
            <div
              key={globalIdx}
              onClick={() => !isNativeNull && toggleNull(globalIdx)}
              style={{
                flex: 1,
                minWidth: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: isNativeNull ? 'not-allowed' : 'pointer',
                background: isImputed ? 'rgba(155, 107, 255, 0.15)' : isNativeNull ? 'rgba(244, 63, 94, 0.1)' : 'var(--bg-card)',
                border: `1px solid ${isImputed ? 'var(--accent-violet)' : isNativeNull ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                color: isImputed ? 'var(--accent-violet)' : isNativeNull ? 'var(--accent-rose)' : 'var(--text-primary)',
                transition: 'all 0.2s ease',
                boxShadow: isImputed ? '0 0 10px rgba(155, 107, 255, 0.2)' : 'none'
              }}
              title={isNativeNull ? 'Original null' : 'Click to toggle null'}
              className="hover-scale"
            >
              {displayVal}
            </div>
          );
        })}
      </div>

      <button className="btn-ghost" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: 4 }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}


export default function MeanImputation() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { activeId } = useSelector(s => s.datasets);
  const { strategies, customValues } = useSelector(s => s.cleaning);
  const [localCustom, setLocalCustom] = useState({});

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
      dispatch(showNotification({ type: 'success', message: 'Imputation applied! New dataset version created.' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  if (!activeId) return (
    <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: 400 }}>
        <Info size={40} style={{ color: 'var(--accent-blue)', opacity: 0.5, marginBottom: 12 }} />
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Dataset Selected</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Go to Dataset Manager and select a dataset first.</p>
        <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => dispatch(setActiveModule('datasets'))}>Go to Dataset Manager</button>
      </div>
    </div>
  );

  const columns = nullData?.columns?.filter(c => c.type === 'numeric' && c.nullCount > 0) || [];

  const handleApply = () => {
    const cols = columns.map(c => ({
      name: c.name,
      strategy: (strategies[c.name] || 'Mean').toLowerCase().replace(' ', '_'),
      customValue: localCustom[c.name] || null,
    }));
    applyImpute({ datasetId: activeId, columns: cols });
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Beaker size={22} color="var(--accent-violet)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Mean Imputation</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Mean imputation replaces missing values (NaN) with the average (mean) of the observed values in that column.
          It's fast and simple, but it shrinks variance and can distort correlations.
          <strong style={{ color: 'var(--accent-violet)' }}> Tip:</strong> Use it mainly when missing data is &lt; 5% and random.
        </p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        x_imputed = strategy(column) — e.g., μ = Σxᵢ / n
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : columns.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle size={40} style={{ marginBottom: 12, color: 'var(--accent-emerald)', opacity: 0.6 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Missing Values Found</div>
          <div style={{ fontSize: '0.875rem' }}>This dataset has no null values in numeric columns.</div>
        </div>
      ) : (
        <>
          {/* Null heatmap summary */}
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>Missing Value Map — Numeric Columns</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {columns.map(c => {
                const pct = (c.nullCount / c.totalCount) * 100;
                const intensity = Math.min(pct / 50, 1);
                return (
                  <div key={c.name} className="heatmap-cell" style={{
                    padding: '0.5rem 0.875rem',
                    background: `rgba(244,63,94,${0.1 + intensity * 0.5})`,
                    border: `1px solid rgba(244,63,94,${0.2 + intensity * 0.4})`,
                    borderRadius: 8, flexDirection: 'column', gap: 2,
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--accent-rose)' }}>{c.nullCount} nulls ({pct.toFixed(1)}%)</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column configurator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {columns.map(c => {
              const strat = strategies[c.name] || 'Mean';
              return (
                <div key={c.name} className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                        μ={c.mean?.toFixed(3)} · σ={c.std?.toFixed(3)} · {c.nullCount} nulls
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {STRATEGIES.map(s => (
                        <button key={s}
                          className={strat === s ? 'btn-secondary' : 'btn-ghost'}
                          style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
                          onClick={() => dispatch(setStrategy({ col: c.name, strategy: s }))}>
                          {s}
                        </button>
                      ))}
                    </div>
                    {strat === 'Custom Value' && (
                      <input className="input-field" type="number" placeholder="Enter value"
                        value={localCustom[c.name] || ''}
                        onChange={e => setLocalCustom(prev => ({ ...prev, [c.name]: e.target.value }))}
                        style={{ width: 130, fontSize: '0.8rem' }} />
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 80 }}>
                      {strat === 'Mean' && `→ ${c.mean?.toFixed(3)}`}
                      {strat === 'Median' && `→ ${c.median?.toFixed(3) ?? '?'}`}
                      {strat === 'Skip' && '→ unchanged'}
                    </div>
                    {/* Distribution warning if imputing >5% shift */}
                    {strat !== 'Skip' && c.nullCount / c.totalCount > 0.2 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-amber)', fontSize: '0.72rem' }}>
                        <AlertTriangle size={12} /> High null rate — may alter distribution
                      </div>
                    )}
                  </div>
                  <InteractiveDataRow datasetId={activeId} column={c} strat={strat} customValue={localCustom[c.name]} />
                </div>
              );
            })}
          </div>

          <button className="btn-primary" onClick={handleApply} disabled={isPending} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Applying...</> : <><Beaker size={15} /> Apply Imputation & Save New Version</>}
          </button>
        </>
      )}
    </div>
  );
}
