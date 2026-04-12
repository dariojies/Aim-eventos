import { useState, useEffect, type MouseEvent } from 'react';
import axios from 'axios';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';

axios.defaults.withCredentials = true;
const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:8080' : '';

import { Shield, Home } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'public' | 'admin-login' | 'admin-dashboard'>('public');
  const [authStatus, setAuthStatus] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is already logged in as admin
    axios.get(`${API_BASE}/api/auth/status`)
      .then(res => {
        setAuthStatus(res.data.authenticated);
        if (res.data.authenticated && window.location.pathname === '/admin') {
          setView('admin-dashboard');
        }
      })
      .catch(() => setAuthStatus(false));
  }, []);

  // Handle navigation and auth status
  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        if (authStatus === true) setView('admin-dashboard');
        else setView('admin-login');
      } else {
        setView('public');
      }
    };

    handlePathChange();
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, [authStatus]);

  const toggleAdmin = (e: MouseEvent) => {
    e.preventDefault();
    if (view === 'public') {
      window.history.pushState({}, '', '/admin');
      if (authStatus === true) setView('admin-dashboard');
      else setView('admin-login');
    } else {
      window.history.pushState({}, '', '/');
      setView('public');
    }
  };

  return (
    <div className="app">
      {view === 'public' && <RegistrationForm apiBase={API_BASE} />}
      {view === 'admin-login' && <AdminLogin apiBase={API_BASE} />}
      {view === 'admin-dashboard' && <AdminDashboard apiBase={API_BASE} onLogout={() => setAuthStatus(false)} />}
      
      <button className="fab-admin" onClick={toggleAdmin} title={view === 'public' ? 'Admin' : 'Inicio'}>
        {view === 'public' ? <Shield size={28} /> : <Home size={28} />}
      </button>
    </div>
  );
}
