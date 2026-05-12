import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cleanApi, statsApi, datasetsApi } from '../api';
import { setNormalizationCols } from '../store/slices/cleaningSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { addDataset } from '../store/slices/datasetSlice';
import { BarChart, ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Sigma, Info, Download } from 'lucide-react';

function DistributionPreview({ columnProfile, threshold }) {
  if (!columnProfile || !columnProfile.histogram) return null;
  
  const { min, max, mean, std, histogram } = columnProfile;
  const binSize = (max - min) / 10;
  
  const data = histogram.map((count, i) => {
    const binStart = min + i * binSize;
    const binEnd = min + (i + 1) * binSize;
    const binCenter = binStart + (binSize / 2);
    const zScore = std > 0 ? (binCenter - mean) / std : 0;
    
    return {
      bin: `${binStart.toFixed(1)} - ${binEnd.toFixed(1)}`,
      count,
      zScore: parseFloat(zScore.toFixed(2)),
      isOutlier: Math.abs(zScore) > threshold
    };
  });

  return (
    <div className="glass-card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        Distribution: {columnProfile.name}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Visualizing the Z-Score transformation. Red bins indicate potential outliers (|z| &gt; {threshold}).
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
          <XAxis dataKey="zScore" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
          <Tooltip 
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => [value, name === 'count' ? 'Frequency' : name]}
            labelFormatter={(label) => `Z-Score: ${label}`}
          />
          <ReferenceLine x={0} stroke="var(--accent-cyan)" strokeDasharray="3 3" label={{ position: 'top', value: 'Mean (z=0)', fill: 'var(--accent-cyan)', fontSize: 10 }} />
          <ReferenceLine x={-threshold} stroke="var(--accent-rose)" strokeDasharray="3 3" />
          <ReferenceLine x={threshold} stroke="var(--accent-rose)" strokeDasharray="3 3" />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isOutlier ? 'var(--accent-rose)' : 'var(--accent-cyan)'} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ZScoreNorm() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { activeId } = useSelector(s => s.datasets);
  const { normalizationCols } = useSelector(s => s.cleaning);
  const [outlierThreshold, setOutlierThreshold] = useState(3);

  const { data: profileData } = useQuery({
    queryKey: ['dataset', activeId, 'profile'],
    queryFn: () => datasetsApi.profile(activeId),
    enabled: !!activeId,
    select: r => r.data,
  });

  const { mutate: normalize, isPending } = useMutation({
    mutationFn: (payload) => cleanApi.normalize(payload),
    onSuccess: (res) => {
      dispatch(addDataset(res.data.dataset));
      qc.invalidateQueries({ queryKey: ['datasets'] });
      dispatch(showNotification({ type: 'success', message: 'Z-Score normalization applied!' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  const { data: outlierData } = useQuery({
    queryKey: ['outliers', activeId, normalizationCols, outlierThreshold],
    queryFn: () => cleanApi.nullMap(activeId),
    enabled: !!activeId && normalizationCols.length > 0,
    select: r => r.data,
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

  const numericCols = profileData?.columns?.filter(c => c.type === 'numeric') || [];

  const toggleCol = (name) => {
    dispatch(setNormalizationCols(
      normalizationCols.includes(name)
        ? normalizationCols.filter(c => c !== name)
        : [...normalizationCols, name]
    ));
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Sigma size={22} color="var(--accent-cyan)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Z-Score Normalization</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Z-score normalization (standardization) transforms any distribution so that it has a mean of 0 and a standard deviation of 1. 
          It makes variables on completely different scales comparable, which is <strong style={{ color: 'var(--accent-cyan)' }}>critical before using distance-based algorithms like KNN, PCA, or SVM.</strong>
        </p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        z = (x − μ) / σ &nbsp;&nbsp; where μ = column mean, σ = column std
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Left Column wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Column selector */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Select Numeric Columns</div>
            {numericCols.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No numeric columns found. Load a dataset first.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {numericCols.map(c => {
                  const selected = normalizationCols.includes(c.name);
                  return (
                    <div key={c.name} onClick={() => toggleCol(c.name)} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.65rem 0.875rem', borderRadius: 10,
                      border: `1px solid ${selected ? 'rgba(34,211,238,0.4)' : 'var(--border-subtle)'}`,
                      background: selected ? 'rgba(34,211,238,0.06)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>μ={c.mean?.toFixed(3)} σ={c.std?.toFixed(3)}</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${selected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`, background: selected ? 'var(--accent-cyan)' : 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selected && <span style={{ color: '#000', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {normalizationCols.length > 0 && (
            <DistributionPreview 
              columnProfile={numericCols.find(c => c.name === normalizationCols[normalizationCols.length - 1])} 
              threshold={outlierThreshold} 
            />
          )}
        </div>

        {/* Outlier config + apply */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Outlier Detection (Post-Normalization)</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Z-Score Threshold</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[2, 2.5, 3, 3.5].map(t => (
                  <button key={t} className={outlierThreshold === t ? 'btn-secondary' : 'btn-ghost'}
                    onClick={() => setOutlierThreshold(t)}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}>
                    |z| {'>'} {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '0.75rem', background: 'rgba(99,130,255,0.06)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Rows where |z| {'>'} {outlierThreshold} will be flagged as statistical outliers after normalization.
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Selected: {normalizationCols.length} column{normalizationCols.length !== 1 ? 's' : ''}</div>
            {normalizationCols.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {normalizationCols.map(c => <span key={c} className="badge badge-cyan">{c}</span>)}
              </div>
            )}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Original columns will be preserved with <code style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>_original</code> suffix.
            </div>
            <button className="btn-primary" disabled={!normalizationCols.length || isPending}
              onClick={() => normalize({ datasetId: activeId, columns: normalizationCols })}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Normalizing...</> : <><Sigma size={15} /> Apply Z-Score Normalization</>}
            </button>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Concepts Covered</div>
            {[
              ['Z-score formula', 'z = (x − μ) / σ'],
              ['Standardization', 'Mean becomes 0, std becomes 1'],
              ['Outlier detection', `|z| > ${outlierThreshold} → outlier`],
              ['Inverse transform', 'x = z × σ + μ'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
