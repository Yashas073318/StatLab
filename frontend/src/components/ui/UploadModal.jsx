import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDispatch } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { datasetsApi } from '../../api';
import { addDataset, setUploadProgress, setUploadStatus } from '../../store/slices/datasetSlice';
import { closeUploadModal, showNotification } from '../../store/slices/uiSlice';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

export default function UploadModal() {
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const { mutate, isPending } = useMutation({
    mutationFn: (formData) => datasetsApi.upload(formData),
    onSuccess: (res) => {
      dispatch(addDataset(res.data.dataset));
      dispatch(showNotification({ type: 'success', message: `Dataset "${res.data.dataset.name}" uploaded successfully!` }));
      qc.invalidateQueries({ queryKey: ['datasets'] });
      dispatch(closeUploadModal());
    },
    onError: (err) => {
      setError(err.message);
      dispatch(showNotification({ type: 'error', message: err.message }));
    },
  });

  const onDrop = useCallback((accepted, rejected) => {
    setError('');
    if (rejected.length > 0) {
      setError(rejected[0].errors[0]?.message || 'File rejected');
      return;
    }
    const f = accepted[0];
    if (f.size > 10 * 1024 * 1024) { setError('File too large (max 10MB)'); return; }
    setFile(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] },
    maxFiles: 1,
    disabled: isPending,
  });

  const handleUpload = () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    mutate(fd);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,14,26,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}
      onClick={() => !isPending && dispatch(closeUploadModal())}
    >
      <div
        className="glass-card fade-in"
        style={{ width: '100%', maxWidth: 520, padding: '2rem' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Upload Dataset</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>CSV or JSON · Max 10MB · Max 50 columns</p>
          </div>
          <button
            onClick={() => dispatch(closeUploadModal())}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'dragging' : ''}`}>
          <input {...getInputProps()} />
          {file ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={40} color="var(--accent-emerald)" />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{file.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB · {file.type || 'text/csv'}
              </div>
              <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem' }}
                onClick={e => { e.stopPropagation(); setFile(null); }}>
                Remove
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'rgba(99,130,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Upload size={24} color="var(--accent-blue)" />
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                {isDragActive ? 'Drop it here!' : 'Drag & drop your file here'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>or click to browse</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span className="badge badge-blue"><FileText size={10} /> CSV</span>
                <span className="badge badge-violet"><FileText size={10} /> JSON</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
            borderRadius: 10, padding: '0.65rem 1rem', marginTop: '1rem',
            color: 'var(--accent-rose)', fontSize: '0.8rem',
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {isPending && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Uploading & parsing...</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '60%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
          <button className="btn-ghost" onClick={() => dispatch(closeUploadModal())} style={{ flex: 1 }}>Cancel</button>
          <button className="btn-primary" onClick={handleUpload} disabled={!file || isPending} style={{ flex: 2 }}>
            {isPending ? 'Uploading...' : 'Upload Dataset'}
          </button>
        </div>
      </div>
    </div>
  );
}
