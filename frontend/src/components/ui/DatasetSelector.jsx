import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { datasetsApi } from '../../api';
import { setActiveId, setActiveDataset } from '../../store/slices/datasetSlice';
import { Database, ChevronDown, Check, X, Search, FileJson } from 'lucide-react';

export default function DatasetSelector() {
  const dispatch = useDispatch();
  const { activeId, activeDataset } = useSelector(s => s.datasets);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsApi.list(),
    select: r => r.data,
  });

  const datasets = data?.datasets || [];
  const filteredDatasets = datasets.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (dataset) => {
    if (!dataset) {
      dispatch(setActiveId(null));
      dispatch(setActiveDataset(null));
    } else {
      dispatch(setActiveId(dataset._id));
      dispatch(setActiveDataset(dataset));
    }
    setIsOpen(false);
  };

  if (isLoading || datasets.length === 0) return null;

  return (
    <div ref={dropdownRef} style={{
      position: 'absolute',
      top: '1.5rem',
      right: '2rem',
      zIndex: 100,
    }}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          padding: '0.6rem 1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          minWidth: '220px',
          textAlign: 'left'
        }}
        className="glass-card-hover"
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: activeDataset ? 'rgba(99, 130, 255, 0.15)' : 'rgba(148, 163, 184, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: activeDataset ? 'var(--accent-blue)' : 'var(--text-muted)'
        }}>
          <Database size={16} />
        </div>
        
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            {activeDataset ? 'Active Dataset' : 'Dataset'}
          </div>
          <div style={{ 
            fontSize: '0.85rem', 
            fontWeight: 600, 
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {activeDataset ? activeDataset.name : 'Select Dataset...'}
          </div>
        </div>

        <ChevronDown 
          size={16} 
          color="var(--text-muted)" 
          style={{ 
            transition: 'transform 0.3s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '300px',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
          padding: '0.75rem',
          animation: 'fadeIn 0.2s ease-out',
          backdropFilter: 'blur(20px)'
        }}>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search datasets..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.5rem 0.5rem 0.5rem 2rem',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Clear selection option */}
            <div 
              onClick={() => handleSelect(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                color: 'var(--accent-rose)'
              }}
              className="nav-item"
            >
              <X size={14} />
              <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Clear Selection</span>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

            {filteredDatasets.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No datasets found
              </div>
            ) : (
              filteredDatasets.map(d => (
                <div 
                  key={d._id}
                  onClick={() => handleSelect(d)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: d._id === activeId ? 'rgba(99, 130, 255, 0.08)' : 'transparent',
                    border: d._id === activeId ? '1px solid rgba(99, 130, 255, 0.2)' : '1px solid transparent'
                  }}
                  className="nav-item"
                >
                  <FileJson size={14} color={d._id === activeId ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: d._id === activeId ? 600 : 500,
                      color: d._id === activeId ? 'var(--accent-blue)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {d.name}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {d.rowCount} rows · {d.status}
                    </div>
                  </div>
                  {d._id === activeId && <Check size={14} color="var(--accent-blue)" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
