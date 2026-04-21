// Shared Trust site chrome for customer-facing portal pages

export function SalesforceTopNav() {
  return (
    <nav className="bg-white border-b border-[#DDDBDA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-11 gap-6">
        <svg viewBox="0 0 64 44" className="w-8 h-6 flex-shrink-0" fill="none">
          <path fill="#00A1E0" d="M26.5 4C22.4 4 18.7 5.9 16.3 9A13.5 13.5 0 0 0 8 6.5C1.3 6.5-3.5 12.5 4.3 19.5L4 20c0 6.6 5.4 12 12 12 1.7 0 3.3-.4 4.8-1A12 12 0 0 0 32 35a12 12 0 0 0 11-7.1A9.5 9.5 0 0 0 60 19.5c0-5.2-4.3-9.5-9.5-9.5-.9 0-1.8.1-2.6.3C45.8 6.1 41.4 4 36.5 4c-2.4 0-4.6.6-6.5 1.6A11.9 11.9 0 0 0 26.5 4Z" />
        </svg>
        <div className="hidden md:flex items-center gap-5 text-sm text-[#181818]">
          {['Products', 'Industries', 'Customers', 'Learning', 'Support', 'Company', 'Salesforce+'].map(n => (
            <span key={n} className="cursor-default hover:text-[#0176D3] whitespace-nowrap">{n}</span>
          ))}
        </div>
        <div className="ml-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="#706E6B" strokeWidth="1.5" className="w-5 h-5">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>
    </nav>
  );
}

export function TrustSubNav() {
  return (
    <nav className="bg-white border-b border-[#DDDBDA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-stretch h-11">
        <span className="text-lg font-bold text-[#181818] flex items-center pr-8">Trust</span>
        {[{ label: 'Status', active: true }, { label: 'Tenants', active: false }, { label: 'More ▾', active: false }].map(({ label, active }) => (
          <span key={label}
            className={`px-4 flex items-center text-sm cursor-default border-b-2 -mb-px ${
              active ? 'border-[#032D60] text-[#032D60] font-medium' : 'border-transparent text-[#706E6B]'
            }`}>
            {label}
          </span>
        ))}
      </div>
    </nav>
  );
}

export function TealBanner() {
  return (
    <div className="bg-[#0B7B6E] text-white text-sm px-4 sm:px-6 py-2 flex items-center">
      <span className="bg-white text-[#0B7B6E] text-xs font-bold px-2 py-0.5 rounded mr-3 flex-shrink-0">Beta</span>
      <span>Welcome to the Personalized Trust – Try it Now!</span>
      <span className="ml-auto text-white/75 text-xs cursor-default hover:text-white flex-shrink-0 pl-4">FAQ &amp; Feedback</span>
    </div>
  );
}
