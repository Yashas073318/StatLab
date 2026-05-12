import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { statsApi } from '../api';
import { setRegressionField, setRegressionResult } from '../store/slices/statsSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { LineChart, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, ReferenceLine } from 'recharts';

function RSquaredGauge({ r2 }) {
  if (r2 === null || r2 === undefined) return null;
  const pct = Math.min(r2, 1);
  const [label, color] = r2 < 0.3 ? ['Poor', 'var(--accent-rose)']
    : r2 < 0.6 ? ['Moderate', 'var(--accent-amber)']
      : r2 < 0.8 ? ['Good', 'var(--accent-blue)']
        : ['Excellent', 'var(--accent-emerald)'];
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={160} height={90} viewBox="0 0 160 90">
        <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} strokeLinecap="round" />
        <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${pct * 219.9} 219.9`} opacity={0.8} />
        <text x={80} y={75} textAnchor="middle" fontSize={22} fontWeight={900} fill={color} fontFamily="JetBrains Mono, monospace">{(r2 * 100).toFixed(1)}%</text>
      </svg>
      <div style={{ fontWeight: 700, color, marginTop: -4 }}>{label}</div>
    </div>
  );
}

export default function SimpleRegression() {
  const dispatch = useDispatch();
  const { activeId, activeDataset } = useSelector(s => s.datasets);
  const { regression } = useSelector(s => s.stats);
  const { xCol, yCol, result, predictionInput, showResiduals } = regression;
  const [showAnim, setShowAnim] = useState(false);
  const [predX, setPredX] = useState('');
  const [prediction, setPrediction] = useState(null);

  const numericCols = activeDataset?.columns?.filter(c => c.type === 'numeric').map(c => c.name) || [];

  const { mutate: runRegression, isPending } = useMutation({
    mutationFn: (payload) => statsApi.regressionSimple(payload),
    onSuccess: (res) => {
      dispatch(setRegressionResult(res.data));
      dispatch(showNotification({ type: 'success', message: 'Regression fitted!' }));
    },
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  const { mutate: predictPoint, isPending: predPending } = useMutation({
    mutationFn: (payload) => statsApi.regressionPredict(payload),
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

  const set = (key, value) => dispatch(setRegressionField({ key, value }));

  return (
    <div style={{ padding: '2rem' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <LineChart size={22} color="var(--accent-blue)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Simple Linear Regression</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          Simple regression tries to draw the best straight line to predict one outcome from one predictor (y = mx + b).
          The "Actual vs Predicted" plot shows how good the model is; a perfect model would have all points perfectly on the dashed diagonal line.
        </p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        ŷ = β₀ + β₁x &nbsp;&nbsp; β₁ = Σ(xᵢ−x̄)(yᵢ−ȳ) / Σ(xᵢ−x̄)² &nbsp;&nbsp; β₀ = ȳ − β₁x̄
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Regression Builder</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>X (Predictor)</label>
              <select className="select-field" value={xCol} onChange={e => set('xCol', e.target.value)}>
                <option value="">Select predictor...</option>
                {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Y (Outcome)</label>
              <select className="select-field" value={yCol} onChange={e => set('yCol', e.target.value)}>
                <option value="">Select outcome...</option>
                {numericCols.filter(c => c !== xCol).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn-primary" disabled={!xCol || !yCol || isPending}
              onClick={() => runRegression({ datasetId: activeId, xCol, yCol })}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Fitting...</> : 'Fit Regression'}
            </button>
          </div>

          {result && (
            <>
              {/* Coefficient cards */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Coefficients</div>
                {[
                  { name: 'β₀ (Intercept)', value: result.beta0, desc: `Predicted ${yCol} when ${xCol} = 0`, color: 'var(--accent-blue)' },
                  { name: 'β₁ (Slope)', value: result.beta1, desc: `For each 1-unit ↑ in ${xCol}, ${yCol} changes by ${result.beta1?.toFixed(4)}`, color: 'var(--accent-violet)' },
                ].map(({ name, value, desc, color }) => (
                  <div key={name} style={{ padding: '0.75rem', background: `${color}0d`, borderRadius: 10, marginBottom: 8, borderLeft: `3px solid ${color}` }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color }}>{value?.toFixed(4)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Prediction */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Make a Prediction</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Enter {xCol} value</label>
                  <input className="input-field" type="number" placeholder={`${xCol} = ?`} value={predX} onChange={e => setPredX(e.target.value)} />
                </div>
                <button className="btn-secondary" disabled={!predX || predPending}
                  onClick={() => predictPoint({ beta0: result.beta0, beta1: result.beta1, xValue: parseFloat(predX), n: result.n, mse: result.mse })}
                  style={{ width: '100%', fontSize: '0.8rem' }}>
                  {predPending ? 'Predicting...' : 'Predict ŷ'}
                </button>
                {prediction && (
                  <div style={{ marginTop: 10, padding: '0.75rem', background: 'rgba(99,130,255,0.06)', borderRadius: 8 }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>ŷ = {prediction.yHat?.toFixed(4)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      95% CI: [{prediction.ciLower?.toFixed(3)}, {prediction.ciUpper?.toFixed(3)}]
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Results panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {result ? (
            <>
              {/* R² + key stats */}
              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <RSquaredGauge r2={result.rSquared} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', flex: 1 }}>
                  {[
                    ['R²', result.rSquared?.toFixed(4), 'var(--accent-blue)'],
                    ['F-statistic', result.fStat?.toFixed(2), 'var(--accent-violet)'],
                    ['p-value (F)', result.pValue?.toFixed(4), result.pValue < 0.05 ? 'var(--accent-emerald)' : 'var(--accent-amber)'],
                    ['n (observations)', result.n, 'var(--text-secondary)'],
                    ['MSE', result.mse?.toFixed(4), 'var(--text-secondary)'],
                    ['RMSE', result.rmse?.toFixed(4), 'var(--text-secondary)'],
                  ].map(([k, v, c]) => (
                    <div key={k} className="stat-card" style={{ borderTop: `2px solid ${c}` }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: c, fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scatter + regression line */}
              {result.points && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Scatter Plot with Fitted Line &nbsp;
                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                      ŷ = {result.beta0?.toFixed(3)} + {result.beta1?.toFixed(3)}x
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid stroke="rgba(99,130,255,0.06)" />
                      <XAxis dataKey="x" type="number" name={xCol} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: xCol, position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 11 }} />
                      <YAxis type="number" name={yCol} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
                      <Scatter data={result.points} fill="rgba(99,130,255,0.5)" />
                      {result.regressionLine && <Line data={result.regressionLine} type="monotone" dataKey="y" stroke="var(--accent-emerald)" strokeWidth={2.5} dot={false} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Residual plot */}
              {result.residuals && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Residual Plot (ê vs ŷ)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid stroke="rgba(99,130,255,0.06)" />
                      <XAxis dataKey="fitted" type="number" name="Fitted" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} label={{ value: 'Fitted values (ŷ)', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 10 }} />
                      <YAxis dataKey="residual" type="number" name="Residual" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
                      <ReferenceLine y={0} stroke="rgba(99,130,255,0.4)" strokeDasharray="4 2" />
                      <Scatter data={result.residuals} fill={(d) => d.isOutlier ? '#f43f5e' : 'rgba(99,130,255,0.5)'} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Assumptions checker */}
              {result.assumptions && (
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Assumptions Checker</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {result.assumptions.map(a => {
                      const color = a.status === 'pass' ? 'var(--accent-emerald)' : a.status === 'warn' ? 'var(--accent-amber)' : 'var(--accent-rose)';
                      const icon = a.status === 'pass' ? '✓' : a.status === 'warn' ? '⚠' : '✗';
                      return (
                        <div key={a.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.65rem', background: `${color}0d`, borderRadius: 8, border: `1px solid ${color}25` }}>
                          <span style={{ fontWeight: 900, color, fontSize: '0.9rem', lineHeight: 1 }}>{icon}</span>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color }}>{a.name}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{a.detail}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <LineChart size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Select X and Y columns, then fit the regression</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
