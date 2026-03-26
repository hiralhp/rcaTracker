import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import RCADetail from './pages/RCADetail';
import Analytics from './pages/Analytics';
import Portal from './pages/Portal';

export default function App() {
  return (
    <Routes>
      {/* Customer portal — standalone, no sidebar */}
      <Route path="/portal/:incident_id" element={<Portal />} />

      {/* Internal tool — with sidebar */}
      <Route
        path="/*"
        element={
          <div className="flex h-screen overflow-hidden bg-[#F3F3F3]">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/"            element={<Dashboard />} />
                <Route path="/rca/:id"     element={<RCADetail />} />
                <Route path="/analytics"   element={<Analytics />} />
                <Route path="*"            element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        }
      />
    </Routes>
  );
}
