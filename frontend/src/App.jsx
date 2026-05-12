import { useSelector, useDispatch } from 'react-redux';
import { setActiveModule } from './store/slices/uiSlice';
import { clearNotification } from './store/slices/uiSlice';
import Sidebar from './components/layout/Sidebar';
import DatasetManager from './pages/DatasetManager';
import MeanImputation from './pages/MeanImputation';
import ZScoreNorm from './pages/ZScoreNorm';
import BoxPlotIQR from './pages/BoxPlotIQR';
import PairedTTest from './pages/PairedTTest';
import PearsonCorr from './pages/PearsonCorr';
import SpearmanCorr from './pages/SpearmanCorr';
import CorrelationExplorer from './pages/CorrelationExplorer';
import SimpleRegression from './pages/SimpleRegression';
import MultipleRegression from './pages/MultipleRegression';
import Notification from './components/ui/Notification';
import { useEffect } from 'react';

const MODULE_COMPONENTS = {
  datasets: DatasetManager,
  imputation: MeanImputation,
  normalization: ZScoreNorm,
  boxplot: BoxPlotIQR,
  ttest: PairedTTest,
  pearson: PearsonCorr,
  spearman: SpearmanCorr,
  explorer: CorrelationExplorer,
  regression: SimpleRegression,
  multiregression: MultipleRegression,
};

export default function App() {
  const dispatch = useDispatch();
  const { activeModule, notification, theme } = useSelector(s => s.ui);

  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => dispatch(clearNotification()), 4000);
      return () => clearTimeout(t);
    }
  }, [notification, dispatch]);

  const ActivePage = MODULE_COMPONENTS[activeModule] || DatasetManager;

  return (
    <div className={theme === 'dark' ? 'dark-theme' : ''} style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <ActivePage />
      </main>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          key={notification.id}
        />
      )}
    </div>
  );
}
