import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { SalesforceTopNav, TrustSubNav, TealBanner } from '../components/PortalChrome';

function fmtDateTime(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(d));
}

function fmtDuration(minutes) {
  if (minutes == null || minutes < 0) return '—';
  if (minutes < 60) return `${minutes} Minute${minutes !== 1 ? 's' : ''}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} Hour${hours !== 1 ? 's' : ''}`;
  const days = Math.round(hours / 24);
  return `${days} Day${days !== 1 ? 's' : ''}`;
}

function hoursToFriendlyWindow(low, high) {
  if (!high || high === 0) return null;
  if (high <= 6)  return 'within a few hours';
  if (high <= 20) return 'within 1 day';
  const lowDays  = Math.max(1, Math.round(low  / 24));
  const highDays = Math.max(lowDays + 1, Math.round(high / 24));
  return `${lowDays}–${highDays} days`;
}

const CLARITY_OPTIONS = ['Clear and helpful', 'Somewhat unclear', 'Hard to understand'];
const TAG_OPTIONS     = ['Timeline was confusing', 'Not enough detail', 'Too technical', 'Unclear next steps', 'Took too long'];

// ─── Subscribe Modal ──────────────────────────────────────────────────────────
function SubscribeModal({ incidentId, initialData, onClose, onSuccess }) {
  const [email,      setEmail]      = useState(initialData?.email || '');
  const [prefs,      setPrefs]      = useState(
    initialData?.preferences || { incident_updates: true, future_incidents: false }
  );
  const [channels,   setChannels]   = useState(
    initialData?.channels || { email: true, slack: false }
  );
  const [slackUrl,   setSlackUrl]   = useState(initialData?.slack_webhook || '');
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');

  const handleSubmit = async () => {
    if (!email.trim())        { setFormError('Email address is required.');        return; }
    if (!email.includes('@')) { setFormError('Please enter a valid email address.'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      await api.subscribe(incidentId, {
        email:        email.trim(),
        channels:     Object.entries(channels).filter(([, v]) => v).map(([k]) => k),
        preferences:  Object.entries(prefs).filter(([, v]) => v).map(([k]) => k),
        slack_webhook: channels.slack && slackUrl.trim() ? slackUrl.trim() : null,
      });
      onSuccess({ email: email.trim(), preferences: prefs, channels, slack_webhook: channels.slack ? slackUrl.trim() : null });
    } catch (e) {
      setFormError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded border border-[#DDDBDA] shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDDBDA]">
          <h2 className="text-base font-semibold text-[#181818]">Subscribe to Updates</h2>
          <button onClick={onClose} className="text-[#706E6B] hover:text-[#181818] cursor-pointer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Email */}
          <div>
            <label className="text-xs font-medium text-[#3E3E3C] block mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm border border-[#DDDBDA] rounded text-[#3E3E3C] placeholder-[#AEAEAE] focus:outline-none focus:border-[#0176D3]"
            />
          </div>

          {/* Notify me about */}
          <div>
            <div className="text-xs font-medium text-[#3E3E3C] mb-2">Notify me about</div>
            <div className="space-y-2">
              {[
                { key: 'incident_updates', label: 'Updates to this incident' },
                { key: 'future_incidents', label: 'Future incidents for impacted services' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className="w-4 h-4 accent-[#0176D3] cursor-pointer"
                  />
                  <span className="text-sm text-[#3E3E3C]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Delivery channels */}
          <div>
            <div className="text-xs font-medium text-[#3E3E3C] mb-2">Delivery channels</div>
            <div className="space-y-3">
              {/* Email */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={channels.email}
                  onChange={() => setChannels(c => ({ ...c, email: !c.email }))}
                  className="w-4 h-4 accent-[#0176D3] cursor-pointer"
                />
                <span className="text-sm text-[#3E3E3C]">Email</span>
              </label>

              {/* Slack */}
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none mb-2">
                  <input
                    type="checkbox"
                    checked={channels.slack}
                    onChange={() => setChannels(c => ({ ...c, slack: !c.slack }))}
                    className="w-4 h-4 accent-[#0176D3] cursor-pointer"
                  />
                  <span className="text-sm text-[#3E3E3C]">Slack webhook</span>
                </label>
                {channels.slack && (
                  <input
                    type="url"
                    value={slackUrl}
                    onChange={e => setSlackUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="ml-6 w-[calc(100%-1.5rem)] px-3 py-1.5 text-xs border border-[#DDDBDA] rounded text-[#3E3E3C] placeholder-[#AEAEAE] focus:outline-none focus:border-[#0176D3]"
                  />
                )}
              </div>

              {/* SMS — disabled */}
              <label className="flex items-center gap-2.5 cursor-not-allowed select-none opacity-40">
                <input type="checkbox" disabled className="w-4 h-4 cursor-not-allowed" />
                <span className="text-sm text-[#3E3E3C]">SMS</span>
                <span className="ml-1 text-[10px] bg-[#F3F3F3] text-[#706E6B] px-1.5 py-0.5 rounded border border-[#DDDBDA]">
                  Coming soon
                </span>
              </label>
            </div>
          </div>

          {formError && <p className="text-xs text-[#C23934]">{formError}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DDDBDA] flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-[#706E6B] hover:text-[#181818] cursor-pointer transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-2 text-sm font-medium bg-[#0176D3] text-white rounded hover:bg-[#0161b5] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Subscribing…' : 'Subscribe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Portal() {
  const { incident_id } = useParams();
  const [data, setData]                           = useState(null);
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState('');
  const [showCompleted, setShowCompleted]         = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribed, setSubscribed]               = useState(false);
  const [subscribedData, setSubscribedData]       = useState(null);
  const [toast, setToast]                         = useState('');
  const [thumbs, setThumbs]                       = useState('');
  const [clarity, setClarity]                     = useState('');
  const [tags, setTags]                           = useState([]);
  const [note, setNote]                           = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const toggleTag = (tag) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  useEffect(() => {
    api.portal(incident_id)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [incident_id]);

  const handleSubscribeSuccess = (formData) => {
    setSubscribed(true);
    setSubscribedData(formData);
    setShowSubscribeModal(false);
    setToast("You're subscribed! We'll notify you of updates.");
    setTimeout(() => setToast(''), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F3F3]">
        <SalesforceTopNav /><TrustSubNav /><TealBanner />
        <div className="flex items-center justify-center py-24 text-[#706E6B] text-sm">Loading status…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F3F3]">
        <SalesforceTopNav /><TrustSubNav /><TealBanner />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded border border-[#DDDBDA] p-8 max-w-md mx-auto text-center mt-8">
            <h2 className="text-lg font-semibold text-[#181818] mb-2">Incident Not Found</h2>
            <p className="text-sm text-[#706E6B]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const isComplete        = data.current_status === 'complete';
  const etaWindow         = data.estimated_hours_remaining;
  const friendlyEta       = !isComplete ? hoursToFriendlyWindow(etaWindow?.low, etaWindow?.high) : null;
  const impact            = data.severity === 'Sev0' ? 'Major Disruption' : 'Disruption';
  const completedCount    = data.milestones.filter(m => m.status === 'complete').length;
  const visibleMilestones = showCompleted
    ? data.milestones
    : data.milestones.filter(m => m.status !== 'complete');

  return (
    <div className="min-h-screen bg-[#F3F3F3]">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-[#b8dbb8] shadow-lg text-sm px-4 py-3 rounded flex items-center gap-2.5 max-w-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5" className="w-4 h-4 flex-shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-[#2E7D32] font-medium">{toast}</span>
        </div>
      )}

      <SalesforceTopNav />
      <TrustSubNav />
      <TealBanner />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Back link + breadcrumb */}
        <div className="mb-4">
          <Link to={`/portal${data?.customer_name ? '?customer=' + encodeURIComponent(data.customer_name) : ''}`} className="inline-flex items-center gap-1 text-sm text-[#0176D3] hover:underline mb-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Incident History
          </Link>
          <div className="text-sm flex items-center gap-1">
            <span className="text-[#0176D3] cursor-default">Status</span>
            <span className="text-[#706E6B]">›</span>
            <span className="text-[#3E3E3C]">{incident_id}</span>
          </div>
        </div>

        {/* Incident summary card */}
        <div className="bg-white rounded border border-[#DDDBDA] p-6 mb-6">

          {/* Title row + subscribe button */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-2xl font-bold text-[#181818]">
              {data.title || `Incident #${incident_id}`}
            </h1>
            <div className="flex-shrink-0 pt-1">
              {subscribed ? (
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-sm text-[#2E7D32] font-medium justify-end">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Subscribed to updates
                  </div>
                  <button
                    onClick={() => setShowSubscribeModal(true)}
                    className="text-xs text-[#0176D3] hover:underline cursor-pointer mt-0.5"
                  >
                    Edit preferences
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSubscribeModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[#0176D3] text-[#0176D3] rounded hover:bg-[#E8F4FE] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  Subscribe to updates
                </button>
              )}
            </div>
          </div>

          {data.impacted_services && data.impacted_services.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-[#706E6B] mb-2">Affected Services</div>
              <div className="flex flex-wrap gap-2">
                {data.impacted_services.map(svc => (
                  <span key={svc} className="px-3 py-1 text-sm border border-[#DDDBDA] rounded bg-white text-[#3E3E3C]">
                    {svc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <hr className="border-[#DDDBDA] mb-4" />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
            <div>
              <div className="text-xs text-[#706E6B] mb-1">Status</div>
              <div className="text-sm text-[#181818]">{isComplete ? 'Resolved' : 'In Progress'}</div>
            </div>
            <div>
              <div className="text-xs text-[#706E6B] mb-1">Type</div>
              <span className="inline-block px-2 py-0.5 text-xs border border-[#C23934] text-[#C23934] rounded">
                Incident
              </span>
            </div>
            <div>
              <div className="text-xs text-[#706E6B] mb-1">Impact</div>
              <div className="text-sm text-[#181818]">{impact}</div>
            </div>
            <div>
              <div className="text-xs text-[#706E6B] mb-1">Start Time</div>
              <div className="text-sm text-[#181818]">{fmtDateTime(data.impact_start_time)}</div>
            </div>
            <div>
              <div className="text-xs text-[#706E6B] mb-1">End Time</div>
              <div className="text-sm text-[#181818]">
                {isComplete ? fmtDateTime(data.impact_end_time) : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#706E6B] mb-1">Duration</div>
              <div className="text-sm text-[#181818]">
                {isComplete
                  ? fmtDuration(data.duration_minutes)
                  : fmtDuration(Math.round((Date.now() - new Date(data.impact_start_time)) / 60_000))}
              </div>
            </div>
          </div>
        </div>

        {/* ETA banner */}
        {!isComplete && friendlyEta && (
          <div className="bg-[#E8F4FE] border border-[#b3d7f5] rounded px-5 py-4 mb-6 flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0176D3" strokeWidth="2" className="w-5 h-5 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <div className="text-sm font-semibold text-[#032D60]">Estimated completion: {friendlyEta}</div>
              <div className="text-xs text-[#706E6B] mt-1">Based on similar incidents. We'll update this page as we make progress.</div>
            </div>
          </div>
        )}

        {/* Progress timeline */}
        <div className="bg-white rounded border border-[#DDDBDA] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#181818] mb-5">Investigation Progress</h2>

          {completedCount > 0 && (
            <button
              onClick={() => setShowCompleted(s => !s)}
              className="flex items-center gap-1.5 text-xs text-[#0176D3] hover:underline mb-5 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`w-3.5 h-3.5 transition-transform ${showCompleted ? 'rotate-90' : ''}`}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {showCompleted ? 'Hide' : 'Show'} {completedCount} completed {completedCount === 1 ? 'step' : 'steps'}
            </button>
          )}

          <div className="space-y-0">
            {visibleMilestones.map((m, idx, arr) => {
              const isCompleted  = m.status === 'complete';
              const isInProgress = m.status === 'in_progress';
              const isPending    = m.status === 'pending';
              const isLast       = idx === arr.length - 1;
              const globalNum    = data.milestones.findIndex(ms => ms.key === m.key) + 1;

              return (
                <div key={m.key} className="flex gap-5 relative">
                  {!isLast && (
                    <div className="absolute left-5 top-12 w-0.5 bottom-0"
                      style={{ background: isCompleted ? '#0176D3' : '#DDDBDA', zIndex: 0 }} />
                  )}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 text-sm font-semibold"
                    style={{
                      background: isCompleted ? '#0176D3' : isInProgress ? '#fff' : '#F3F3F3',
                      border: `2px solid ${isCompleted ? '#0176D3' : isInProgress ? '#0176D3' : '#DDDBDA'}`,
                    }}>
                    {isCompleted ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span style={{ color: isInProgress ? '#0176D3' : '#AEAEAE' }}>{globalNum}</span>
                    )}
                  </div>
                  <div className={`pb-8 flex-1 ${isPending ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 flex-wrap pt-1.5">
                      <span className={`text-sm font-semibold ${
                        isCompleted ? 'text-[#181818]' : isInProgress ? 'text-[#0176D3]' : 'text-[#AEAEAE]'
                      }`}>
                        {m.label}
                      </span>
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E8F4FE] text-[#0176D3]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0176D3] animate-pulse inline-block" />
                          In progress
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[#706E6B]">{m.subtext}</div>
                    {isCompleted && m.completed_at && (
                      <div className="mt-1 text-xs text-[#AEAEAE]">Completed {fmtDateTime(m.completed_at)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {visibleMilestones.length === 0 && (
            <p className="text-xs text-[#706E6B]">All steps completed. Click above to view the full timeline.</p>
          )}
        </div>

        {/* Communication sent + feedback */}
        {isComplete && (
          <div className="bg-[#E3F1E3] border border-[#b8dbb8] rounded px-5 py-4 flex items-start gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2" className="w-5 h-5 flex-shrink-0 mt-0.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#2E7D32]">Communication Sent</div>
              {data.published_at && (
                <div className="text-xs text-[#2E7D32] mt-0.5">{fmtDateTime(data.published_at)}</div>
              )}
              <div className="text-xs text-[#3E3E3C] mt-1">
                The full incident communication has been sent. Thank you for your patience.
              </div>
              <div className="mt-4 pt-4 border-t border-[#b8dbb8]">
                {feedbackSubmitted ? (
                  <div className="text-xs text-[#2E7D32] font-medium">
                    ✓ Thanks — this helps us improve incident communication.
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-[#706E6B] font-medium mb-2">Was this communication helpful?</div>
                    <div className="flex gap-2 mb-4">
                      {[
                        { val: 'up',   label: 'Yes', activeColor: '#2E7D32', d: 'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3' },
                        { val: 'down', label: 'No',  activeColor: '#C23934', d: 'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17' },
                      ].map(({ val, label, activeColor, d }) => (
                        <button key={val} type="button"
                          onClick={() => setThumbs(p => p === val ? '' : val)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-colors cursor-pointer"
                          style={{
                            background:  thumbs === val ? activeColor : 'white',
                            borderColor: thumbs === val ? activeColor : '#b8dbb8',
                            color:       thumbs === val ? 'white' : '#3E3E3C',
                          }}>
                          <svg viewBox="0 0 24 24" fill={thumbs === val ? 'white' : 'none'} stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                            <path d={d} />
                          </svg>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-[#AEAEAE] mb-1.5">Optional — how clear was the explanation?</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {CLARITY_OPTIONS.map(opt => (
                        <button key={opt} type="button" onClick={() => setClarity(p => p === opt ? '' : opt)}
                          className="px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer"
                          style={{
                            background:  clarity === opt ? '#2E7D32' : 'white',
                            borderColor: clarity === opt ? '#2E7D32' : '#b8dbb8',
                            color:       clarity === opt ? 'white'   : '#3E3E3C',
                          }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {TAG_OPTIONS.map(tag => (
                        <button key={tag} type="button" onClick={() => toggleTag(tag)}
                          className="px-2.5 py-0.5 text-[11px] rounded-full border transition-colors cursor-pointer"
                          style={{
                            background:  tags.includes(tag) ? '#2E7D32' : 'white',
                            borderColor: tags.includes(tag) ? '#2E7D32' : '#b8dbb8',
                            color:       tags.includes(tag) ? 'white'   : '#3E3E3C',
                          }}>
                          {tag}
                        </button>
                      ))}
                    </div>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Add a quick note (optional)"
                      className="w-full px-3 py-2 text-xs border border-[#b8dbb8] rounded bg-white text-[#3E3E3C] placeholder-[#AEAEAE] focus:outline-none focus:border-[#2E7D32] mb-3" />
                    <button type="button" disabled={!thumbs} onClick={() => setFeedbackSubmitted(true)}
                      className="px-4 py-1.5 text-xs font-medium bg-[#2E7D32] text-white rounded hover:bg-[#256428] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                      Submit feedback
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#DDDBDA] text-center text-xs text-[#AEAEAE]">
          <div className="font-medium text-[#706E6B] mb-1">Salesforce Trust</div>
          This page is updated in real time as our team works through the investigation.
          <br />For urgent inquiries, contact your account team.
        </div>
      </div>

      {/* Subscribe modal */}
      {showSubscribeModal && (
        <SubscribeModal
          incidentId={incident_id}
          initialData={subscribedData}
          onClose={() => setShowSubscribeModal(false)}
          onSuccess={handleSubscribeSuccess}
        />
      )}
    </div>
  );
}
