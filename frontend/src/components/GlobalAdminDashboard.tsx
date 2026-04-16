import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Building2, Calendar, Layout, LogOut, ExternalLink, ArrowLeft } from 'lucide-react';

interface Props {
  apiBase: string;
  onLogout: () => void;
}

export default function GlobalAdminDashboard({ apiBase, onLogout }: Props) {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ org_id: '', name: '', slug: '', config: { colors: { primary_gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', accent: '#6366f1' }, assets: { banner_url: '' } } });

  const fetchData = async () => {
    try {
      const [orgsRes, eventsRes] = await Promise.all([
        axios.get(`${apiBase}/api/organizations`),
        axios.get(`${apiBase}/api/events`)
      ]);
      setOrgs(orgsRes.data);
      setEvents(eventsRes.data);
      if (orgsRes.data.length > 0) setNewEvent(prev => ({ ...prev, org_id: orgsRes.data[0].id }));
    } catch (err) {
      console.error('Unauthorized or error fetching data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [apiBase]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${apiBase}/api/events`, newEvent);
      setShowEventForm(false);
      fetchData();
      alert('Evento creado correctamente');
    } catch (err) {
      alert('Error creando evento. El slug debe ser único.');
    }
  };

  if (loading) return <div className="loading-screen"><div className="loader"></div></div>;

  return (
    <div className="container animate" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button className="btn glass" onClick={() => window.location.href = '/'} title="Volver al Portal">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Panel Global AIM</h1>
            <p style={{ color: 'var(--text-dim)' }}>Gestión de Organizaciones y Eventos</p>
          </div>
        </div>
        <button className="btn glass" onClick={onLogout} style={{ color: '#ef4444' }}>
          <LogOut size={18} />
        </button>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 30, marginBottom: 40 }}>
        <div className="glass" style={{ padding: 30, textAlign: 'center' }}>
          <Building2 size={32} color="var(--primary)" style={{ marginBottom: 15 }} />
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{orgs.length}</div>
          <label>Organizaciones</label>
        </div>
        <div className="glass" style={{ padding: 30, textAlign: 'center' }}>
          <Calendar size={32} color="var(--secondary)" style={{ marginBottom: 15 }} />
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{events.length}</div>
          <label>Eventos Totales</label>
        </div>
        <button className="btn btn-primary" style={{ height: 'auto' }} onClick={() => setShowEventForm(true)}>
          <Plus size={24} /> Crear Nuevo Evento
        </button>
      </div>

      <section>
        <h2 style={{ marginBottom: 20 }}>Eventos Activos</h2>
        <div className="glass" style={{ padding: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Organización</th>
                <th>Slug</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.name}</td>
                  <td><span className="badge badge-externo">{ev.org_name}</span></td>
                  <td><code>/{ev.slug}</code></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button className="btn glass" onClick={() => window.open(`/${ev.slug}`, '_blank')}>
                        <Layout size={16} /> Ver
                      </button>
                      <button className="btn glass" onClick={() => window.open(`/${ev.slug}/admin`, '_blank')}>
                        <ExternalLink size={16} /> Admin
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showEventForm && (
        <div className="glass modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ width: '90%', maxWidth: '600px', padding: 30 }}>
            <h2>Nuevo Evento</h2>
            <form onSubmit={handleCreateEvent} style={{ marginTop: 20 }}>
              <div className="input-group">
                <label>Organización</label>
                <select 
                  className="input" 
                  value={newEvent.org_id} 
                  onChange={e => setNewEvent({ ...newEvent, org_id: e.target.value })}
                >
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Nombre del Evento</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej: Carrera Solidaria 2024" 
                  value={newEvent.name} 
                  onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Slug (URL)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="ej: carrera-2024" 
                  value={newEvent.slug} 
                  onChange={e => setNewEvent({ ...newEvent, slug: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>URL del Cartel (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="URL de PostImage o similar" 
                  value={newEvent.config.assets.banner_url} 
                  onChange={e => setNewEvent({ ...newEvent, config: { ...newEvent.config, assets: { ...newEvent.config.assets, banner_url: e.target.value } } })}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 30 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear Evento</button>
                <button type="button" className="btn glass" onClick={() => setShowEventForm(false)} style={{ flex: 1 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
