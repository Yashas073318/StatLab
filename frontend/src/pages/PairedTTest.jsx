import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { statsApi } from '../api';
import { setTTestField, setTTestResult, toggleTTestSteps } from '../store/slices/statsSlice';
import { showNotification, setActiveModule } from '../store/slices/uiSlice';
import { Activity, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

function TDistCurve({ df, tStat, tail }) {
  if (!df) return null;
  const points = [];
  for (let t = -4; t <= 4; t += 0.1) {
    const x = parseFloat(t.toFixed(2));
    const gamma = (n) => { let r = 1; for (let i = 2; i < n; i++) r *= i; return r; };
    const y = Math.pow(1 + (x * x) / df, -(df + 1) / 2) * 0.4;
    const isRejection = tail === 'two'
      ? Math.abs(x) >= Math.abs(tStat || 0)
      : tail === 'right' ? x >= (tStat || 0) : x <= (tStat || 0);
    points.push({ x, y, rejection: isRejection ? y : 0 });
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <XAxis dataKey="x" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis hide />
        <Tooltip formatter={(v) => v.toFixed(4)} labelFormatter={(l) => `t = ${l}`}
          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="y" stroke="rgba(99,130,255,0.6)" fill="rgba(99,130,255,0.1)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="rejection" stroke="rgba(244,63,94,0.8)" fill="rgba(244,63,94,0.2)" strokeWidth={0} dot={false} />
        {tStat && <ReferenceLine x={tStat} stroke="var(--accent-rose)" strokeWidth={2} strokeDasharray="4 2" label={{ value: `t=${tStat?.toFixed(2)}`, fill: 'var(--accent-rose)', fontSize: 11 }} />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CohensBadge({ d }) {
  if (d === null || d === undefined) return null;
  const abs = Math.abs(d);
  const [label, color] = abs < 0.2 ? ['Negligible', 'var(--text-muted)']
    : abs < 0.5 ? ['Small', 'var(--accent-amber)']
    : abs < 0.8 ? ['Medium', 'var(--accent-blue)']
    : ['Large', 'var(--accent-emerald)'];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 10, background: `${color}18`, border: `1px solid ${color}40` }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cohen's d</span>
      <span style={{ fontWeight: 800, fontFamily: 'monospace', color, fontSize: '1.1rem' }}>{d?.toFixed(3)}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{label} effect</span>
    </div>
  );
}

export default function PairedTTest() {
  const dispatch = useDispatch();
  const { activeId, activeDataset } = useSelector(s => s.datasets);
  const { ttest } = useSelector(s => s.stats);

  const numericCols = activeDataset?.columns?.filter(c => c.type === 'numeric').map(c => c.name) || [];

  const { mutate: runTest, isPending } = useMutation({
    mutationFn: (payload) => statsApi.ttestPaired(payload),
    onSuccess: (res) => {
      dispatch(setTTestResult(res.data));
      dispatch(showNotification({ type: 'success', message: 'Paired t-test completed!' }));
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

  const { col1, col2, alpha, tail, result, showSteps } = ttest;
  const set = (key, value) => dispatch(setTTestField({ key, value }));

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Activity size={22} color="var(--accent-rose)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Paired T-Test</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5, maxWidth: 800 }}>
          The paired t-test compares two measurements taken on the same subject (like a before-and-after test). 
          It tests <strong style={{ color: 'var(--accent-rose)' }}>H₀: mean difference = 0</strong>. 
          By focusing on within-subject differences, it removes natural variations between different subjects, making it much more powerful than a standard independent t-test for these scenarios.
        </p>
      </div>

      <div className="formula-box" style={{ marginBottom: '1.5rem' }}>
        t = d̄ / (s_d / √n) &nbsp;&nbsp; df = n − 1
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem' }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Column Pair Selection</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Column 1 (Before / Group A)</label>
              <select className="select-field" value={col1} onChange={e => set('col1', e.target.value)}>
                <option value="">Select column...</option>
                {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Column 2 (After / Group B)</label>
              <select className="select-field" value={col2} onChange={e => set('col2', e.target.value)}>
                <option value="">Select column...</option>
                {numericCols.filter(c => c !== col1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Test Configuration</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Significance Level α</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0.01, 0.05, 0.10].map(a => (
                  <button key={a} className={alpha === a ? 'btn-secondary' : 'btn-ghost'} style={{ flex: 1, fontSize: '0.78rem', padding: '0.35rem 0' }}
                    onClick={() => set('alpha', a)}>{a}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Test Direction</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['two', 'Two-Tailed'], ['left', 'Left-Tailed'], ['right', 'Right-Tailed']].map(([v, l]) => (
                  <button key={v} className={tail === v ? 'btn-secondary' : 'btn-ghost'} style={{ flex: 1, fontSize: '0.72rem', padding: '0.35rem 0.5rem' }}
                    onClick={() => set('tail', v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <button className="btn-primary" disabled={!col1 || !col2 || isPending}
            onClick={() => runTest({ datasetId: activeId, col1, col2, alpha, tail })}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {isPending ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Running...</> : <><Activity size={15} /> Run Paired T-Test</>}
          </button>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {result ? (
            <>
              {/* Verdict */}
              <div className={result.reject ? 'verdict-reject' : 'verdict-fail'} style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: result.reject ? 'var(--accent-rose)' : 'var(--accent-amber)', marginBottom: 6 }}>
                  {result.reject ? '✗ REJECT H₀' : '✓ FAIL TO REJECT H₀'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {result.reject
                    ? 'There is sufficient evidence to conclude the two conditions produce different results.'
                    : 'There is not sufficient evidence to conclude the two conditions produce different results.'}
                </div>
                <div style={{ marginTop: 10 }}>
                  <CohensBadge d={result.cohensD} />
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  ['t-statistic', result.tStat?.toFixed(4), 'var(--accent-blue)'],
                  ['p-value', result.pValue?.toFixed(4), result.pValue < alpha ? 'var(--accent-rose)' : 'var(--accent-emerald)'],
                  ['Degrees of Freedom', result.df, 'var(--accent-violet)'],
                  ['Mean Difference (d̄)', result.meanDiff?.toFixed(4), 'var(--accent-cyan)'],
                  ['Std of Differences', result.stdDiff?.toFixed(4), 'var(--text-secondary)'],
                  ['Sample Size (n)', result.n, 'var(--text-secondary)'],
                ].map(([k, v, c]) => (
                  <div key={k} className="stat-card" style={{ borderTop: `2px solid ${c}` }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c, fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Distribution curve */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>t-Distribution Curve (df={result.df})</div>
                <TDistCurve df={result.df} tStat={result.tStat} tail={tail} />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                  Red shaded area = rejection region (α={alpha}, {tail}-tailed)
                </div>
              </div>

              {/* Step-by-step */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <button onClick={() => dispatch(toggleTTestSteps())}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}>
                  {showSteps ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Computation Breakdown
                </button>
                {showSteps && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      ['1. Compute differences', `dᵢ = ${col1}ᵢ - ${col2}ᵢ`],
                      ['2. Mean of differences', `d̄ = ${result.meanDiff?.toFixed(4)}`],
                      ['3. Std of differences', `s_d = ${result.stdDiff?.toFixed(4)}`],
                      ['4. t-statistic', `t = ${result.meanDiff?.toFixed(4)} / (${result.stdDiff?.toFixed(4)} / √${result.n}) = ${result.tStat?.toFixed(4)}`],
                      ['5. Degrees of freedom', `df = ${result.n} - 1 = ${result.df}`],
                      ['6. p-value', `p = ${result.pValue?.toFixed(4)} (${result.reject ? '<' : '≥'} α=${alpha} → ${result.reject ? 'Reject' : 'Fail to reject'} H₀)`],
                    ].map(([step, formula]) => (
                      <div key={step} style={{ padding: '0.65rem 0.875rem', background: 'rgba(99,130,255,0.04)', borderRadius: 8, display: 'flex', gap: 12 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 180, flexShrink: 0 }}>{step}</span>
                        <code style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>{formula}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Configure and run the test</div>
              <div style={{ fontSize: '0.8rem' }}>Select two numeric columns and click "Run Paired T-Test"</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
