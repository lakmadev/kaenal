// PDF Template Designer (admin) — visual layout for 8D and other report templates
const { useState: useTd } = React;

const TD_BLOCKS = [
  { id: 'cover', label: 'Cover page', icon: 'star', desc: 'Title, ID, customer, classification' },
  { id: 'meta', label: 'Metadata table', icon: 'list', desc: 'Reporter, owner, dates, severity' },
  { id: 'team', label: 'Team (D1)', icon: 'users', desc: 'Names, roles, signatures' },
  { id: 'problem', label: 'Problem (D2)', icon: 'alert', desc: '5W2H, scope, impact' },
  { id: 'containment', label: 'Containment (D3)', icon: 'shield', desc: 'Actions, evidence, dates' },
  { id: 'rca', label: 'Root cause (D4)', icon: 'brain', desc: '5-Why, fishbone, data' },
  { id: 'capa', label: 'Corrective (D5)', icon: 'check', desc: 'Verified actions' },
  { id: 'impl', label: 'Implementation (D6)', icon: 'gitBranch', desc: 'Rollout, validation' },
  { id: 'prev', label: 'Prevention (D7)', icon: 'lock', desc: 'Systemic changes' },
  { id: 'closure', label: 'Closure (D8)', icon: 'award', desc: 'Recognition, sign-off' },
  { id: 'photos', label: 'Photo grid', icon: 'camera', desc: '2x2 to 3x3 image layout' },
  { id: 'sigs', label: 'Signatures', icon: 'pen', desc: 'Approval block' },
];

const PDFTemplateDesigner = ({ setRoute }) => {
  const [layout, setLayout] = useTd(['cover', 'meta', 'team', 'problem', 'containment', 'rca', 'photos', 'capa', 'impl', 'prev', 'closure', 'sigs']);
  const [selected, setSelected] = useTd('rca');
  const [theme, setTheme] = useTd({
    primary: '#2563eb',
    pageSize: 'letter',
    headerStyle: 'modern',
    showLogo: true,
    showWatermark: false,
  });

  const remove = (id) => setLayout(layout.filter(x => x !== id));
  const add = (id) => setLayout([...layout, id]);
  const move = (id, dir) => {
    const i = layout.indexOf(id);
    const next = [...layout];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setLayout(next);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="PDF Template Designer"
        description="Design how your 8D reports look on paper. Edits propagate to all new exports."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="eye" size={14}/>Preview</button>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={14}/>Export sample</button>
            <button className="k-btn k-btn-primary"><Icon name="check" size={14}/>Publish template</button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 0, flex: 1, overflow: 'hidden' }}>
        {/* Block library */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Available blocks</div>
          {TD_BLOCKS.filter(b => !layout.includes(b.id)).map(b => (
            <button key={b.id} onClick={() => add(b.id)} style={{
              width: '100%', padding: 12, marginBottom: 6,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', textAlign: 'left',
              display: 'flex', gap: 10, alignItems: 'flex-start',
              cursor: 'pointer',
            }}>
              <Icon name={b.icon} size={16} style={{ color: 'var(--accent)', marginTop: 2 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.desc}</div>
              </div>
              <Icon name="plus" size={14} style={{ color: 'var(--text-muted)' }}/>
            </button>
          ))}
          {TD_BLOCKS.filter(b => !layout.includes(b.id)).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>All blocks added</div>
          )}
        </div>

        {/* Canvas — paper */}
        <div style={{ overflowY: 'auto', padding: 32, background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 612, minHeight: 800, background: 'white',
            boxShadow: '0 8px 30px -8px rgba(15,23,42,0.18)',
            borderRadius: 4,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Page header */}
            <div style={{ padding: '20px 40px', borderBottom: `2px solid ${theme.primary}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              {theme.showLogo && <div style={{ width: 32, height: 32, background: theme.primary, color: 'white', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>K</div>}
              <div>
                <div style={{ fontSize: 8, color: '#64748b', fontWeight: 600, letterSpacing: '0.08em' }}>NORTHEAST INDUSTRIAL · QUALITY</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>8D Corrective Action Report</div>
              </div>
              <div style={{ flex: 1 }}/>
              <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>8D-2026-0015</div>
            </div>

            {/* Blocks */}
            <div style={{ flex: 1 }}>
              {layout.map((id, i) => {
                const b = TD_BLOCKS.find(x => x.id === id);
                const isSel = selected === id;
                return (
                  <div key={id} onClick={() => setSelected(id)} style={{
                    padding: '12px 40px', position: 'relative',
                    cursor: 'pointer', borderTop: i > 0 ? '1px dashed #e2e8f0' : 'none',
                    background: isSel ? 'rgba(37,99,235,0.04)' : 'transparent',
                    outline: isSel ? `2px solid ${theme.primary}` : 'none',
                    outlineOffset: -2,
                  }}>
                    {/* Block sample render */}
                    {id === 'cover' && (
                      <div style={{ padding: '40px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: theme.primary, letterSpacing: '-0.02em' }}>8D Report</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Bracket weld bead inconsistent on Line 2</div>
                        <div style={{ marginTop: 24, padding: 12, background: '#f8fafc', borderRadius: 6, display: 'inline-block', fontSize: 11, color: '#64748b' }}>
                          Customer: Globex Motors · Severity: HIGH · Issued: May 1, 2026
                        </div>
                      </div>
                    )}
                    {id === 'meta' && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Report metadata</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 9 }}>
                          {[['Reporter', 'Sara Chen'], ['Owner', 'Lin Wei'], ['Reported', 'May 1, 2026'], ['Due', 'May 8, 2026'], ['Severity', 'High'], ['Site', 'Plant A · Line 2']].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', gap: 8 }}>
                              <span style={{ width: 70, color: '#64748b' }}>{k}</span>
                              <span style={{ fontWeight: 500 }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(id === 'team' || id === 'problem' || id === 'containment' || id === 'rca' || id === 'capa' || id === 'impl' || id === 'prev' || id === 'closure') && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, background: theme.primary, color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {{team:'D1',problem:'D2',containment:'D3',rca:'D4',capa:'D5',impl:'D6',prev:'D7',closure:'D8'}[id]}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{b.label}</div>
                        </div>
                        <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.6, padding: 10, background: '#f8fafc', borderLeft: `3px solid ${theme.primary}` }}>
                          {id === 'rca' && '5-Why analysis — wire feed pressure dropped to 3.0 bar due to torch nozzle wear (cycle limit exceeded). Maintenance schedule did not flag this part. PM intervals to be revised.'}
                          {id !== 'rca' && 'This block will fill with the corresponding section content from your 8D record at export time. Edit on the right →'}
                        </div>
                      </div>
                    )}
                    {id === 'photos' && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Evidence photos</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                          {[1,2,3,4,5,6].map(i => (
                            <div key={i} style={{ aspectRatio: '4/3', background: `linear-gradient(135deg, hsl(${i*40} 30% 50%), hsl(${i*40} 30% 30%))`, borderRadius: 3 }}/>
                          ))}
                        </div>
                      </div>
                    )}
                    {id === 'sigs' && (
                      <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
                        {['Reporter', 'QA Manager', 'Plant Lead'].map(r => (
                          <div key={r} style={{ flex: 1, paddingTop: 24, borderTop: '1px solid #0f172a', fontSize: 9, color: '#64748b' }}>{r}</div>
                        ))}
                      </div>
                    )}

                    {/* Block controls (overlay) */}
                    {isSel && (
                      <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, background: 'white', borderRadius: 6, boxShadow: 'var(--shadow-md)', padding: 2 }}>
                        <button onClick={(e) => { e.stopPropagation(); move(id, -1); }} style={{ width: 24, height: 24, border: 'none', background: 'transparent', borderRadius: 4 }}><Icon name="chevronUp" size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); move(id, 1); }} style={{ width: 24, height: 24, border: 'none', background: 'transparent', borderRadius: 4 }}><Icon name="chevronDown" size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); remove(id); }} style={{ width: 24, height: 24, border: 'none', background: 'transparent', borderRadius: 4, color: '#dc2626' }}><Icon name="trash" size={12}/></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 40px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8' }}>
              <span>Confidential — Northeast Industrial</span>
              <span>Page 1 of 4</span>
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div style={{ borderLeft: '1px solid var(--border)', overflowY: 'auto', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Template settings</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Brand color</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#2563eb', '#0d9488', '#9333ea', '#dc2626', '#ea580c', '#0f172a'].map(c => (
                <button key={c} onClick={() => setTheme({ ...theme, primary: c })}
                  style={{ width: 28, height: 28, borderRadius: 6, background: c, border: theme.primary === c ? '2px solid var(--text)' : '2px solid var(--border)', cursor: 'pointer' }}/>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Page size</label>
            <select value={theme.pageSize} onChange={e => setTheme({ ...theme, pageSize: e.target.value })} className="k-input">
              <option value="letter">US Letter (8.5 × 11")</option>
              <option value="a4">A4 (210 × 297mm)</option>
              <option value="legal">Legal (8.5 × 14")</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: 4 }}>Header style</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {['modern', 'classic', 'minimal', 'corporate'].map(s => (
                <button key={s} onClick={() => setTheme({ ...theme, headerStyle: s })}
                  style={{
                    padding: '8px', border: '1px solid var(--border)',
                    background: theme.headerStyle === s ? 'var(--accent-soft)' : 'var(--surface)',
                    borderColor: theme.headerStyle === s ? 'var(--accent)' : 'var(--border)',
                    color: theme.headerStyle === s ? 'var(--accent)' : 'var(--text)',
                    borderRadius: 6, fontSize: 11, fontWeight: 500, textTransform: 'capitalize',
                  }}>{s}</button>
              ))}
            </div>
          </div>

          {[
            { l: 'Show company logo', k: 'showLogo' },
            { l: 'Watermark "DRAFT"', k: 'showWatermark' },
          ].map(opt => (
            <label key={opt.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={theme[opt.k]} onChange={e => setTheme({ ...theme, [opt.k]: e.target.checked })}/>
              {opt.l}
            </label>
          ))}

          {selected && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }}/>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Selected block</div>
              <div style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{TD_BLOCKS.find(b => b.id === selected)?.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{TD_BLOCKS.find(b => b.id === selected)?.desc}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PDFTemplateDesigner });
