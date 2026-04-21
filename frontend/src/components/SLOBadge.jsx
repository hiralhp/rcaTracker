export default function SLOBadge({ status }) {
  if (!status || status === 'closed') return null;

  const config = {
    green:  { label: 'On Track',  dot: 'bg-[#2E7D32]', text: 'text-[#2E7D32]', bg: 'bg-[#E3F1E3]' },
    yellow: { label: 'At Risk',   dot: 'bg-[#B45309]', text: 'text-[#B45309]', bg: 'bg-[#FEF3C7]' },
    red:    { label: 'Breached',  dot: 'bg-[#C23934]', text: 'text-[#C23934]', bg: 'bg-[#FDECEA]' },
  }[status];

  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
