import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQuery } from '@tanstack/react-query';
import { statsApi } from '../api';
import { setSliderValue, setSyntheticData, updateGuessGame } from '../store/slices/statsSlice';
import { showNotification } from '../store/slices/uiSlice';
import { BookOpen, AlertTriangle, Trophy, RefreshCw } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CORR_TYPES = [
  { label: 'Strong Positive', min: 0.7, color: '#10b981' },
  { label: 'Weak Positive', min: 0.3, color: '#84cc16' },
  { label: 'No Correlation', min: -0.3, color: '#94a3c0' },
  { label: 'Weak Negative', min: -0.7, color: '#f59e0b' },
  { label: 'Strong Negative', min: -1, color: '#f43f5e' },
];

function classifyR(r) {
  if (r >= 0.7) return CORR_TYPES[0];
  if (r >= 0.3) return CORR_TYPES[1];
  if (r >= -0.3) return CORR_TYPES[2];
  if (r >= -0.7) return CORR_TYPES[3];
  return CORR_TYPES[4];
}

export default function CorrelationExplorer() {
  const dispatch = useDispatch();
  const { correlation } = useSelector(s => s.stats);
  const { sliderValue, syntheticData, guessGame } = correlation;
  const [tab, setTab] = useState('playground');

  const { mutate: generateSynthetic, isPending } = useMutation({
    mutationFn: (payload) => statsApi.correlationSynthetic(payload),
    onSuccess: (res) => dispatch(setSyntheticData(res.data)),
    onError: (err) => dispatch(showNotification({ type: 'error', message: err.message })),
  });

  const { data: galleryData } = useQuery({
    queryKey: ['correlationGallery'],
    queryFn: () => statsApi.correlationGallery(),
    select: r => r.data,
    staleTime: Infinity,
  });

  const { mutate: loadGuessRound, isPending: guessPending } = useMutation({
    mutationFn: () => statsApi.correlationSynthetic({ targetR: (Math.random() * 2 - 1).toFixed(2) * 1, n: 80 }),
    onSuccess: (res) => {
      dispatch(updateGuessGame({ current: res.data, answered: false, guess: null }));
      dispatch(setSyntheticData(res.data));
    },
  });

  const handleSlider = (e) => {
    const v = parseFloat(e.target.value);
    dispatch(setSliderValue(v));
    generateSynthetic({ targetR: v, n: 100 });
  };

  const handleGuess = (type) => {
    if (guessGame.answered) return;
    const actualType = classifyR(guessGame.current?.r || 0);
    const correct = type === actualType.label;
    dispatch(updateGuessGame({ answered: true, guess: type, score: guessGame.score + (correct ? 1 : 0), round: guessGame.round + 1 }));
  };

  const cls = classifyR(sliderValue);

  return (
    <div style={{ padding: '2rem' }}>
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <BookOpen size={22} color="var(--accent-amber)" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Correlation Explorer</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Interactive playground to explore positive, negative, and zero correlation visually.</p>
      </div>

      {/* Causation warning */}
      <div className="causation-warning" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle size={16} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <span style={{ fontWeight: 700, color: 'var(--accent-amber)', fontSize: '0.875rem' }}>Correlation ≠ Causation</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> — A high r value only shows association, not cause-and-effect. Classic examples: ice cream sales ↔ drowning deaths (both caused by summer), shoe size ↔ reading ability (both caused by age).</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
        {[['playground', 'Playground'], ['game', 'Guess the Correlation'], ['gallery', 'Pattern Library']].map(([id, label]) => (
          <button key={id} className={tab === id ? 'btn-secondary' : 'btn-ghost'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'playground' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 20 }}>Set Target Correlation</div>
            <input type="range" min="-1" max="1" step="0.05" value={sliderValue}
              onChange={handleSlider}
              style={{ width: '100%', accentColor: cls.color, marginBottom: 12 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: cls.color }}>{sliderValue.toFixed(2)}</div>
              <div style={{ fontWeight: 700, color: cls.color, marginTop: 4 }}>{cls.label}</div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CORR_TYPES.map(ct => (
                <button key={ct.label} onClick={() => { const r = ct.min + 0.1; dispatch(setSliderValue(r)); generateSynthetic({ targetR: r, n: 100 }); }}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${ct.color}40`, background: `${ct.color}10`, color: ct.color, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Scatter Plot {syntheticData?.r !== undefined && `— Actual r = ${syntheticData.r?.toFixed(4)}`}</span>
              {isPending && <div className="spinner" style={{ width: 14, height: 14 }} />}
            </div>
            {syntheticData?.points ? (
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid stroke="rgba(99,130,255,0.06)" />
                  <XAxis dataKey="x" type="number" name="X" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis dataKey="y" type="number" name="Y" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
                  <Scatter data={syntheticData.points} fill={cls.color} opacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Move the slider to generate synthetic data
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'game' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Guess the Correlation Type</div>
              <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
                onClick={() => loadGuessRound()}>
                <RefreshCw size={13} /> New Round
              </button>
            </div>
            {guessGame.current?.points ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid stroke="rgba(99,130,255,0.06)" />
                    <XAxis dataKey="x" type="number" name="X" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis dataKey="y" type="number" name="Y" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8 }} />
                    <Scatter data={guessGame.current.points} fill="rgba(99,130,255,0.6)" />
                  </ScatterChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {CORR_TYPES.map(ct => {
                    const isGuessed = guessGame.guess === ct.label;
                    const isActual = guessGame.answered && classifyR(guessGame.current.r).label === ct.label;
                    return (
                      <button key={ct.label}
                        onClick={() => handleGuess(ct.label)}
                        disabled={guessGame.answered}
                        style={{
                          flex: 1, minWidth: 100, padding: '0.65rem 0.5rem',
                          borderRadius: 10, border: `2px solid ${isActual ? ct.color : isGuessed ? ct.color : 'var(--border-subtle)'}`,
                          background: isActual ? `${ct.color}20` : isGuessed && !guessGame.answered ? `${ct.color}10` : 'transparent',
                          color: isActual || isGuessed ? ct.color : 'var(--text-muted)',
                          fontWeight: 700, fontSize: '0.78rem', cursor: guessGame.answered ? 'default' : 'pointer',
                          transition: 'all 0.2s',
                        }}>
                        {ct.label}
                        {isActual && guessGame.answered && ' ✓'}
                      </button>
                    );
                  })}
                </div>
                {guessGame.answered && (
                  <div style={{ marginTop: 12, padding: '0.75rem', borderRadius: 10, background: guessGame.guess === classifyR(guessGame.current.r).label ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', border: `1px solid ${guessGame.guess === classifyR(guessGame.current.r).label ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}` }}>
                    <div style={{ fontWeight: 700, color: guessGame.guess === classifyR(guessGame.current.r).label ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {guessGame.guess === classifyR(guessGame.current.r).label ? '🎉 Correct!' : '❌ Not quite!'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Actual r = {guessGame.current.r?.toFixed(4)} → {classifyR(guessGame.current.r).label}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 12 }}>
                <Trophy size={40} style={{ opacity: 0.3 }} />
                <button className="btn-primary" onClick={() => loadGuessRound()}>Start Game</button>
              </div>
            )}
          </div>
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>Score</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{guessGame.score}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>correct of {guessGame.round} rounds</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accuracy</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontFamily: 'monospace' }}>
                  {guessGame.round > 0 ? Math.round((guessGame.score / guessGame.round) * 100) : 0}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${guessGame.round > 0 ? (guessGame.score / guessGame.round) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'gallery' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {galleryData?.examples ? galleryData.examples.map((ex, i) => (
            <div key={i} className="glass-card glass-card-hover" style={{ padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 4 }}>{ex.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10 }}>{ex.description}</div>
              <ResponsiveContainer width="100%" height={120}>
                <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis dataKey="x" type="number" hide />
                  <YAxis dataKey="y" type="number" hide />
                  <Scatter data={ex.points} fill={classifyR(ex.r).color} opacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>r = {ex.r?.toFixed(3)}</span>
                <span style={{ fontSize: '0.7rem', color: classifyR(ex.r).color, fontWeight: 600 }}>{classifyR(ex.r).label}</span>
              </div>
            </div>
          )) : (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Gallery examples will appear here from the backend.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
