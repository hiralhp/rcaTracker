import { NavLink } from 'react-router-dom';

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    roles: ['csm', 'vp'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Operational Insights',
    roles: ['vp'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export default function Sidebar({ role, setRole }) {
  const visibleNav = NAV.filter(item => item.roles.includes(role));

  return (
    <aside className="w-64 flex-shrink-0 bg-[#032D60] flex flex-col h-full">
      {/* Logo / App header */}
      <div className="px-5 py-5 border-b border-[#1a4a7a]">
        <div className="flex items-center gap-3">
          {/* Salesforce cloud mark */}
          <svg viewBox="0 0 64 44" className="w-9 h-6 flex-shrink-0" fill="white">
            <path d="M26.5 4C22.4 4 18.7 5.9 16.3 9A13.5 13.5 0 0 0 8 6.5C1.3 6.5-3.5 12.5 4.3 19.5L4 20c0 6.6 5.4 12 12 12 1.7 0 3.3-.4 4.8-1A12 12 0 0 0 32 35a12 12 0 0 0 11-7.1A9.5 9.5 0 0 0 60 19.5c0-5.2-4.3-9.5-9.5-9.5-.9 0-1.8.1-2.6.3C45.8 6.1 41.4 4 36.5 4c-2.4 0-4.6.6-6.5 1.6A11.9 11.9 0 0 0 26.5 4Z" />
          </svg>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">RCA Tracker</div>
            <div className="text-[#8aadce] text-xs">Incident Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#0176D3] text-white'
                  : 'text-[#c8dff0] hover:bg-[#1a4a7a] hover:text-white'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer — role switcher */}
      <div className="px-4 py-4 border-t border-[#1a4a7a]">
        <div className="text-[#8aadce] text-xs mb-2 font-medium uppercase tracking-wide">View as</div>
        <div className="flex gap-2">
          <button
            onClick={() => setRole('csm')}
            className={`flex-1 py-1.5 rounded-[4px] text-xs font-semibold transition-colors ${
              role === 'csm'
                ? 'bg-[#0176D3] text-white'
                : 'bg-[#1a4a7a] text-[#c8dff0] hover:bg-[#234f80]'
            }`}
          >
            CSM
          </button>
          <button
            onClick={() => setRole('vp')}
            className={`flex-1 py-1.5 rounded-[4px] text-xs font-semibold transition-colors ${
              role === 'vp'
                ? 'bg-[#0176D3] text-white'
                : 'bg-[#1a4a7a] text-[#c8dff0] hover:bg-[#234f80]'
            }`}
          >
            VP
          </button>
        </div>
      </div>
    </aside>
  );
}
