import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StatusPill, { SeverityPill, STAGE_LABELS } from '../components/StatusPill';
import SLABadge from '../components/SLABadge';

const STAGES = ['requested', 'drafting', 'ai_draft_ready', 'vp_review', 'tech_writer_review', 'legal_review', 'published'];

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
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.createIncident({ ...form, incident_date: new Date(form.incident_date).toISOString() });
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
  const days = daysInStage(rca.stage_entered_at);

  return (
    <div
      className="card p-3 cursor-pointer hover:shadow-card-hover transition-shadow mb-2"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-xs font-semibold text-[#0176D3] leading-tight truncate">{rca.customer_name}</span>
        <SeverityPill severity={rca.severity} />
      </div>
      <p className="text-xs text-[#3E3E3C] leading-snug line-clamp-2 mb-2">{rca.incident_title}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#706E6B]">{formatDate(rca.incident_date)}</span>
        {rca.status !== 'published' && days !== null && (
          <span className={`text-[11px] font-medium ${parseFloat(days) > 2 ? 'text-[#C23934]' : 'text-[#706E6B]'}`}>
            {days}d
          </span>
        )}
      </div>
      {rca.status !== 'published' && (
        <div className="mt-2">
          <SLABadge status={rca.sla_status} />
        </div>
      )}
      {rca.assigned_csm && (
        <div className="mt-1.5 text-[11px] text-[#706E6B]">CSM: {rca.assigned_csm}</div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [rcas, setRcas] = useState([]);
  const [csms, setCsms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ severity: 'all', csm: 'all', sla_status: 'all' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.severity  !== 'all') params.severity   = filters.severity;
      if (filters.csm       !== 'all') params.csm        = filters.csm;
      if (filters.sla_status !== 'all') params.sla_status = filters.sla_status;
      const [rcaData, csmData] = await Promise.all([api.getRCAs(params), api.getCsms()]);
      setRcas(rcaData);
      setCsms(csmData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const grouped = STAGES.reduce((acc, s) => {
    acc[s] = rcas.filter(r => r.rca_status === s || r.status === s);
    return acc;
  }, {});

  const activeCount = rcas.filter(r => (r.rca_status || r.status) !== 'published').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#181818]">RCA Pipeline</h1>
          <p className="text-sm text-[#706E6B] mt-0.5">{activeCount} active RCAs in review</p>
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
          value={filters.csm}
          onChange={e => setFilters(f => ({ ...f, csm: e.target.value }))}
        >
          <option value="all">All CSMs</option>
          {csms.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="border border-[#DDDBDA] rounded-[4px] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0176D3]"
          value={filters.sla_status}
          onChange={e => setFilters(f => ({ ...f, sla_status: e.target.value }))}
        >
          <option value="all">All SLA Status</option>
          <option value="green">On Track</option>
          <option value="yellow">At Risk</option>
          <option value="red">Breached</option>
        </select>

        {(filters.severity !== 'all' || filters.csm !== 'all' || filters.sla_status !== 'all') && (
          <button
            className="text-xs text-[#0176D3] hover:underline"
            onClick={() => setFilters({ severity: 'all', csm: 'all', sla_status: 'all' })}
          >
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
                    stage === 'published'
                      ? 'bg-[#E3F1E3]'
                      : stage === 'vp_review'
                      ? 'bg-[#FEF3C7]'
                      : 'bg-[#032D60]'
                  }`}>
                    <span className={`text-xs font-semibold truncate ${
                      stage === 'published' ? 'text-[#2E7D32]'
                      : stage === 'vp_review' ? 'text-[#B45309]'
                      : 'text-white'
                    }`}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className={`text-xs font-bold ml-1 flex-shrink-0 ${
                      stage === 'published' ? 'text-[#2E7D32]'
                      : stage === 'vp_review' ? 'text-[#B45309]'
                      : 'text-white/70'
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
