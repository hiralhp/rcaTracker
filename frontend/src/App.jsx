import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import RCADetail from './pages/RCADetail';
import Analytics from './pages/Analytics';
import Portal from './pages/Portal';
import IncidentHistory from './pages/IncidentHistory';

function getInitialRole() {
  return localStorage.getItem('rca_role') || 'csm';
}

export default function App() {
  const [role, setRole] = useState(getInitialRole);

  function handleSetRole(r) {
    setRole(r);
    localStorage.setItem('rca_role', r);
  }

  return (
    <Routes>
      {/* Customer portal — standalone, no sidebar */}
      <Route path="/portal" element={<IncidentHistory />} />
      <Route path="/portal/:incident_id" element={<Portal />} />

      {/* Internal tool — with sidebar */}
      <Route
        path="/*"
        element={
          <div className="flex h-screen overflow-hidden bg-[#F3F3F3]">
            <Sidebar role={role} setRole={handleSetRole} />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/"          element={<Dashboard role={role} setRole={handleSetRole} />} />
                <Route path="/rca/:id"   element={<RCADetail />} />
                <Route
                  path="/analytics"
                  element={role === 'vp' ? <Analytics /> : <Navigate to="/" replace />}
                />
                <Route path="*"          element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        }
      />
    </Routes>
  );
}
