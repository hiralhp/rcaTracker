const STAGE_LABELS = {
  requested:            'Requested',
  ai_draft_ready:       'AI Draft Ready',
  drafting:             'Drafting',
  service_owner_review: 'Service Owner Review',
  vp_svp_review:        'VP/SVP Review',
  tech_writer_review:   'Tech Writer Review',
  pr_legal_review:      'PR & Legal Review',
  published:            'Published',
};

export default function StatusPill({ status }) {
  if (status === 'published') {
    return <span className="pill-green">{STAGE_LABELS[status] || status}</span>;
  }
  if (['vp_svp_review', 'pr_legal_review'].includes(status)) {
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
