const STAGE_LABELS = {
  requested:          'Requested',
  drafting:           'Drafting',
  ai_draft_ready:     'AI Draft Ready',
  vp_review:          'VP Review',
  tech_writer_review: 'Tech Writer',
  legal_review:       'Legal Review',
  published:          'Published',
};

export default function StatusPill({ status }) {
  if (status === 'published') {
    return <span className="pill-green">{STAGE_LABELS[status] || status}</span>;
  }
  if (status === 'vp_review') {
    return <span className="pill-yellow">{STAGE_LABELS[status] || status}</span>;
  }
  return <span className="pill-blue">{STAGE_LABELS[status] || status}</span>;
}

export function SeverityPill({ severity }) {
  if (severity === 'Sev1') {
    return <span className="pill-red font-semibold">{severity}</span>;
  }
  return <span className="pill-yellow">{severity}</span>;
}

export { STAGE_LABELS };
