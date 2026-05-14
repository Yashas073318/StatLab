import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { datasetsApi } from '../api';
import { setActiveId, setActiveDataset, removeDataset } from '../store/slices/datasetSlice';
import { openUploadModal, showNotification, toggleTheme } from '../store/slices/uiSlice';
import UploadModal from '../components/ui/UploadModal';
import { Database, Eye, Trash2, RefreshCw, ChevronLeft, ChevronRight, BarChart, Upload, Search, Sun, Moon } from 'lucide-react';

const TYPE_COLORS = { numeric: 'badge-blue', categorical: 'badge-violet', datetime: 'badge-cyan', unknown: 'badge-amber' };

export default function DatasetManager() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const { uploadModalOpen, theme } = useSelector(s => s.ui);
  const { activeId } = useSelector(s => s.datasets);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: listData, isLoading: listLoading, refetch } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsApi.list(),
    select: r => r.data,
  });

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['dataset', activeId, 'preview', page],
    queryFn: () => datasetsApi.preview(activeId, page),
    enabled: !!activeId,
    select: r => r.data,
    staleTime: Infinity,
  });

  const { mutate: deleteDataset } = useMutation({
    mutationFn: (id) => datasetsApi.remove(id),
    onSuccess: (_, id) => {
      dispatch(removeDataset(id));
      qc.invalidateQueries({ queryKey: ['datasets'] });
      dispatch(showNotification({ type: 'success', message: 'Dataset deleted.' }));
    },
  });

  const datasets = listData?.datasets || [];
  const filtered = datasets.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()));
  const activeDs = datasets.find(d => d._id === activeId);

  return (
    <div style={{ padding: '2rem' }}>
      {uploadModalOpen && <UploadModal />}
      <div className="module-header" style={{ margin: '-2rem -2rem 2rem', padding: '1.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Database size={22} color="var(--accent-blue)" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Dataset Manager</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Upload CSV/JSON datasets and preview raw data before analysis.
          </p>
        </div>
        <button
          onClick={() => dispatch(toggleTheme())}
          className="btn-ghost"
          style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Dataset list */}
        <div className="glass-card" style={{ padding: '1rem', minHeight: '400px' }} onClick={() => {
          dispatch(setActiveId(null));
          dispatch(setActiveDataset(null));
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Datasets ({filtered.length})</span>
            <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><RefreshCw size={14} /></button>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }} onClick={e => e.stopPropagation()}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input-field" placeholder="Search datasets..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, fontSize: '0.8rem' }} />
          </div>
          <button className="btn-primary" onClick={(e) => { e.stopPropagation(); dispatch(openUploadModal()); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
            <Upload size={14} /> Upload New
          </button>
          {listLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Database size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <div>No datasets yet. Upload one to start.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(d => (
                <div key={d._id} onClick={(e) => { e.stopPropagation(); dispatch(setActiveId(d._id)); dispatch(setActiveDataset(d)); }}
                  style={{ padding: '0.75rem', borderRadius: 10, border: `1px solid ${d._id === activeId ? 'rgba(99,130,255,0.4)' : 'var(--border-subtle)'}`, background: d._id === activeId ? 'rgba(99,130,255,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{d.rowCount?.toLocaleString()} rows · {d.columnCount} cols</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span className={`tag ${d.status === 'cleaned' ? 'tag-cleaned' : 'tag-raw'}`}>{d.status}</span>
                      <button onClick={e => { e.stopPropagation(); deleteDataset(d._id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        {activeId ? (
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', alignItems: 'center' }}>
              <div className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={14} /> Data Preview
              </div>
              {activeDs && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeDs.name}</span>
                <span className={`tag ${activeDs.status === 'cleaned' ? 'tag-cleaned' : 'tag-raw'}`}>{activeDs.status}</span>
              </div>}
            </div>
            
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              {previewLoading ? (
                <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
              ) : previewData ? (
                <>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead><tr><th style={{ width: 48 }}>#</th>{previewData.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>
                        {previewData.rows.map((row, ri) => (
                          <tr key={ri}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{(page - 1) * 10 + ri + 1}</td>
                            {previewData.columns.map(col => (
                              <td key={col} className={row[col] === null || row[col] === '' || row[col] === undefined ? 'cell-null' : ''}>
                                {row[col] === null || row[col] === undefined || row[col] === '' ? 'null' : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Page {page} of {previewData.totalPages} · {previewData.totalRows?.toLocaleString()} rows</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.35rem 0.75rem' }}><ChevronLeft size={14} /></button>
                      <button className="btn-ghost" disabled={page >= previewData.totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '0.35rem 0.75rem' }}><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </>
              ) : <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No preview available</div>}
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <Database size={48} style={{ color: 'var(--accent-blue)', opacity: 0.4, marginBottom: 16 }} />
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>No dataset selected</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360, margin: '0 auto 1.5rem' }}>Upload a dataset or select one from the list to start.</p>
            <button className="btn-primary" onClick={() => dispatch(openUploadModal())} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Upload size={15} /> Upload Dataset</button>
          </div>
        )}
      </div>
    </div >
  );
}
