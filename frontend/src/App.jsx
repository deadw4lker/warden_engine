import React, { useState, useEffect } from 'react';
import { api, getToken, getCurrentUser } from './api';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AgentRegistry from './pages/AgentRegistry';
import Approvals from './pages/Approvals';
import LedgerExplorer from './pages/LedgerExplorer';
import Policies from './pages/Policies';
import Reports from './pages/Reports';
import Connect from './pages/Connect';
import Navbar from './components/Navbar';

export default function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);
  // Pre-login flow ported from warden-frontend-main.zip: landing -> login/signup
  const [authView, setAuthView] = useState('landing');

  // Listen for session expiry events (401 from api.js)
  useEffect(() => {
    const handler = () => { setUser(null); };
    window.addEventListener('warden_auth_expired', handler);
    return () => window.removeEventListener('warden_auth_expired', handler);
  }, []);

  // Poll pending approvals count for badge
  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      try {
        const data = await api.getApprovals({ status: 'PENDING_APPROVAL' });
        setPendingCount(Array.isArray(data) ? data.length : (data.items?.length ?? 0));
      } catch {
        // silently ignore
      }
    };
    fetchPending();
    const iv = setInterval(fetchPending, 15000);
    return () => clearInterval(iv);
  }, [user]);

  const handleLogin = (userData) => setUser(userData);
  const handleLogout = () => {
    api.logout();
    setUser(null);
    setAuthView('landing');
  };

  if (!user) {
    if (authView === 'signup') {
      return <Signup onLogin={() => setAuthView('login')} onSignupDone={handleLogin} onBack={() => setAuthView('landing')} />;
    }
    if (authView === 'login') {
      return <Login onLogin={handleLogin} onSignup={() => setAuthView('signup')} onBack={() => setAuthView('landing')} />;
    }
    return <Landing onLogin={() => setAuthView('login')} onSignup={() => setAuthView('signup')} />;
  }

  const pages = {
    dashboard: <Dashboard user={user} onSelectTab={setActiveTab} />,
    agents: <AgentRegistry user={user} />,
    connect: <Connect />,
    approvals: <Approvals user={user} />,
    ledger: <LedgerExplorer />,
    policies: <Policies />,
    reports: <Reports />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FA]">
      <Navbar
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingApprovalsCount={pendingCount}
      />
      <main className="flex-1 min-w-0 overflow-y-auto bg-[#F4F7FA]">
        {pages[activeTab] || pages.dashboard}
      </main>
    </div>
  );
}
