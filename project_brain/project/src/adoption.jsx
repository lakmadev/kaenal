// Kaenal — Adoption & Customer Success
// Onboarding wizard, In-product tours, Knowledge base, NPS, Adoption analytics, Release notes

// ─────────────────────────────────────────────────────────────
// ONBOARDING WIZARD (new workspace setup)
// ─────────────────────────────────────────────────────────────
function OnboardingWizard({ setRoute }) {
  const [step, setStep] = React.useState(2);
  const tasks = [
    { id: 'org', title: 'Confirm company details', desc: 'Name, industry, compliance frameworks', done: true, owner: 'David Sharma', when: '4 days ago' },
    { id: 'sso', title: 'Connect SSO', desc: 'Microsoft Entra ID via SAML', done: true, owner: 'Priya Iyer', when: '3 days ago' },
    { id: 'plants', title: 'Add plants & areas', desc: '7 plants, 47 areas, 184 stations', done: true, owner: 'Manjunath Kumar', when: 'Yesterday' },
    { id: 'members', title: 'Invite team', desc: '412 members invited (387 active)', done: false, progress: 94, owner: 'Manjunath Kumar', estimate: '~ 5 min remaining' },
    { id: 'templates', title: 'Import inspection templates', desc: 'Use library (12) or build from scratch', done: false, progress: 60, owner: 'You', estimate: '4 of 12 customized' },
    { id: 'integration', title: 'Connect SAP S/4HANA', desc: 'Production orders & material master', done: false, progress: 0, owner: 'You', estimate: '~ 30 min — vendor support available' },
    { id: 'pilot', title: 'Pilot inspection', desc: 'Run an end-to-end test from CMM to NCR', done: false, progress: 0, owner: 'You', estimate: 'Recommended after templates' },
    { id: 'audit', title: 'IATF audit readiness scan', desc: 'AI-powered review of clause coverage', done: false, progress: 0, owner: 'You', estimate: '~ 8 min' },
  ];

  const completed = tasks.filter(t => t.done).length;
  const pct = Math.round((completed / tasks.length) * 100);

  return (
    <div>
      <PageHeader
        title="Welcome to Kaenal"
        description="Let's get your workspace ready. Most plants are live in under a week with this checklist."
        actions={
          <>
            <button className="k-btn k-btn-ghost">Skip onboarding</button>
            <button className="k-btn k-btn-primary"><Icon name="external" size={13}/> Schedule kickoff with CSM</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{
          padding: 20, marginBottom: 18,
          background: 'linear-gradient(135deg, #1e3a8a, #4c1d95)',
          color: 'white', borderRadius: 'var(--r-lg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>3</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase' }}>Day 3 of 7</div>
              <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>You're {pct}% of the way to first inspection</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>3 tasks done · 5 to go · Your CSM Anand will check in tomorrow at 11am IST</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>EST TIME LEFT</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>~ 90 min</div>
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #60a5fa, #a78bfa)' }}/>
          </div>
        </div>

        <Card title="Setup checklist">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map((t, i) => (
              <div key={t.id} style={{
                padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                background: t.done ? 'rgba(34,197,94,0.05)' : (i === step ? 'var(--accent-soft)' : 'var(--surface)'),
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: t.done ? '#22c55e' : i === step ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: t.done || i === step ? 'white' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13, flexShrink: 0,
                }}>{t.done ? <Icon name="check" size={14} stroke={3}/> : i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.desc}</div>
                  {t.progress > 0 && t.progress < 100 && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 200, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${t.progress}%`, height: '100%', background: 'var(--accent)' }}/>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.estimate}</span>
                    </div>
                  )}
                </div>
                {t.done ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--success-700)' }}>DONE BY</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500 }}>{t.owner}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t.when}</div>
                  </div>
                ) : (
                  <button className="k-btn k-btn-primary k-btn-sm" style={{ flexShrink: 0 }}>
                    {t.progress > 0 ? 'Continue' : 'Start'} <Icon name="arrowRight" size={11}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Your CSM">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <Avatar user="u1" size={56}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Anand Patel</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Customer Success · Asia-Pacific · Speaks EN, HI, MR</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Office hours: Mon–Fri 9am–6pm IST</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="k-btn k-btn-primary k-btn-sm"><Icon name="external" size={11}/> Book 30 min</button>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="chat" size={11}/> Slack message</button>
              <button className="k-btn k-btn-secondary k-btn-sm"><Icon name="mail" size={11}/> Email</button>
            </div>
          </Card>

          <Card title="Helpful right now">
            {[
              { i: 'play', t: 'Tour the dashboard (3 min)', s: 'Video walkthrough' },
              { i: 'doc', t: 'Inspection template best practices', s: 'Article · 12 min read' },
              { i: 'package', t: 'IATF 16949 template starter pack', s: 'Pre-built · 24 templates' },
              { i: 'users', t: 'Roles & permissions playbook', s: 'For workspace admins' },
            ].map((r, i) => (
              <a key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                <Icon name={r.i} size={14} style={{ color: 'var(--accent)' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.t}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.s}</div>
                </div>
                <Icon name="arrowRight" size={12} style={{ color: 'var(--text-subtle)' }}/>
              </a>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PRODUCT TOURS
// ─────────────────────────────────────────────────────────────
function ProductTours({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="In-product tours"
        description="Guided walkthroughs you author once and trigger to roles, plants, or new joiners. Built-in completion tracking."
        actions={<button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New tour</button>}
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { l: 'Published tours', v: 24, c: '#2563eb' },
            { l: 'Triggered (24h)', v: 184, c: '#7c3aed' },
            { l: 'Completion rate', v: '78%', c: '#16a34a' },
            { l: 'Avg time-to-value', v: '−4.2 days', s: 'For new joiners with tours', c: '#0d9488' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 14 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <Card title="Active tours">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { n: 'First-day welcome (all members)', steps: 8, audience: 'New hires (auto-trigger)', trig: '24h after first sign-in', completed: 412, completion: 88, status: 'active' },
              { n: 'Mobile inspector — quick start', steps: 12, audience: 'Role: Inspector', trig: 'On first mobile app open', completed: 142, completion: 92, status: 'active' },
              { n: '8D walkthrough — D1 to D8', steps: 18, audience: 'Role: Quality Engineer + Manager', trig: 'Manual', completed: 47, completion: 64, status: 'active' },
              { n: 'AI features — what changed in May', steps: 6, audience: 'All members', trig: 'Once', completed: 287, completion: 71, status: 'active' },
              { n: 'IATF audit prep (audit week)', steps: 14, audience: 'Auditors + QM', trig: 'Manual', completed: 0, completion: 0, status: 'draft' },
              { n: 'Custom report builder', steps: 10, audience: 'Power users', trig: 'On 3rd visit to Reports', completed: 84, completion: 58, status: 'active' },
            ].map((t, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon name="play" size={18} style={{ color: t.status === 'active' ? 'var(--accent)' : 'var(--text-muted)' }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.n}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.steps} steps · {t.audience} · {t.trig}</div>
                  </div>
                  {t.status === 'active' ? (
                    <>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>COMPLETED</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.completed} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {t.completion}%</span></div>
                      </div>
                      <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Active</span>
                    </>
                  ) : (
                    <span className="k-chip" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>Draft</span>
                  )}
                  <button className="k-btn k-btn-secondary k-btn-sm">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Tour builder preview" desc="What an in-product tour looks like to the user">
          <div style={{ position: 'relative', height: 320, background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 12, padding: 16, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ height: 14, width: 120, background: 'var(--border)', borderRadius: 3, marginBottom: 10 }}/>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ height: 60, background: 'var(--bg-subtle)', borderRadius: 4 }}/>
                <div style={{ height: 60, background: 'var(--bg-subtle)', borderRadius: 4, outline: '2px solid var(--accent)', outlineOffset: 4 }}/>
                <div style={{ height: 60, background: 'var(--bg-subtle)', borderRadius: 4 }}/>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 60, left: 250, width: 280, background: 'var(--slate-900)', color: 'white', borderRadius: 'var(--r-md)', padding: 14, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>STEP 3 OF 8</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                  {[0,1,2,3,4,5,6,7].map(i => <div key={i} style={{ width: 14, height: 3, borderRadius: 1, background: i <= 2 ? '#60a5fa' : '#334155' }}/>)}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Critical NCRs live here</div>
              <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.55, marginBottom: 12 }}>This card surfaces any critical-severity NCR opened in your area in the last 24h. Click through to see details and assign yourself.</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ padding: '6px 10px', background: 'transparent', color: '#94a3b8', fontSize: 11, borderRadius: 4 }}>Skip tour</button>
                <button style={{ marginLeft: 'auto', padding: '6px 12px', background: '#60a5fa', color: 'white', fontSize: 12, fontWeight: 600, borderRadius: 4 }}>Next →</button>
              </div>
              <div style={{ position: 'absolute', top: '50%', left: -10, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: '10px solid var(--slate-900)' }}/>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────
function KnowledgeBase({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Knowledge base"
        description="In-app help center. Public on docs.kaenal.app. AI assistant searches across articles + your own SOPs."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="external" size={13}/> Public docs</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New article</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{
          padding: 20, marginBottom: 18,
          background: 'linear-gradient(135deg, #0f766e, #1e40af)',
          color: 'white', borderRadius: 'var(--r-lg)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>How can we help?</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16 }}>347 articles · AI search · Updated daily</div>
          <div style={{ maxWidth: 540, margin: '0 auto', position: 'relative' }}>
            <input className="k-input" placeholder="Ask anything · e.g. 'how to set up SPC alarms'" style={{ height: 44, paddingLeft: 44, paddingRight: 14, background: 'white', color: '#0f172a', fontSize: 14 }}/>
            <div style={{ position: 'absolute', left: 14, top: 14, color: '#64748b' }}><Icon name="search" size={16}/></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { c: 'Getting started', i: 'sparkles', n: 24, color: '#2563eb' },
            { c: 'Inspections', i: 'clipboard', n: 47, color: '#0d9488' },
            { c: 'NCR & 8D', i: 'alert', n: 38, color: '#dc2626' },
            { c: 'Audits & CAPA', i: 'shield', n: 28, color: '#7c3aed' },
            { c: 'Documents', i: 'doc', n: 32, color: '#16a34a' },
            { c: 'Integrations', i: 'package', n: 47, color: '#f59e0b' },
            { c: 'Admin & security', i: 'lock', n: 56, color: '#1e293b' },
            { c: 'Reports & analytics', i: 'reports', n: 24, color: '#ea580c' },
          ].map(c => (
            <div key={c.c} className="k-surface" style={{ padding: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: c.color + '18', color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.i} size={14}/></div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.c}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.n} articles</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <Card title="Most viewed (last 30 days)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { t: 'How to set up an inspection template', v: 4820, c: 'Inspections', helpful: 96 },
                { t: 'Closing an NCR: required steps and approvals', v: 3240, c: 'NCR & 8D', helpful: 94 },
                { t: 'IATF 16949 §7.5.3 — controlled document workflow', v: 2840, c: 'Documents', helpful: 87 },
                { t: 'Connecting Microsoft Entra ID for SSO', v: 1842, c: 'Admin', helpful: 92 },
                { t: 'Western Electric rules on SPC charts', v: 1820, c: 'Reports', helpful: 81 },
                { t: 'CMM auto-import — Hexagon Global setup', v: 1240, c: 'Integrations', helpful: 78 },
                { t: 'Mobile inspector — offline mode', v: 1140, c: 'Inspections', helpful: 89 },
              ].map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--bg-subtle)', borderRadius: 4 }}>
                  <Icon name="doc" size={14} style={{ color: 'var(--text-muted)' }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.t}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{a.c}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.v.toLocaleString()} views</span>
                  <span className="k-chip" style={{ background: a.helpful >= 85 ? 'var(--success-100)' : 'rgba(245,158,11,0.12)', color: a.helpful >= 85 ? 'var(--success-700)' : '#92400e', fontSize: 10 }}>{a.helpful}% helpful</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Articles needing love">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { t: 'Old screenshots — Inspections list', last: 'May 2025', why: 'UI changed' },
                { t: '"How to delete a workspace" is empty', last: 'Never', why: 'Stub' },
                { t: 'GraphQL examples reference v1', last: 'Mar 2025', why: 'API moved to v2' },
                { t: 'Slack integration screenshots', last: 'Jun 2025', why: 'Slack UI changed' },
              ].map((r, i) => (
                <div key={i} style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 6 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.t}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Last updated {r.last} · {r.why}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="AI help assistant — recent questions">
          {[
            { q: '"How do I escalate an NCR if my QM is on PTO?"', resolved: true, who: 'Sarah Ahmed' },
            { q: '"Why is my SPC chart showing rule WE-3?"', resolved: true, who: 'Marcus Lee' },
            { q: '"Can I import legacy Trackwise CAPAs?"', resolved: 'partially', who: 'David Sharma', escalated: 'Routed to support' },
            { q: '"What\'s the difference between containment and corrective action?"', resolved: true, who: 'Anita Kapoor' },
            { q: '"How do I generate a PPAP cover letter?"', resolved: false, who: 'Yuki Tanaka', escalated: 'Escalated — article missing' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
              <Icon name="sparkles" size={14} style={{ color: '#7c3aed' }}/>
              <div style={{ flex: 1, fontSize: 12.5 }}>{r.q}</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.who}</span>
              {r.resolved === true && <span className="k-chip" style={{ background: 'var(--success-100)', color: 'var(--success-700)' }}>Resolved</span>}
              {r.resolved === 'partially' && <span className="k-chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#92400e' }}>Partial</span>}
              {r.resolved === false && <span className="k-chip" style={{ background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }}>Unanswered</span>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NPS / SATISFACTION
// ─────────────────────────────────────────────────────────────
function NPSDashboard({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="NPS & satisfaction"
        description="Net Promoter Score, CSAT, in-app feedback widget, customer interviews."
        actions={<button className="k-btn k-btn-primary"><Icon name="send" size={13}/> Send NPS survey</button>}
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{
          padding: 20, marginBottom: 18,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr', gap: 24, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>NPS Q2 2026</div>
              <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: '#16a34a' }}>62</div>
              <div style={{ fontSize: 12, color: 'var(--success-700)', marginTop: 4 }}>↑ 8 vs Q1</div>
            </div>
            <div>
              <div className="k-overline" style={{ marginBottom: 6 }}>Promoters (9–10)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>72%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>284 of 396 respondents</div>
            </div>
            <div>
              <div className="k-overline" style={{ marginBottom: 6 }}>Passives (7–8)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#94a3b8' }}>18%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>72 of 396</div>
            </div>
            <div>
              <div className="k-overline" style={{ marginBottom: 6 }}>Detractors (0–6)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>10%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>40 of 396</div>
            </div>
            <div>
              <div className="k-overline" style={{ marginBottom: 6 }}>Response rate</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>87%</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>396 of 412 invited</div>
            </div>
          </div>
          {/* Distribution */}
          <div style={{ marginTop: 18 }}>
            <div className="k-overline" style={{ marginBottom: 6 }}>Score distribution</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
              {[2,1,4,6,8,8,12,40,32,62,36].map((v, i) => {
                const color = i <= 6 ? '#dc2626' : i <= 8 ? '#94a3b8' : '#22c55e';
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{v}</div>
                    <div style={{ background: color, width: '100%', height: v * 0.8, borderRadius: '2px 2px 0 0' }}/>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(i => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>{i}</div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="NPS over time">
            <svg viewBox="0 0 400 200" style={{ width: '100%' }}>
              {/* axes */}
              <line x1="40" x2="380" y1="170" y2="170" stroke="#cbd5e1"/>
              {/* gridlines */}
              {[20, 60, 100].map(v => <line key={v} x1="40" x2="380" y1={170 - v} y2={170 - v} stroke="#e2e8f0" strokeDasharray="2 3"/>)}
              {[20, 60, 100].map(v => <text key={v} x="36" y={174 - v} fontSize="9" fill="#64748b" textAnchor="end">{v}</text>)}
              {/* line */}
              <polyline points="60,124 100,108 140,98 180,92 220,84 260,76 300,68 340,52" fill="none" stroke="#16a34a" strokeWidth="2"/>
              {/* dots */}
              {[[60,124,'Q3 25',42],[100,108,'Q4 25',47],[140,98,'Q1 26',54],[180,92,'Apr',56],[220,84,'May',62],[260,76,'Jun',69]].map((p, i) => (
                <g key={i}>
                  <circle cx={p[0]} cy={p[1]} r="3.5" fill="#16a34a"/>
                  <text x={p[0]} y="190" fontSize="9" fill="#64748b" textAnchor="middle">{p[2]}</text>
                </g>
              ))}
              <text x="280" y="68" fontSize="11" fill="#16a34a" fontWeight="700">62 ← current</text>
            </svg>
          </Card>

          <Card title="By plant">
            {[
              { p: 'Pune-1', nps: 68, n: 174, trend: 'up' },
              { p: 'Chennai-2', nps: 62, n: 118, trend: 'up' },
              { p: 'Detroit Aluminum', nps: 38, n: 74, trend: 'down' },
              { p: 'Bratislava', nps: 71, n: 22, trend: 'flat' },
            ].map((p, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span>{p.p}</span>
                  <span style={{ fontWeight: 700, color: p.nps >= 50 ? '#16a34a' : p.nps >= 30 ? '#f59e0b' : '#dc2626' }}>{p.nps} {p.trend === 'up' ? '↑' : p.trend === 'down' ? '↓' : '→'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(0, (p.nps + 100) / 2)}%`, height: '100%', background: p.nps >= 50 ? '#22c55e' : p.nps >= 30 ? '#f59e0b' : '#dc2626' }}/>
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{p.n} responses</span>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <Card title="Verbatim feedback (last 30 days)">
          {[
            { score: 10, type: 'p', t: '"Best QMS we\'ve used in 15 years. The mobile inspector alone justifies the cost — operators love it."', u: 'u4', when: '2 days ago' },
            { score: 9, type: 'p', t: '"Big jump in IATF audit readiness since we switched. CSM Anand is exceptional."', u: 'u1', when: '4 days ago' },
            { score: 5, type: 'd', t: '"Document approval routing breaks when an approver is on PTO. Should auto-fallback."', u: 'u2', when: '6 days ago', acted: true },
            { score: 8, type: 'pa', t: '"AI suggestions for root cause are getting better — used to be unusable, now I trust them ~70%."', u: 'u3', when: '8 days ago' },
            { score: 4, type: 'd', t: '"Bulk import from QAD lost the original timestamps. Took weeks to clean up."', u: 'u5', when: '2 weeks ago', acted: true },
          ].map((f, i) => {
            const u = userById(f.u);
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: 10, borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: f.type === 'p' ? '#22c55e' : f.type === 'd' ? '#dc2626' : '#94a3b8',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 11, flexShrink: 0,
                }}>{f.score}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-muted)', lineHeight: 1.55 }}>{f.t}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 4 }}>— {u?.name} · {f.when}</div>
                </div>
                {f.acted && <span className="k-chip" style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}>Action created</span>}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADOPTION ANALYTICS
// ─────────────────────────────────────────────────────────────
function AdoptionAnalytics({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Adoption analytics"
        description="Who's using what — by user, role, plant, feature. WAU/MAU, feature funnels, churn signals."
        actions={
          <>
            <Segmented size="sm" value="30d" onChange={() => {}} options={[
              { value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' },
            ]}/>
            <button className="k-btn k-btn-ghost"><Icon name="download" size={13}/> Export</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
          {[
            { l: 'WAU / MAU', v: '0.78', s: 'Strong (target ≥ 0.65)', c: '#16a34a' },
            { l: 'DAU', v: 287, s: 'of 412 members', c: '#2563eb' },
            { l: 'Stickiness', v: '92%', s: '7-day retention', c: '#0d9488' },
            { l: 'Mobile share', v: '68%', s: 'of inspections', c: '#7c3aed' },
            { l: 'AI usage', v: '54K', s: 'calls / 24h', c: '#cc785c' },
          ].map(k => (
            <div key={k.l} className="k-surface" style={{ padding: 12 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{k.l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{k.s}</div>
            </div>
          ))}
        </div>

        <Card title="Feature adoption (last 30 days)">
          <table className="k-table" style={{ width: '100%' }}>
            <thead><tr><th>Feature</th><th>Unique users</th><th>% of WAU</th><th>30d trend</th><th>Top role</th><th>Friction</th></tr></thead>
            <tbody>
              {[
                { f: 'Mobile inspector', uu: 287, pct: 89, trend: 'up', role: 'Inspector', fric: 'low' },
                { f: 'NCR creation', uu: 142, pct: 44, trend: 'up', role: 'QE', fric: 'low' },
                { f: '8D workbench', uu: 47, pct: 14, trend: 'flat', role: 'QE', fric: 'med' },
                { f: 'Document approvals', uu: 84, pct: 26, trend: 'up', role: 'QM', fric: 'low' },
                { f: 'Audit prep', uu: 18, pct: 5.6, trend: 'up', role: 'QM', fric: 'high' },
                { f: 'Report builder', uu: 32, pct: 10, trend: 'flat', role: 'QM', fric: 'high' },
                { f: 'AI root-cause', uu: 92, pct: 28, trend: 'up', role: 'QE', fric: 'low' },
                { f: 'Customer portal', uu: 12, pct: 3.7, trend: 'up', role: 'QM', fric: 'low' },
              ].map(r => (
                <tr key={r.f}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{r.f}</td>
                  <td className="mono">{r.uu}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${r.pct}%`, height: '100%', background: 'var(--accent)' }}/>
                      </div>
                      <span className="mono" style={{ fontSize: 11 }}>{r.pct}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 16 }}>{r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→'}</td>
                  <td>{r.role}</td>
                  <td>
                    <span className="k-chip" style={{
                      background: r.fric === 'low' ? 'var(--success-100)' : r.fric === 'med' ? 'rgba(245,158,11,0.12)' : 'rgba(220,38,38,0.10)',
                      color: r.fric === 'low' ? 'var(--success-700)' : r.fric === 'med' ? '#92400e' : '#b91c1c',
                    }}>{r.fric}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Onboarding funnel — new joiners (last 30d)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { l: 'Invited', n: 47, pct: 100 },
                { l: 'Signed in', n: 47, pct: 100 },
                { l: 'Completed first-day tour', n: 44, pct: 94 },
                { l: 'First inspection submitted', n: 41, pct: 87 },
                { l: 'Active on day 7', n: 39, pct: 83 },
                { l: 'Active on day 30', n: 37, pct: 79 },
              ].map((f, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{f.l}</span>
                    <span className="mono">{f.n} · {f.pct}%</span>
                  </div>
                  <div style={{ height: 22, background: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${f.pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #7c3aed)' }}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="At-risk users — likely to churn">
            {[
              { u: 'u7', signals: 'No login 14d · 0 inspections this month · skipped tour', score: 84 },
              { u: 'u-anita', signals: 'Mobile crash 4× yesterday · low engagement', score: 71 },
              { u: 'u6', signals: 'Single feature use only (inspections) · helpdesk ticket open', score: 62 },
            ].map((r, i) => {
              const u = userById(r.u);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                  <Avatar user={r.u} size={32}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u?.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.signals}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{r.score}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>RISK</div>
                  </div>
                  <button className="k-btn k-btn-secondary k-btn-sm">Reach out</button>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RELEASE NOTES / CHANGELOG
// ─────────────────────────────────────────────────────────────
function ReleaseNotes({ setRoute }) {
  return (
    <div>
      <PageHeader
        title="Release notes"
        description="What's new in Kaenal — published in-app, on the changelog page, and via webhook to your Slack."
        actions={
          <>
            <button className="k-btn k-btn-ghost"><Icon name="external" size={13}/> changelog.kaenal.app</button>
            <button className="k-btn k-btn-primary"><Icon name="plus" size={13}/> New post</button>
          </>
        }
      />
      <div style={{ padding: '20px 28px 32px', maxWidth: 880 }}>
        {[
          {
            v: '2026.05.19', date: 'May 19, 2026', title: 'AI Governance, sandbox tenant, and 8D effectiveness verification',
            kind: 'major',
            items: [
              { t: 'feature', d: 'AI Governance hub — per-model routing rules, PII redaction visualizer, prompt audit trail, $-per-team chargeback' },
              { t: 'feature', d: 'Sandbox tenant — refresh from production with PII stripped; capture webhook deliveries instead of sending them' },
              { t: 'feature', d: '8D effectiveness verification — close gate now blocks until effectiveness has been measured' },
              { t: 'improvement', d: 'CMM auto-import 4× faster for runs > 1,000 measurements (Hexagon, Zeiss)' },
              { t: 'improvement', d: 'Mobile inspector offline queue: capped at 8,000 records, predictive sync (warns when network looks flaky)' },
              { t: 'fix', d: 'Document approval routing now respects PTO calendar — auto-falls-back to delegate' },
              { t: 'fix', d: 'GraphQL pagination on /inspections no longer breaks when cursor expires mid-page' },
            ],
            cta: { l: 'Read full announcement', go: 'announcement' },
          },
          {
            v: '2026.05.05', date: 'May 05, 2026', title: 'Customer-managed encryption keys (BYOK) and DLP policy engine',
            kind: 'major',
            items: [
              { t: 'feature', d: 'BYOK — encrypt customer data at rest with keys you own in AWS KMS or Azure Key Vault' },
              { t: 'feature', d: 'DLP policy engine with 18 pre-built rules · pattern, label, behavior, and volume' },
              { t: 'improvement', d: 'SCIM provisioning: group → role mapping now supports conditional scoping (e.g. by plant)' },
            ],
          },
          {
            v: '2026.04.21', date: 'Apr 21, 2026', title: 'IATF 16949 starter pack — 24 templates + audit prep AI',
            kind: 'minor',
            items: [
              { t: 'feature', d: 'IATF 16949 templates: PCP, PFMEA, control plan, IATF audit checklist, PPAP cover, 8D-A3' },
              { t: 'feature', d: 'Audit prep AI — auto-assembles evidence packet by clause' },
              { t: 'improvement', d: 'Reports now exportable to PowerPoint, not just PDF' },
            ],
          },
          {
            v: '2026.04.07', date: 'Apr 07, 2026', title: 'Maintenance + reliability improvements',
            kind: 'patch',
            items: [
              { t: 'improvement', d: 'Webhook retries: switched to exponential backoff with jitter; max 14 attempts over 7 days' },
              { t: 'fix', d: 'Time-zone display for inspections scheduled across DST boundaries' },
              { t: 'fix', d: 'PDF export with > 200 pages no longer times out' },
            ],
          },
        ].map((r, i) => (
          <div key={i} style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.v}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {r.date}</span>
              <span className="k-chip" style={{
                background: r.kind === 'major' ? 'rgba(124,58,237,0.12)' : r.kind === 'minor' ? 'rgba(13,148,136,0.12)' : 'var(--bg-subtle)',
                color: r.kind === 'major' ? '#7c3aed' : r.kind === 'minor' ? '#0f766e' : 'var(--text-muted)',
              }}>{r.kind}</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, marginBottom: 14 }}>{r.title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.items.map((it, j) => (
                <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="k-chip" style={{
                    flexShrink: 0, fontSize: 9, padding: '2px 6px',
                    background: it.t === 'feature' ? 'rgba(34,197,94,0.12)' : it.t === 'improvement' ? 'rgba(37,99,235,0.10)' : 'rgba(245,158,11,0.12)',
                    color: it.t === 'feature' ? 'var(--success-700)' : it.t === 'improvement' ? '#1d4ed8' : '#92400e',
                  }}>{it.t.toUpperCase()}</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>{it.d}</span>
                </div>
              ))}
            </div>
            {r.cta && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <a className="k-link" style={{ fontSize: 12 }}>{r.cta.l} →</a>
              </div>
            )}
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: 18 }}>
          <button className="k-btn k-btn-ghost">Load older releases</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingWizard, ProductTours, KnowledgeBase, NPSDashboard, AdoptionAnalytics, ReleaseNotes });
