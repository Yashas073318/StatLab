import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { statsApi } from '../api';
import { setRegressionField, setMultipleResult, setStepwiseResult, addSavedModel } from '../store/slices/statsSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { PieChart, Info, AlertTriangle, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function VIFIndicator({ vif }) {
  if (!vif) return null;
  const [label, cls] = vif > 10 ? ['Severe', 'vif-severe'] : vif > 5 ? ['Moderate', 'vif-warn'] : ['OK', 'vif-ok'];
  return <span className={cls} style={{ fontFamily: 'monospace', fontWeight: 700 }}>{vif.toFixed(2)} <span style={{ fontWeight: 400, fontSize: '0.7rem' }}>({label})</span></span>;
}

function SignificanceStars({ p }) {
  if (p < 0.001) return <span style={{ color: 'var(--accent-emerald)' }}>***</span>;
  if (p < 0.01) return <span style={{ color: 'var(--accent-emerald)' }}>**</span>;
  if (p < 0.05) return <span style={{ color: 'var(--accent-blue)' }}>*</span>;
  return <span style={{ color: 'var(--text-muted)' }}>ns</span>;
}

export default function MultipleRegression() {
  const dispatch = useDispatch();
  const { activeId, activeDataset } = useSelector(s => s.datasets);
  const { regression } = useSelector(s => s.stats);
  const { multiplePredictors, multipleResult, stepwiseResult, savedModels } = regression;
  const [yCol, setYCol] = useState('');
  const [predValues, setPredValues] = useState({});
  const [prediction, setPrediction] = useState(null);

  const numericCols = activeDataset?.columns?.filter(c => c.type === 'numeric').map(c => c.name) || [];

  const { mutate: runMultiple, isPending } = useMutation({
    mutationFn: (payload) => statsApi.regressionMultiple(payload),
    onSuccess: (res) => {
      dispatch(setMultipleResult(res.data));
      dispatch(addSavedModel({ id: Date.now(), predictors: multiplePredictors, y: yCol, rSquared: res.data.rSquared, adjRSquared: res.data.adjRSquared, aic: res.data.aic }));
      dispatch(showNotification({ type: 'success', message: 'Multiple regression fitted!' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  const { mutate: runStepwise, isPending: stepPending } = useMutation({
    mutationFn: (payload) => statsApi.regressionStepwise(payload),
    onSuccess: (res) => {
      dispatch(setStepwiseResult(res.data));
      dispatch(showNotification({ type: 'success', message: 'Stepwise selection complete!' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  const { mutate: predictMultiple, isPending: predPending } = useMutation({
    mutationFn: (payload) => statsApi.regressionPredictMultiple(payload),
    onSuccess: (res) => setPrediction(res.data),
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

  const togglePredictor = (c) => {
    dispatch(setRegressionField({ key: 'multiplePredictors', value: multiplePredictors.includes(c) ? multiplePredictors.filter(x => x !== c) : [...multiplePredictors, c] }));
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1300, margin: '0 auto' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <PieChart size={22} color="var(--accent-amber)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Multiple Linear Regression</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Multiple regression uses several predictors at once to make a prediction. 
          Each coefficient (β) tells you the effect of that specific variable while holding all others constant. 
          <strong style={{ color: 'var(--accent-amber)' }}> Tip:</strong> Use the "Auto" (Stepwise) feature to automatically find the best combination of predictors.
        </p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        ŷ = β₀ + β₁x₁ + β₂x₂ + ... + βₖxₖ
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Model Setup</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Outcome Variable (Y)</label>
              <select className="select-field" value={yCol} onChange={e => setYCol(e.target.value)}>
                <option value="">Select Y...</option>
                {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Predictors (X₁, X₂, ...)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
                {numericCols.filter(c => c !== yCol).map(c => {
                  const sel = multiplePredictors.includes(c);
                  return (
                    <div key={c} onClick={() => togglePredictor(c)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      padding: '0.4rem 0.6rem', borderRadius: 8,
                      background: sel ? 'rgba(245,158,11,0.08)' : 'transparent',
                      border: `1px solid ${sel ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? 'var(--accent-amber)' : 'var(--border-subtle)'}`, background: sel ? 'var(--accent-amber)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <span style={{ color: '#000', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button className="btn-primary" disabled={!yCol || multiplePredictors.length === 0 || isPending}
                onClick={() => runMultiple({ datasetId: activeId, xCols: multiplePredictors, yCol })}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Fitting...</> : 'Fit Model'}
              </button>
              <button className="btn-secondary" disabled={!yCol || stepPending}
                onClick={() => runStepwise({ datasetId: activeId, candidateCols: numericCols.filter(c => c !== yCol), yCol })}
                style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Star size={12} /> Auto
              </button>
            </div>
          </div>

          {/* Stepwise result */}
          {stepwiseResult && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={14} color="var(--accent-amber)" /> Suggested Predictors
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {stepwiseResult.ranked?.map((item, i) => (
                  <div key={item.col} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', borderRadius: 6, background: i === 0 ? 'rgba(245,158,11,0.08)' : 'transparent' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>#{i + 1} {item.col}</span>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--accent-amber)' }}>+ΔR²={item.rSquaredGain?.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model comparison */}
          {savedModels.length > 1 && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Model Comparison</div>
              <table className="data-table">
                <thead><tr><th>Predictors</th><th>R²</th><th>Adj. R²</th><th>AIC</th></tr></thead>
                <tbody>
                  {savedModels.map((m, i) => (
                    <tr key={m.id}>
                      <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem' }}>{m.predictors.join(', ')}</td>
                      <td style={{ fontFamily: 'monospace' }}>{m.rSquared?.toFixed(3)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{m.adjRSquared?.toFixed(3)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{m.aic?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {multipleResult ? (
            <>
              {/* R² vs Adj R² */}
              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { label: 'R²', value: multipleResult.rSquared, color: 'var(--accent-blue)', desc: 'Variance explained' },
                  { label: 'Adjusted R²', value: multipleResult.adjRSquared, color: 'var(--accent-violet)', desc: 'Penalizes extra predictors' },
                  { label: 'AIC', value: multipleResult.aic?.toFixed(1), color: 'var(--text-secondary)', desc: 'Lower = better fit' },
                  { label: 'F-statistic', value: multipleResult.fStat?.toFixed(2), color: 'var(--accent-emerald)', desc: 'Model significance' },
                ].map(({ label, value, color, desc }) => (
                  <div key={label} style={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>{typeof value === 'number' ? value.toFixed(4) : value}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Coefficient table */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Coefficient Table</div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Variable</th><th>β</th><th>Std Error</th><th>t-stat</th><th>p-value</th><th>Sig.</th><th>VIF</th></tr></thead>
                    <tbody>
                      {multipleResult.coefficients?.map(c => (
                        <tr key={c.col} style={{ opacity: c.pValue > 0.05 ? 0.55 : 1 }}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.col}</td>
                          <td style={{ fontFamily: 'monospace', color: c.beta > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{c.beta?.toFixed(4)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{c.stdErr?.toFixed(4)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{c.tStat?.toFixed(4)}</td>
                          <td style={{ fontFamily: 'monospace', color: c.pValue < 0.05 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{c.pValue?.toFixed(4)}</td>
                          <td><SignificanceStars p={c.pValue} /></td>
                          <td><VIFIndicator vif={multipleResult.vif?.[c.col]} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>Rows with p &gt; 0.05 are dimmed — statistically not significant</div>
              </div>

              {/* Feature importance chart */}
              {multipleResult.standardizedBetas && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Feature Importance (Standardized β)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart layout="vertical" data={multipleResult.standardizedBetas} margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(99,130,255,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis type="category" dataKey="col" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={70} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="beta" radius={[0, 4, 4, 0]}>
                        {multipleResult.standardizedBetas.map((entry, i) => (
                          <Cell key={i} fill={entry.beta > 0 ? 'rgba(16,185,129,0.7)' : 'rgba(244,63,94,0.7)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Prediction form */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Make a Prediction</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
                  {multiplePredictors.map(col => (
                    <div key={col}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{col}</label>
                      <input className="input-field" type="number" placeholder={`${col} = ?`}
                        value={predValues[col] || ''} onChange={e => setPredValues(prev => ({ ...prev, [col]: e.target.value }))}
                        style={{ fontSize: '0.8rem' }} />
                    </div>
                  ))}
                </div>
                <button className="btn-secondary" disabled={predPending}
                  onClick={() => predictMultiple({ coefficients: multipleResult.coefficients, xValues: predValues })}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {predPending ? 'Predicting...' : 'Predict ŷ'}
                </button>
                {prediction && (
                  <div style={{ marginTop: 10, padding: '0.75rem', background: 'rgba(99,130,255,0.06)', borderRadius: 8 }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>ŷ = {prediction.yHat?.toFixed(4)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>95% CI: [{prediction.ciLower?.toFixed(3)}, {prediction.ciUpper?.toFixed(3)}]</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <PieChart size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Select predictors and outcome, then fit the model</div>
              <div style={{ fontSize: '0.8rem' }}>You can also use "Auto" to run stepwise selection</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
