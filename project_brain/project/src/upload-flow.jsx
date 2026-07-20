// Kaenal — Multi-file drag-drop upload modal

function UploadModal({ open, onClose, onComplete, context = 'document' }) {
  const [files, setFiles] = React.useState([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [phase, setPhase] = React.useState('select'); // select | uploading | metadata | complete
  const fileInputRef = React.useRef(null);

  const addFiles = (newFiles) => {
    const next = Array.from(newFiles).map((f, i) => ({
      id: 'f-' + Date.now() + '-' + i,
      name: f.name || ('Document_' + i + '.pdf'),
      size: f.size || (1024 * (50 + Math.random() * 8000)),
      type: f.type || guessType(f.name || ''),
      progress: 0,
      status: 'queued',
      ocrEnabled: true,
      aiSummary: true,
      folder: 'Quality / Controlled Procedures',
      classification: 'Internal',
      version: '1.0',
    }));
    setFiles(prev => [...prev, ...next]);
  };

  const guessType = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'application/pdf';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image/' + ext;
    if (['docx', 'doc'].includes(ext)) return 'application/msword';
    if (['xlsx', 'xls'].includes(ext)) return 'application/excel';
    return 'application/octet-stream';
  };

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));
  const updateFile = (id, patch) => setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  // Demo: auto-add sample files when modal opens with no files
  React.useEffect(() => {
    if (open && files.length === 0) {
      addFiles([
        { name: 'Welding-Process-Control-Plan-v4.2.pdf', size: 2_840_000, type: 'application/pdf' },
        { name: 'PFMEA-Cell3-2026Q2.xlsx', size: 184_000, type: 'application/excel' },
        { name: 'Calibration-Cert-TW-204.pdf', size: 612_000, type: 'application/pdf' },
        { name: 'Station-3B-fixture-photo.jpg', size: 1_240_000, type: 'image/jpeg' },
      ]);
    }
    if (!open) {
      setFiles([]); setPhase('select');
    }
  }, [open]);

  // Simulated upload progress
  React.useEffect(() => {
    if (phase !== 'uploading') return;
    const interval = setInterval(() => {
      setFiles(prev => {
        let allDone = true;
        const next = prev.map(f => {
          if (f.status === 'complete') return f;
          if (f.progress >= 100) return { ...f, status: 'complete' };
          allDone = false;
          const speed = f.size > 1_000_000 ? 8 : 18; // smaller files finish faster
          const inc = speed + Math.random() * 12;
          const newProgress = Math.min(f.progress + inc, 100);
          return { ...f, progress: newProgress, status: 'uploading' };
        });
        if (allDone) {
          clearInterval(interval);
          setTimeout(() => setPhase('metadata'), 400);
        }
        return next;
      });
    }, 180);
    return () => clearInterval(interval);
  }, [phase]);

  if (!open) return null;

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const completedCount = files.filter(f => f.status === 'complete').length;
  const overallProgress = files.length ? files.reduce((s, f) => s + f.progress, 0) / files.length : 0;

  const fmt = (b) => {
    if (b > 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
    if (b > 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
  };

  const fileIcon = (type) => {
    if (type.startsWith('image/')) return { name: 'camera', color: '#0d9488' };
    if (type === 'application/pdf') return { name: 'fileText', color: '#dc2626' };
    if (type.includes('excel')) return { name: 'reports', color: '#16a34a' };
    if (type.includes('word') || type.includes('msword')) return { name: 'fileText', color: '#2563eb' };
    return { name: 'doc', color: '#64748b' };
  };

  return (
    <>
      <div onClick={phase !== 'uploading' ? onClose : undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, backdropFilter: 'blur(4px)' }}/>
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 720, maxHeight: '90vh',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 20px 60px rgba(15,23,42,0.3)',
        zIndex: 201, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="upload" size={18}/>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {phase === 'select' && 'Upload documents'}
              {phase === 'uploading' && `Uploading ${files.length} file${files.length !== 1 ? 's' : ''}…`}
              {phase === 'metadata' && 'Set classification & metadata'}
              {phase === 'complete' && 'Upload complete'}
            </h2>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} · {fmt(totalSize)}
              {phase === 'uploading' && ` · ${Math.round(overallProgress)}% overall`}
            </div>
          </div>
          {phase !== 'uploading' && (
            <button onClick={onClose} className="k-btn-plain" style={{ padding: 6 }}>
              <Icon name="x" size={16}/>
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {phase === 'select' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '36px 20px', textAlign: 'center',
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--r-md)',
                  background: dragOver ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  cursor: 'pointer', transition: 'all 120ms',
                  marginBottom: 18,
                }}>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
                  onChange={(e) => e.target.files && addFiles(e.target.files)}/>
                <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'var(--surface)', color: 'var(--accent)', marginBottom: 10 }}>
                  <Icon name="upload" size={28} stroke={1.5}/>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  Drag & drop files here
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  or click to browse · PDF, DOCX, XLSX, images, CAD · up to 50 MB each
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map(f => {
                  const ic = fileIcon(f.type);
                  return (
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                    }}>
                      <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: ic.color + '18', color: ic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={ic.name} size={16}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(f.size)}</div>
                      </div>
                      <button onClick={() => removeFile(f.id)} className="k-btn-plain" style={{ padding: 6, color: 'var(--text-muted)' }}>
                        <Icon name="trash" size={14}/>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Bulk options</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }}/>
                    <Icon name="eye" size={13}/>
                    OCR — extract text from PDFs and images
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }}/>
                    <Icon name="sparkles" size={13}/>
                    AI summarize — auto-generate abstract & tags
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }}/>
                    <Icon name="link" size={13}/>
                    Auto-link to clauses & open NCRs
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <input type="checkbox" style={{ accentColor: 'var(--accent)' }}/>
                    <Icon name="shieldCheck" size={13}/>
                    Request approval after upload
                  </label>
                </div>
              </div>
            </>
          )}

          {(phase === 'uploading' || phase === 'metadata' || phase === 'complete') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map(f => {
                const ic = fileIcon(f.type);
                return (
                  <div key={f.id} style={{
                    padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: phase === 'uploading' ? 8 : 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: ic.color + '18', color: ic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={ic.name} size={16}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {fmt(f.size)}
                          {f.status === 'uploading' && ` · ${Math.round(f.progress)}%`}
                          {f.status === 'complete' && ' · ✓ Uploaded · OCR done · AI summary ready'}
                        </div>
                      </div>
                      {f.status === 'complete' && (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--success-100)', color: 'var(--success-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="check" size={14} stroke={2.5}/>
                        </div>
                      )}
                    </div>
                    {f.status !== 'complete' && phase === 'uploading' && (
                      <div style={{ height: 4, background: 'var(--bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: f.progress + '%', height: '100%', background: 'var(--accent)', transition: 'width 200ms' }}/>
                      </div>
                    )}
                    {phase === 'metadata' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <select className="k-input" defaultValue={f.classification} style={{ height: 28, fontSize: 11.5 }}>
                          <option>Public</option><option>Internal</option><option>Confidential</option><option>Restricted</option>
                        </select>
                        <select className="k-input" defaultValue={f.folder} style={{ height: 28, fontSize: 11.5 }}>
                          <option>Quality / Procedures</option>
                          <option>Quality / Controlled Procedures</option>
                          <option>Quality / Records</option>
                          <option>Process / Control Plans</option>
                          <option>Audits / Evidence</option>
                        </select>
                        <input className="k-input" defaultValue="Plant A · Weld Cell 3" placeholder="Tags" style={{ height: 28, fontSize: 11.5 }}/>
                      </div>
                    )}
                  </div>
                );
              })}
              {phase === 'metadata' && (
                <div style={{ marginTop: 12, padding: 14, background: 'var(--accent-soft)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="sparkles" size={16}/>
                  <div style={{ flex: 1, fontSize: 12.5 }}>
                    <strong>AI suggested folder & tags</strong> based on content. Review and adjust before publishing.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-subtle)' }}>
          {phase === 'uploading' ? (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{completedCount} of {files.length} complete</span>
                  <span style={{ fontWeight: 600 }}>{Math.round(overallProgress)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: overallProgress + '%', height: '100%', background: 'var(--accent)', transition: 'width 200ms' }}/>
                </div>
              </div>
              <button disabled className="k-btn k-btn-secondary" style={{ opacity: 0.6 }}>Uploading…</button>
            </>
          ) : phase === 'metadata' ? (
            <>
              <button onClick={onClose} className="k-btn k-btn-secondary">Cancel</button>
              <div style={{ flex: 1 }}/>
              <button onClick={() => { setPhase('complete'); setTimeout(() => { onComplete?.(); onClose(); }, 1500); }} className="k-btn k-btn-primary">
                <Icon name="check" size={13}/> Publish {files.length} document{files.length !== 1 ? 's' : ''}
              </button>
            </>
          ) : phase === 'complete' ? (
            <>
              <div style={{ flex: 1, color: 'var(--success-600)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="check" size={14} stroke={2.5}/> {files.length} document{files.length !== 1 ? 's' : ''} published
              </div>
              <button onClick={onClose} className="k-btn k-btn-primary">Done</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flex: 1 }}>
                Files are scanned for viruses & malware before publishing
              </span>
              <button onClick={onClose} className="k-btn k-btn-secondary">Cancel</button>
              <button onClick={() => setPhase('uploading')} disabled={files.length === 0} className="k-btn k-btn-primary"
                style={{ opacity: files.length === 0 ? 0.6 : 1 }}>
                <Icon name="upload" size={13}/> Upload {files.length} file{files.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { UploadModal });
