import { useSelector, useDispatch } from 'react-redux';
import { setActiveModule, openUploadModal, toggleTheme, toggleSidebar } from '../../store/slices/uiSlice';
import {
  Database, Upload, Beaker, BarChart2, TrendingUp, GitCompare,
  Sigma, PieChart, LineChart, Activity, ChevronLeft, ChevronRight,
  FlaskConical, BookOpen, Sun, Moon,
} from 'lucide-react';

const SECTIONS = [
  {
    label: 'Data',
    items: [
      { id: 'datasets', icon: Database, label: 'Dataset Manager' },
    ],
  },
  {
    label: 'Cleaning',
    items: [
      { id: 'imputation', icon: Beaker, label: 'Central Tendencies' },
      { id: 'normalization', icon: Sigma, label: 'Z-Score Norm' },
      { id: 'boxplot', icon: BarChart2, label: 'Box Plot & IQR' },
    ],
  },
  {
    label: 'Statistics',
    items: [
      { id: 'ttest', icon: Activity, label: 'Paired T-Test' },
      { id: 'pearson', icon: TrendingUp, label: 'Pearson Corr.' },
      { id: 'spearman', icon: GitCompare, label: 'Spearman Corr.' },
      { id: 'explorer', icon: BookOpen, label: 'Corr. Explorer' },
    ],
  },
  {
    label: 'Regression',
    items: [
      { id: 'regression', icon: LineChart, label: 'Simple Regression' },
      { id: 'multiregression', icon: PieChart, label: 'Multiple Regression' },
    ],
  },
];

export default function Sidebar() {
  const dispatch = useDispatch();
  const { activeModule, sidebarOpen, theme } = useSelector(s => s.ui);

  return (
    <aside style={{
      width: sidebarOpen ? 240 : 64,
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0,
      overflow: 'hidden',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '1.25rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99,130,255,0.4)',
        }}>
          <FlaskConical size={18} color="white" />
        </div>
        {sidebarOpen && (
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Stat<span style={{ color: 'var(--accent-blue)' }}>Lab</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Statistical Platform
            </div>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div style={{ padding: '0.75rem' }}>
        <button
          className="btn-primary"
          onClick={() => dispatch(openUploadModal())}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: sidebarOpen ? 'flex-start' : 'center' }}
        >
          <Upload size={15} />
          {sidebarOpen && 'Upload Dataset'}
        </button>
      </div>

      {/* Nav sections */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', overflowY: 'auto' }}>
        {SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: '0.5rem' }}>
            {sidebarOpen && (
              <div style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-muted)',
                padding: '0.5rem 0.25rem 0.3rem', marginTop: '0.5rem',
              }}>
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <a
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => dispatch(setActiveModule(item.id))}
                  style={{ justifyContent: sidebarOpen ? 'flex-start' : 'center', marginBottom: 2 }}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {sidebarOpen && (
                    <span style={{ flex: 1, fontSize: '0.8125rem' }}>{item.label}</span>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer toggles */}
      <div style={{ display: 'flex', flexDirection: sidebarOpen ? 'row' : 'column', gap: 8, padding: '0.75rem' }}>
        <button
          onClick={() => dispatch(toggleTheme())}
          style={{
            flex: 1,
            background: 'rgba(99,130,255,0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '0.5rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          onClick={() => dispatch(toggleSidebar())}
          style={{
            flex: 1,
            background: 'rgba(99,130,255,0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '0.5rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </aside>
  );
}
