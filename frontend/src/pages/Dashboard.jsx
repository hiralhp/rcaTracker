import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StatusPill, { SeverityPill, STAGE_LABELS } from '../components/StatusPill';
import SLOBadge from '../components/SLOBadge';

const STAGES = ['requested', 'ai_draft_ready', 'drafting', 'service_owner_review', 'vp_svp_review', 'tech_writer_review', 'pr_legal_review', 'published'];

const CSM_NAME = 'Jake Wilson';

function daysInStage(stageEnteredAt) {
  if (!stageEnteredAt) return null;
  return ((Date.now() - new Date(stageEnteredAt).getTime()) / 86_400_000).toFixed(1);
}

function formatDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

// ─── Create Incident Modal ───────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', severity: 'Sev0', customer_name: '',
    incident_date: new Date().toISOString().slice(0, 16),
    assigned_vp: '', assigned_csm: '',
    rca_type: 'single', impacted_accounts_raw: '', impacted_csms_raw: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        severity: form.severity,
        customer_name: form.customer_name,
        incident_date: new Date(form.incident_date).toISOString(),
        assigned_vp: form.assigned_vp,
        assigned_csm: form.assigned_csm,
        rca_type: form.rca_type,
      };
      if (form.rca_type === 'multi') {
        payload.impacted_accounts = form.impacted_accounts_raw
          .split(',').map(s => s.trim()).filter(Boolean);
        payload.impacted_csms = form.impacted_csms_raw
          .split(',').map(s => s.trim()).filter(Boolean);
      }
      await api.createIncident(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <div className="px-6 py-4 border-b border-[#DDDBDA] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#181818]">Create New Incident + RCA</h2>
          <button onClick={onClose} className="text-[#706E6B] hover:text-[#181818]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="pill-red px-3 py-2 rounded text-sm">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Incident Title *</label>
            <input
              className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              placeholder="Brief description of the incident"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Severity *</label>
              <select
                className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                value={form.severity}
                onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
              >
                <option value="Sev1">Sev1 — Critical</option>
                <option value="Sev0">Sev0 — High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Incident Date *</label>
              <input
                type="datetime-local"
                className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                value={form.incident_date}
                onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Customer Name *</label>
            <input
              className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
              value={form.customer_name}
              onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
              required
              placeholder="e.g. Acme Corporation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Assigned VP</label>
              <input
                className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                value={form.assigned_vp}
                onChange={e => setForm(f => ({ ...f, assigned_vp: e.target.value }))}
                placeholder="Sarah Chen"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Assigned CSM</label>
              <input
                className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
                value={form.assigned_csm}
                onChange={e => setForm(f => ({ ...f, assigned_csm: e.target.value }))}
                placeholder="Jake Wilson"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3E3E3C] mb-1">RCA Type</label>
            <select
              className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
              value={form.rca_type}
              onChange={e => setForm(f => ({ ...f, rca_type: e.target.value }))}
            >
              <option value="single">Single Customer</option>
              <option value="multi">Multi Customer</option>
            </select>
          </div>

          {form.rca_type === 'multi' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Impacted Accounts</label>
                <textarea
                  className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3] resize-none"
                  rows={2}
                  value={form.impacted_accounts_raw}
                  onChange={e => setForm(f => ({ ...f, impacted_accounts_raw: e.target.value }))}
                  placeholder="Acme Corporation, TechFlow Industries, Global Dynamics"
                />
                <p className="text-[11px] text-[#706E6B] mt-0.5">Comma-separated list of impacted customer accounts</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3E3E3C] mb-1">Impacted CSMs</label>
                <textarea
                  className="w-full border border-[#DDDBDA] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3] resize-none"
                  rows={2}
                  value={form.impacted_csms_raw}
                  onChange={e => setForm(f => ({ ...f, impacted_csms_raw: e.target.value }))}
                  placeholder="Jake Wilson, Maria Santos, Tom Bradley"
                />
                <p className="text-[11px] text-[#706E6B] mt-0.5">Comma-separated list of impacted CSMs</p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────
function KanbanCard({ rca, onClick }) {
  const days          = daysInStage(rca.stage_entered_at);
  const isMulti       = rca.rca_type === 'multi';
  const impactedCsms  = Array.isArray(rca.impacted_csms)     ? rca.impacted_csms     : [];
  const impactedAccts = Array.isArray(rca.impacted_accounts) ? rca.impacted_accounts : [];

  // All CSMs involved: primary + additional
  const allCsms    = [...new Set([rca.assigned_csm, ...impactedCsms].filter(Boolean))];
  const displayCsms = allCsms.slice(0, 3);
  const extraCsms   = allCsms.length - displayCsms.length;

  return (
    <div
      className={`card p-3 cursor-pointer hover:shadow-card-hover transition-shadow mb-2${isMulti ? ' border-l-[3px] border-l-[#7B5EA7]' : ''}`}
      onClick={onClick}
    >
      {/* Customer + severity row */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-xs font-semibold text-[#0176D3] leading-tight truncate">
          {isMulti ? 'Multi' : rca.customer_name}
        </span>
        <SeverityPill severity={rca.severity} />
      </div>

      {/* Incident ID + Title */}
      <div className="text-[10px] text-[#AEAEAE] font-mono mb-0.5">
        INC-{String(rca.incident_id).padStart(4, '0')}
      </div>
      <p className="text-xs text-[#3E3E3C] leading-snug line-clamp-2 mb-2">{rca.incident_title}</p>

      {/* Date + age */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#706E6B]">{formatDate(rca.incident_date)}</span>
        {rca.status !== 'published' && days !== null && (
          <span className={`text-[11px] font-medium ${parseFloat(days) > 2 ? 'text-[#C23934]' : 'text-[#706E6B]'}`}>
            {days}d
          </span>
        )}
      </div>

      {/* SLO badge */}
      {rca.status !== 'published' && (
        <div className="mt-2">
          <SLOBadge status={rca.slo_status} />
        </div>
      )}

      {/* CSMs */}
      {allCsms.length > 0 && (
        <div
          className="mt-1.5 text-[11px] text-[#706E6B]"
          title={allCsms.join(', ')}
        >
          <span className="font-medium text-[#3E3E3C]">{isMulti ? 'CSMs' : 'CSM'}:</span>{' '}
          {displayCsms.join(', ')}
          {extraCsms > 0 && <span className="text-[#AEAEAE]"> +{extraCsms} more</span>}
        </div>
      )}

      {/* Impacted accounts count (multi only) */}
      {impactedAccts.length > 1 && (
        <div
          className="mt-0.5 text-[11px] text-[#706E6B]"
          title={impactedAccts.join(', ')}
        >
          {impactedAccts.length} accounts
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard({ role = 'vp', setRole }) {
  const navigate = useNavigate();
  const [rcas, setRcas]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showAll, setShowAll]     = useState(false);
  const [filters, setFilters]     = useState({
    severity: 'all', slo_status: 'all', rca_type: 'all', search: '',
  });

  // Reset showAll whenever the role changes (e.g. switching to VP via sidebar)
  useEffect(() => { setShowAll(false); }, [role]);

  // Debounce: push typed search into filters after 300 ms idle
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchInput }));
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.severity  !== 'all') params.severity   = filters.severity;
      if (filters.slo_status !== 'all') params.slo_status = filters.slo_status;
      if (filters.rca_type  !== 'all') params.rca_type   = filters.rca_type;
      if (filters.search)              params.search      = filters.search;
      if (role === 'csm' && !showAll)  params.csm         = CSM_NAME;
      const rcaData = await api.getRCAs(params);
      setRcas(rcaData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, role, showAll]);

  useEffect(() => { loadData(); }, [loadData]);

  const grouped = STAGES.reduce((acc, s) => {
    acc[s] = rcas.filter(r => r.rca_status === s || r.status === s);
    return acc;
  }, {});

  const activeCount = rcas.filter(r => (r.rca_status || r.status) !== 'published').length;

  const hasFilters =
    filters.severity !== 'all' ||
    filters.slo_status !== 'all' ||
    filters.rca_type !== 'all' ||
    filters.search !== '';

  function clearFilters() {
    setFilters({ severity: 'all', slo_status: 'all', rca_type: 'all', search: '' });
    setSearchInput('');
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#181818]">RCA Pipeline</h1>
          {role === 'csm' ? (
            <p className="text-sm text-[#706E6B] mt-0.5">
              {showAll ? (
                <>
                  Showing all incidents
                  {activeCount > 0 && <span> · {activeCount} active</span>}
                  <button
                    className="ml-2 text-[#0176D3] hover:underline font-normal"
                    onClick={() => setShowAll(false)}
                  >
                    Show mine
                  </button>
                </>
              ) : (
                <>
                  Showing incidents for <strong className="text-[#3E3E3C]">{CSM_NAME}</strong>
                  {activeCount > 0 && <span> · {activeCount} active</span>}
                  <button
                    className="ml-2 text-[#0176D3] hover:underline font-normal"
                    onClick={() => setShowAll(true)}
                  >
                    Show all
                  </button>
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-[#706E6B] mt-0.5">{activeCount} active RCAs in review</p>
          )}
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Incident
        </button>
      </div>

      {/* Filters */}
      <div className="card px-4 py-3 mb-5 flex flex-wrap gap-3 items-center">
        <span className="text-xs font-medium text-[#3E3E3C]">Filter:</span>

        {/* Text search */}
        <div className="relative">
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#706E6B] pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="border border-[#DDDBDA] rounded-[4px] pl-8 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3] w-72"
            placeholder="Search CSM, customer, title, RCA ID…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#706E6B] hover:text-[#181818] text-base leading-none"
              onClick={() => { setSearchInput(''); setFilters(f => ({ ...f, search: '' })); }}
            >
              ×
            </button>
          )}
        </div>

        {/* RCA Type toggle */}
        <div className="flex rounded-[4px] overflow-hidden border border-[#DDDBDA]">
          {['all', 'single', 'multi'].map(type => (
            <button
              key={type}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.rca_type === type
                  ? 'bg-[#0176D3] text-white'
                  : 'bg-white text-[#3E3E3C] hover:bg-[#F3F3F3]'
              }`}
              onClick={() => setFilters(f => ({ ...f, rca_type: type }))}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <select
          className="border border-[#DDDBDA] rounded-[4px] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
          value={filters.severity}
          onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
        >
          <option value="all">All Severities</option>
          <option value="Sev1">Sev1</option>
          <option value="Sev0">Sev0</option>
        </select>

        <select
          className="border border-[#DDDBDA] rounded-[4px] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
          value={filters.slo_status}
          onChange={e => setFilters(f => ({ ...f, slo_status: e.target.value }))}
        >
          <option value="all">All SLO Status</option>
          <option value="green">On Track</option>
          <option value="yellow">At Risk</option>
          <option value="red">Breached</option>
        </select>

        {hasFilters && (
          <button className="text-xs text-[#0176D3] hover:underline" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="pill-red px-4 py-2 rounded mb-4 text-sm">{error}</div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#706E6B] text-sm">Loading…</div>
      ) : (
        <div className="kanban-scroll">
          <div className="flex gap-3 min-w-max pb-2">
            {STAGES.map(stage => {
              const cards = grouped[stage] || [];
              return (
                <div key={stage} className="flex-shrink-0 w-56">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-[4px] mb-1 ${
                    stage === 'published' ? 'bg-[#E3F1E3]' : 'bg-[#032D60]'
                  }`}>
                    <span className={`text-xs font-semibold truncate ${
                      stage === 'published' ? 'text-[#2E7D32]' : 'text-white'
                    }`}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className={`text-xs font-bold ml-1 flex-shrink-0 ${
                      stage === 'published' ? 'text-[#2E7D32]' : 'text-white/70'
                    }`}>
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 min-h-[120px]">
                    {cards.map(rca => (
                      <KanbanCard
                        key={rca.rca_id || rca.id}
                        rca={{ ...rca, status: rca.rca_status || rca.status }}
                        onClick={() => navigate(`/rca/${rca.rca_id || rca.id}`)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="text-center py-6 text-[11px] text-[#AEAEAE]">Empty</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}
