import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

const MILESTONE_ICONS = {
  investigating:   '🔍',
  root_cause:      '🎯',
  draft_in_review: '📝',
  communication:   '✅',
};

function fmt(d) {
  if (!d) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(d));
}

function estWindow(low, high) {
  if (low === 0 && high === 0) return null;
  if (low < 1 && high < 1) return 'Less than 1 hour';
  if (low === high) return `~${high} hours`;
  return `${low}–${high} hours`;
}

export default function Portal() {
  const { incident_id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.portal(incident_id)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [incident_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex items-center justify-center">
        <div className="text-[#706E6B] text-sm">Loading status…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F3F3] flex items-center justify-center p-8">
        <div className="bg-white rounded-[4px] shadow-card border border-[#DDDBDA] p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-semibold text-[#181818] mb-2">Incident Not Found</h2>
          <p className="text-sm text-[#706E6B]">{error}</p>
        </div>
      </div>
    );
  }

  const isComplete = data.current_status === 'complete';
  const window     = data.estimated_hours_remaining;

  return (
    <div className="min-h-screen bg-[#F3F3F3]">
      {/* Header */}
      <header className="bg-[#032D60] text-white px-6 py-5 shadow">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <svg viewBox="0 0 64 44" className="w-10 h-7 flex-shrink-0" fill="white">
            <path d="M26.5 4C22.4 4 18.7 5.9 16.3 9A13.5 13.5 0 0 0 8 6.5C1.3 6.5-3.5 12.5 4.3 19.5L4 20c0 6.6 5.4 12 12 12 1.7 0 3.3-.4 4.8-1A12 12 0 0 0 32 35a12 12 0 0 0 11-7.1A9.5 9.5 0 0 0 60 19.5c0-5.2-4.3-9.5-9.5-9.5-.9 0-1.8.1-2.6.3C45.8 6.1 41.4 4 36.5 4c-2.4 0-4.6.6-6.5 1.6A11.9 11.9 0 0 0 26.5 4Z" />
          </svg>
          <div>
            <div className="font-semibold text-lg leading-tight">Salesforce Trust</div>
            <div className="text-[#8aadce] text-xs">Incident Communication Status</div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Incident info card */}
        <div className="bg-white rounded-[4px] shadow-card border border-[#DDDBDA] p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {data.severity === 'Sev1' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FDECEA] text-[#C23934]">
                    Critical
                  </span>
                )}
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3F1E3] text-[#2E7D32]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8F4FE] text-[#0176D3]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0176D3] animate-pulse inline-block" />
                    In Progress
                  </span>
                )}
              </div>
              <p className="text-xs text-[#706E6B]">
                Incident reported on <strong className="text-[#3E3E3C]">{fmt(data.incident_date)}</strong>
              </p>
              <p className="text-xs text-[#706E6B] mt-0.5">
                Prepared for <strong className="text-[#3E3E3C]">{data.customer_name}</strong>
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#706E6B]">Case Reference</div>
              <div className="font-mono text-sm font-semibold text-[#032D60]">INC-{String(data.incident_id).padStart(5, '0')}</div>
            </div>
          </div>
        </div>

        {/* Estimated completion (if in progress) */}
        {!isComplete && window && (window.low > 0 || window.high > 0) && (
          <div className="bg-[#E8F4FE] border border-[#b3d7f5] rounded-[4px] px-5 py-4 mb-6 flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0176D3" strokeWidth="2" className="w-5 h-5 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <div className="text-sm font-semibold text-[#032D60]">Estimated Time to Completion</div>
              <div className="text-sm text-[#0176D3] mt-0.5">
                {estWindow(window.low, window.high)} remaining
              </div>
              <div className="text-xs text-[#706E6B] mt-1">
                Based on historical averages for similar incidents. Actual time may vary.
              </div>
            </div>
          </div>
        )}

        {/* Progress timeline */}
        <div className="bg-white rounded-[4px] shadow-card border border-[#DDDBDA] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#181818] mb-6">Investigation Progress</h2>

          <div className="space-y-0">
            {data.milestones.map((m, idx) => {
              const isCompleted   = m.status === 'complete';
              const isInProgress  = m.status === 'in_progress';
              const isPending     = m.status === 'pending';
              const isLast        = idx === data.milestones.length - 1;

              return (
                <div key={m.key} className="flex gap-5 relative">
                  {/* Connector */}
                  {!isLast && (
                    <div
                      className="absolute left-5 top-12 w-0.5 bottom-0"
                      style={{ background: isCompleted ? '#0176D3' : '#DDDBDA', zIndex: 0 }}
                    />
                  )}

                  {/* Circle */}
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 text-base shadow-sm"
                    style={{
                      background: isCompleted ? '#0176D3' : isInProgress ? '#FFF' : '#F3F3F3',
                      border: `2px solid ${isCompleted ? '#0176D3' : isInProgress ? '#0176D3' : '#DDDBDA'}`,
                    }}
                  >
                    {isCompleted ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className={isPending ? 'opacity-30' : ''}>{MILESTONE_ICONS[m.key]}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pb-8 flex-1 ${isPending ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 flex-wrap pt-1.5">
                      <span className={`text-base font-semibold ${isCompleted ? 'text-[#181818]' : isInProgress ? 'text-[#0176D3]' : 'text-[#AEAEAE]'}`}>
                        {m.label}
                      </span>
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F4FE] text-[#0176D3]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0176D3] animate-pulse inline-block" />
                          In progress
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-[#706E6B]">
                      {isCompleted && m.completed_at && (
                        <span>Completed {fmt(m.completed_at)}</span>
                      )}
                      {isInProgress && m.estimated_hours_remaining != null && m.estimated_hours_remaining > 0 && (
                        <span>Est. {m.estimated_hours_remaining}h remaining</span>
                      )}
                      {isInProgress && (!m.estimated_hours_remaining || m.estimated_hours_remaining === 0) && (
                        <span>Nearly complete</span>
                      )}
                      {isPending && <span>Pending</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Published confirmation */}
        {isComplete && data.published_at && (
          <div className="bg-[#E3F1E3] border border-[#b8dbb8] rounded-[4px] px-5 py-4 flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2" className="w-5 h-5 flex-shrink-0 mt-0.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <div className="text-sm font-semibold text-[#2E7D32]">Root Cause Analysis Published</div>
              <div className="text-xs text-[#2E7D32] mt-0.5">{fmt(data.published_at)}</div>
              <div className="text-xs text-[#3E3E3C] mt-1">
                The full RCA communication has been sent. Thank you for your patience.
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#DDDBDA] text-center text-xs text-[#AEAEAE]">
          <div className="font-medium text-[#706E6B] mb-1">Salesforce Trust &amp; Reliability</div>
          This page is updated in real time as our team works through the investigation.
          <br />
          For urgent inquiries, contact your account team.
        </div>
      </div>
    </div>
  );
}
