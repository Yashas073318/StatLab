import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { datasetsApi } from '../../api';
import { setActiveId, setActiveDataset } from '../../store/slices/datasetSlice';
import { Database } from 'lucide-react';

export default function DatasetSelector() {
  const dispatch = useDispatch();
  const { activeId } = useSelector(s => s.datasets);

  const { data, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsApi.list(),
    select: r => r.data,
  });

  const datasets = data?.datasets || [];

  const handleSelect = (e) => {
    const id = e.target.value;
    if (!id) return;
    const selected = datasets.find(d => d._id === id);
    if (selected) {
      dispatch(setActiveId(id));
      dispatch(setActiveDataset(selected));
    }
  };

  if (isLoading || datasets.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '1.75rem',
      right: '2rem',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(10px)',
      padding: '0.4rem 0.75rem',
      borderRadius: '10px',
      border: '1px solid var(--border-subtle)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    }}>
      <Database size={14} color="var(--accent-blue)" />
      <select
        value={activeId || ''}
        onChange={handleSelect}
        className="select-field"
        style={{
          border: 'none',
          background: 'transparent',
          padding: '0 1.5rem 0 0',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          boxShadow: 'none',
          minWidth: '150px'
        }}
      >
        <option value="" disabled>Select a dataset...</option>
        {datasets.map(d => (
          <option key={d._id} value={d._id}>
            {d.name} {d.status === 'cleaned' ? '(Cleaned)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
