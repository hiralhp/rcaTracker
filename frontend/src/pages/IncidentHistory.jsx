import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { SalesforceTopNav, TrustSubNav, TealBanner } from '../components/PortalChrome';

function fmtDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(d));
}

function SevBadge({ sev }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded border flex-shrink-0 ${
      sev === 'Sev0'
        ? 'border-[#C23934] text-[#C23934]'
        : 'border-[#706E6B] text-[#706E6B]'
    }`}>
      {sev}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === 'resolved') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3F1E3] text-[#2E7D32] flex-shrink-0">
      Resolved
    </span>
  );
  if (status === 'out_of_impact') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#92400E] flex-shrink-0">
      Out of Impact
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F4FE] text-[#0176D3] flex-shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-[#0176D3] animate-pulse inline-block" />
      In Progress
    </span>
  );
}

export default function IncidentHistory() {
  const [searchParams]            = useSearchParams();
  const customer                  = searchParams.get('customer') || '';
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    api.portalIncidents(customer)
      .then(setIncidents)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [customer]);

  return (
    <div className="min-h-screen bg-[#F3F3F3]">
      <SalesforceTopNav />
      <TrustSubNav />
      <TealBanner />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#181818]">Incident History</h1>
          <p className="text-sm text-[#706E6B] mt-1">
            {customer
              ? <>Showing incident communications for <strong className="text-[#3E3E3C]">{customer}</strong></>
              : 'View current and past incident communications'}
          </p>
        </div>

        {loading && (
          <div className="text-sm text-[#706E6B] py-12 text-center">Loading incidents…</div>
        )}

        {error && (
          <div className="bg-white rounded border border-[#DDDBDA] p-8 text-center">
            <p className="text-sm text-[#706E6B]">{error}</p>
          </div>
        )}

        {!loading && !error && incidents.length === 0 && (
          <div className="bg-white rounded border border-[#DDDBDA] p-8 text-center">
            <p className="text-sm text-[#706E6B]">No incidents on record.</p>
          </div>
        )}

        {!loading && !error && incidents.length > 0 && (
          <div className="bg-white rounded border border-[#DDDBDA] overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-[#DDDBDA] bg-[#F8F8F8]">
              <span className="text-xs font-medium text-[#706E6B] uppercase tracking-wide">Incident</span>
              <span className="text-xs font-medium text-[#706E6B] uppercase tracking-wide">Date</span>
              <span className="text-xs font-medium text-[#706E6B] uppercase tracking-wide">Severity</span>
              <span className="text-xs font-medium text-[#706E6B] uppercase tracking-wide">Status</span>
              <span className="text-xs font-medium text-[#706E6B] uppercase tracking-wide"></span>
            </div>

            {/* Rows */}
            {incidents.map((inc, idx) => (
              <div
                key={inc.id}
                className={`px-6 py-4 flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center gap-2 sm:gap-4 ${
                  idx > 0 ? 'border-t border-[#DDDBDA]' : ''
                }`}
              >
                {/* Title + services */}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#181818] leading-snug">{inc.title}</div>
                  {inc.services_count > 0 && (
                    <div className="text-xs text-[#706E6B] mt-0.5">
                      {inc.services_count} affected {inc.services_count === 1 ? 'service' : 'services'}
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="whitespace-nowrap">
                  <div className="text-xs text-[#706E6B]">{fmtDate(inc.incident_date)}</div>
                  {inc.impact_end_time && (
                    <div className="text-xs text-[#AEAEAE]">ended {fmtDate(inc.impact_end_time)}</div>
                  )}
                </div>

                {/* Severity */}
                <SevBadge sev={inc.severity} />

                {/* Status */}
                <StatusBadge status={inc.status} />

                {/* CTA */}
                <Link
                  to={`/portal/${inc.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#0176D3] text-[#0176D3] rounded hover:bg-[#E8F4FE] transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  View Details
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-[#DDDBDA] text-center text-xs text-[#AEAEAE]">
          <div className="font-medium text-[#706E6B] mb-1">Salesforce Trust</div>
          Incident communications are published as soon as they are finalized and reviewed.
        </div>
      </div>
    </div>
  );
}
