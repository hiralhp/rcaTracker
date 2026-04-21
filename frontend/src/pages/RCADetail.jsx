import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import StatusPill, { SeverityPill, STAGE_LABELS } from '../components/StatusPill';
import SLOBadge from '../components/SLOBadge';

// ─── Salesforce service catalog ───────────────────────────────────────────────
const SERVICE_GROUPS = [
  {
    label: 'Core CRM Clouds',
    services: [
      'Commerce Cloud', 'Education Cloud', 'Experience Cloud',
      'Financial Services Cloud', 'Health Cloud', 'Industry Clouds',
      'Manufacturing Cloud', 'Marketing Cloud', 'Net Zero Cloud',
      'Nonprofit Cloud', 'Revenue Cloud', 'Sales Cloud', 'Service Cloud',
    ],
  },
  {
    label: 'Data, AI & Platform',
    services: [
      'CRM Analytics', 'Data Cloud', 'Einstein AI',
      'Einstein GPT / Copilot', 'Hyperforce', 'Reports & Dashboards',
      'Salesforce Platform', 'Tableau',
    ],
  },
  {
    label: 'Developer & App Platform',
    services: [
      'Apex', 'DevOps Center', 'Flow Builder', 'Heroku',
      'Lightning Platform', 'Lightning Web Components (LWC)',
      'MuleSoft Anypoint Platform', 'Process Builder', 'Salesforce Functions',
      'Visualforce',
    ],
  },
  {
    label: 'Integration & APIs',
    services: [
      'External Services', 'Marketing Cloud Account Engagement',
      'Platform Events', 'Salesforce Connect',
    ],
  },
  {
    label: 'Identity & Security',
    services: [
      'Salesforce Authenticator', 'Salesforce Identity', 'Shield',
      'Single Sign-On (SSO)',
    ],
  },
  {
    label: 'Customer Interaction',
    services: [
      'Contact Center', 'CPQ & Billing', 'Field Service',
      'Knowledge', 'Omni-Channel', 'Slack', 'Work.com',
    ],
  },
  {
    label: 'Ecosystem',
    services: ['AppExchange', 'Salesforce Mobile App', 'Trailhead'],
  },
];

// Flat list derived from groups (for lookup)
const SALESFORCE_SERVICES = SERVICE_GROUPS.flatMap(g => g.services);

// ─── Impacted Services Modal ──────────────────────────────────────────────────
function ServicesModal({ current, onSave, onClose }) {
  const [selected,       setSelected]       = useState(new Set(current));
  const [search,         setSearch]         = useState('');
  const [customServices, setCustomServices] = useState(
    () => current.filter(s => !SALESFORCE_SERVICES.includes(s))
  );
  const [custom,  setCustom]  = useState('');
  const [saving,  setSaving]  = useState(false);

  const allFlat = [...SALESFORCE_SERVICES, ...customServices];
  const query   = search.trim().toLowerCase();
  const filtered = query ? allFlat.filter(s => s.toLowerCase().includes(query)) : null;

  const toggle = s =>
    setSelected(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  function addCustom() {
    const t = custom.trim();
    if (!t || allFlat.includes(t)) return;
    setCustomServices(prev => [...prev, t]);
    setSelected(prev => new Set([...prev, t]));
    setCustom('');
  }

  async function handleSave() {
    setSaving(true);
    await onSave([...selected].sort((a, b) => a.localeCompare(b)));
    onClose();
  }

  function CheckItem({ svc }) {
    return (
      <label className="flex items-center gap-3 px-2 py-1.5 rounded-[4px] hover:bg-[#F3F3F3] cursor-pointer">
        <input
          type="checkbox"
          checked={selected.has(svc)}
          onChange={() => toggle(svc)}
          className="accent-[#0176D3] w-3.5 h-3.5 flex-shrink-0"
        />
        <span className="text-sm text-[#3E3E3C]">{svc}</span>
      </label>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg flex flex-col" style={{ maxHeight: '82vh' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DDDBDA] flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold">Edit Impacted Services</h2>
          <button onClick={onClose} className="text-[#706E6B] hover:text-[#181818]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search + count */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
            autoFocus
          />
          <div className="text-xs text-[#706E6B] mt-1.5">
            {selected.size} service{selected.size !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 px-6 pb-2">
          {filtered ? (
            /* Search results — flat */
            <div className="space-y-0.5 pt-1">
              {filtered.map(svc => <CheckItem key={svc} svc={svc} />)}
              {filtered.length === 0 && (
                <div className="text-sm text-[#AEAEAE] py-6 text-center">No matches</div>
              )}
            </div>
          ) : (
            /* Grouped browse */
            <div className="pt-1">
              {SERVICE_GROUPS.map(group => (
                <div key={group.label} className="mb-3">
                  <div className="text-[10px] font-semibold text-[#AEAEAE] uppercase tracking-wider px-2 pt-2 pb-1">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.services.map(svc => <CheckItem key={svc} svc={svc} />)}
                  </div>
                </div>
              ))}
              {customServices.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-[#AEAEAE] uppercase tracking-wider px-2 pt-2 pb-1">
                    Custom
                  </div>
                  <div className="space-y-0.5">
                    {customServices.map(svc => <CheckItem key={svc} svc={svc} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DDDBDA] space-y-3 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Add a service not listed above…"
              className="flex-1 border border-[#DDDBDA] rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!custom.trim()}
              className="btn-outline text-xs disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Impacted Services Card ───────────────────────────────────────────────────
function ImpactedServicesCard({ rca, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const services = rca.impacted_services || [];

  async function handleSave(list) {
    await api.updateRCA(rca.id, { impacted_services: list });
    onUpdate();
  }

  return (
    <div className="card p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#181818]">Impacted Services</h2>
        <button
          onClick={() => setShowModal(true)}
          className="btn-outline flex items-center gap-1.5 text-xs"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-[#AEAEAE]">No services tagged yet — click Edit to add.</p>
      ) : (
        <>
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FDECEA] text-[#C23934]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Impacted ({services.length} {services.length === 1 ? 'service' : 'services'})
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {services.map(svc => (
              <li key={svc} className="flex items-center gap-2 text-sm text-[#3E3E3C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C23934] flex-shrink-0" />
                {svc}
              </li>
            ))}
          </ul>
        </>
      )}

      {showModal && (
        <ServicesModal
          current={services}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// Sev0 includes PR & Legal Review; Sev1 skips it
const STAGES_SEV1 = ['requested', 'ai_draft_ready', 'drafting', 'service_owner_review', 'vp_svp_review', 'tech_writer_review', 'published'];
const STAGES_SEV0 = ['requested', 'ai_draft_ready', 'drafting', 'service_owner_review', 'vp_svp_review', 'tech_writer_review', 'pr_legal_review', 'published'];
function getStages(severity) { return severity === 'Sev0' ? STAGES_SEV0 : STAGES_SEV1; }

function fmt(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(d));
}

function durLabel(minutes) {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ─── Advance Stage Modal ──────────────────────────────────────────────────────
function AdvanceModal({ rca, onClose, onAdvanced }) {
  const STAGES    = getStages(rca.severity);
  const currentIdx = STAGES.indexOf(rca.status);
  const nextStage  = STAGES[currentIdx + 1];
  const [actor, setActor] = useState(rca.assigned_csm || '');
  const [note, setNote]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.advanceRCA(rca.id, { actor, note });
      onAdvanced();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="px-6 py-4 border-b border-[#DDDBDA] flex items-center justify-between">
          <h2 className="text-base font-semibold">Advance Stage</h2>
          <button onClick={onClose} className="text-[#706E6B] hover:text-[#181818]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="pill-red px-3 py-2 rounded text-sm">{error}</div>}

          <div className="flex items-center gap-3 bg-[#F3F3F3] rounded-[4px] p-3">
            <div className="text-center flex-1">
              <div className="text-xs text-[#706E6B] mb-1">Current</div>
              <StatusPill status={rca.status} />
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#0176D3" strokeWidth="2" className="w-5 h-5 flex-shrink-0">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
            <div className="text-center flex-1">
              <div className="text-xs text-[#706E6B] mb-1">Next</div>
              <StatusPill status={nextStage} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Owner (who is moving this?)</label>
            <input
              className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
              value={actor}
              onChange={e => setActor(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Note (optional)</label>
            <textarea
              className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3] resize-none"
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any context for this stage transition…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? 'Advancing…' : `Move to ${STAGE_LABELS[nextStage]}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stage Timeline ───────────────────────────────────────────────────────────
function StageTimeline({ rca }) {
  const STAGES     = getStages(rca.severity);
  const currentIdx = STAGES.indexOf(rca.status);

  return (
    <div className="space-y-0">
      {STAGES.map((stage, idx) => {
        const h = rca.history?.find(h => h.stage === stage);
        const isCompleted = idx < currentIdx || rca.status === 'published';
        const isCurrent   = idx === currentIdx && rca.status !== 'published';
        const isPending   = idx > currentIdx;

        const vpBreach = stage === 'vp_review' && h?.duration_minutes > 48 * 60;

        return (
          <div key={stage} className="flex gap-4 relative">
            {/* Connector line */}
            {idx < STAGES.length - 1 && (
              <div className={`absolute left-5 top-10 w-0.5 h-full ${isCompleted ? 'bg-[#0176D3]' : 'bg-[#DDDBDA]'}`} style={{ zIndex: 0 }} />
            )}

            {/* Circle */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 mt-1"
              style={{
                background: isCompleted ? '#0176D3' : isCurrent ? '#FEF3C7' : '#F3F3F3',
                border: `2px solid ${isCompleted ? '#0176D3' : isCurrent ? '#B45309' : '#DDDBDA'}`,
              }}
            >
              {isCompleted ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-4 h-4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : isCurrent ? (
                <div className="w-2.5 h-2.5 rounded-full bg-[#B45309] animate-pulse" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-[#DDDBDA]" />
              )}
            </div>

            {/* Content */}
            <div className="pb-6 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${isPending ? 'text-[#AEAEAE]' : 'text-[#181818]'}`}>
                  {STAGE_LABELS[stage]}
                </span>
                {isCurrent && <span className="pill-yellow text-[10px]">In Progress</span>}
                {vpBreach && <span className="pill-red text-[10px]">SLO Breached</span>}
              </div>

              {h ? (
                <div className="mt-1 text-xs text-[#706E6B] space-y-0.5">
                  <div>Entered: <span className="text-[#3E3E3C]">{fmt(h.entered_at)}</span></div>
                  {h.exited_at && (
                    <div>Exited: <span className="text-[#3E3E3C]">{fmt(h.exited_at)}</span></div>
                  )}
                  {h.duration_minutes != null && (
                    <div>Duration: <span className={`font-medium ${vpBreach ? 'text-[#C23934]' : 'text-[#3E3E3C]'}`}>{durLabel(h.duration_minutes)}</span></div>
                  )}
                  {h.actor && <div>Owner: <span className="text-[#3E3E3C]">{h.actor}</span></div>}
                  {h.note && (
                    <div className="mt-1 bg-[#F3F3F3] rounded-[4px] px-2 py-1 italic">{h.note}</div>
                  )}
                </div>
              ) : (
                <div className="mt-1 text-xs text-[#AEAEAE]">Not yet started</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function RCADetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rca, setRca] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdvance, setShowAdvance] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await api.getRCA(id);
      setRca(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#706E6B] text-sm p-8">Loading…</div>;
  if (error)   return <div className="p-8 pill-red text-sm">{error}</div>;
  if (!rca)    return null;

  const STAGES      = getStages(rca.severity);
  const isPublished = rca.status === 'published';
  const currentIdx  = STAGES.indexOf(rca.status);

  return (
    <div className="p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#706E6B] mb-4">
        <Link to="/" className="hover:text-[#0176D3]">Dashboard</Link>
        <span>›</span>
        <span className="text-[#181818] truncate">{rca.incident_title}</span>
      </div>

      {/* Header card */}
      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <SeverityPill severity={rca.severity} />
              <StatusPill status={rca.status} />
              {!isPublished && <SLOBadge status={rca.slo_status} />}
            </div>
            <h1 className="text-lg font-bold text-[#181818] leading-tight">{rca.incident_title}</h1>
            <div className="mt-2 text-sm text-[#706E6B] space-y-0.5">
              {rca.rca_type === 'multi' ? (
                <div>
                  <span className="font-medium text-[#3E3E3C]">Impacted customers:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(Array.isArray(rca.impacted_accounts) ? rca.impacted_accounts : []).map(acct => (
                      <span key={acct} className="inline-block px-2 py-0.5 rounded-full bg-[#F3F3F3] border border-[#DDDBDA] text-xs text-[#3E3E3C]">
                        {acct}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div><span className="font-medium text-[#3E3E3C]">Customer:</span> {rca.customer_name}</div>
              )}
              <div><span className="font-medium text-[#3E3E3C]">Incident Date:</span> {fmt(rca.incident_date)}</div>
              {rca.assigned_vp && <div><span className="font-medium text-[#3E3E3C]">VP:</span> {rca.assigned_vp}</div>}
              {rca.rca_type === 'multi' ? (
                (() => {
                  const allCsms = [...new Set([
                    ...(Array.isArray(rca.impacted_csms) ? rca.impacted_csms : []),
                    ...(rca.assigned_csm ? [rca.assigned_csm] : []),
                  ])];
                  return allCsms.length > 0 && (
                    <div>
                      <span className="font-medium text-[#3E3E3C]">CSMs:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {allCsms.map(csm => (
                          <span key={csm} className="inline-block px-2 py-0.5 rounded-full bg-[#F3F3F3] border border-[#DDDBDA] text-xs text-[#3E3E3C]">
                            {csm}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                rca.assigned_csm && <div><span className="font-medium text-[#3E3E3C]">CSM:</span> {rca.assigned_csm}</div>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {/* Portal link */}
            <a
              href={`/portal/${rca.incident_id}`}
              target="_blank"
              rel="noreferrer"
              className="btn-outline flex items-center gap-1.5 text-xs"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Customer Portal
            </a>

            {!isPublished && (
              <button
                className="btn-primary flex items-center gap-1.5 text-xs"
                onClick={() => setShowAdvance(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
                Advance to {STAGE_LABELS[STAGES[currentIdx + 1]]}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Impacted Services */}
      <ImpactedServicesCard rca={rca} onUpdate={load} />

      {/* Stage Timeline */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[#181818] mb-5">Stage Timeline</h2>
        <StageTimeline rca={rca} />
      </div>

      {showAdvance && (
        <AdvanceModal
          rca={rca}
          onClose={() => setShowAdvance(false)}
          onAdvanced={load}
        />
      )}
    </div>
  );
}
