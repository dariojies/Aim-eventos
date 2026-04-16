import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Sun, Moon } from 'lucide-react';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import EventSelector from './components/EventSelector';
import GlobalAdminDashboard from './components/GlobalAdminDashboard';

axios.defaults.withCredentials = true;
const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:8080' : '';

function GlobalAdminLoader() {
  const [auth, setAuth] = useState<{ authenticated: boolean; role: string } | null>(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/auth/status`)
      .then(res => setAuth({ authenticated: res.data.authenticated, role: res.data.role }))
      .catch(() => setAuth({ authenticated: false, role: 'none' }));
  }, []);

  if (!auth) return <div className="loading-screen"><div className="loader"></div></div>;

  if (!auth.authenticated || auth.role !== 'superadmin') {
    return <AdminLogin apiBase={API_BASE} />;
  }

  return <GlobalAdminDashboard apiBase={API_BASE} onLogout={() => window.location.reload()} />;
}

function EventLoader() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      axios.get(`${API_BASE}/api/events/${slug}`)
        .then(res => {
          setEventData(res.data);
          // Apply dynamic theming
          if (res.data.config?.colors) {
            const root = document.documentElement;
            const colors = res.data.config.colors;
            if (colors.primary_gradient) root.style.setProperty('--primary-gradient', colors.primary_gradient);
            if (colors.accent) root.style.setProperty('--primary', colors.accent); // Use accent as primary color
          }
        })
        .catch(() => navigate('/'))
        .finally(() => setLoading(false));
    }
  }, [slug, navigate]);

  if (loading) return <div className="loading-screen"><div className="loader"></div></div>;
  if (!eventData) return <Navigate to="/" />;

  return <RegistrationForm apiBase={API_BASE} event={eventData} />;
}

function AdminLoader() {
  const { slug } = useParams();
  const [eventData, setEventData] = useState<any>(null);
  const [auth, setAuth] = useState<{ authenticated: boolean; role: string } | null>(null);

  useEffect(() => {
    if (slug) {
      axios.get(`${API_BASE}/api/events/${slug}`).then(res => setEventData(res.data));
    }
    
    // Check auth status with event context
    axios.get(`${API_BASE}/api/auth/status`, { params: { eventId: slug } })
      .then(res => setAuth({ authenticated: res.data.authenticated, role: res.data.role }))
      .catch(() => setAuth({ authenticated: false, role: 'none' }));
  }, [slug]);

  if (!auth) return <div className="loading-screen"><div className="loader"></div></div>;

  if (!auth.authenticated || auth.role === 'unauthorized') {
    return <AdminLogin apiBase={API_BASE} />;
  }

  return <AdminDashboard apiBase={API_BASE} event={eventData} onLogout={() => window.location.reload()} />;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <BrowserRouter>
      <div className="app">
        <button 
          className="btn glass theme-toggle" 
          onClick={toggleTheme}
          style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, width: 45, height: 45, borderRadius: '50%', padding: 0 }}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <Routes>
          <Route path="/" element={
            <EventSelector 
              apiBase={API_BASE} 
              onSelect={(event) => window.location.href = `/${event.slug}`}
              onAdminLogin={() => window.location.href = '/admin-global'} 
            />
          } />
          
          <Route path="/admin-global" element={<GlobalAdminLoader />} />
          <Route path="/:slug" element={<EventLoader />} />
          <Route path="/:slug/admin" element={<AdminLoader />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
