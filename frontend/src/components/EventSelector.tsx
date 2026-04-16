import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, MapPin, ArrowRight, User } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  slug: string;
  config: any;
  org_name: string;
}

interface EventSelectorProps {
  apiBase: string;
  onSelect: (event: Event) => void;
  onAdminLogin: () => void;
}

export default function EventSelector({ apiBase, onSelect, onAdminLogin }: EventSelectorProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [org, setOrg] = useState<{ name: string; isGlobal: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgRes, eventsRes] = await Promise.all([
          axios.get(`${apiBase}/api/organizations/current`),
          axios.get(`${apiBase}/api/events`)
        ]);
        setOrg(orgRes.data);
        setEvents(eventsRes.data);
      } catch (err) {
        console.error('Failed to load events', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [apiBase]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Cargando eventos...</p>
      </div>
    );
  }

  return (
    <div className="event-selector-container animate">
      <header className="selector-header">
        <div className="logo-section">
          <h1>{org?.name || 'AIM Events'}</h1>
          <p>{org?.isGlobal ? 'Portal de Eventos Públicos' : 'Eventos Disponibles'}</p>
        </div>
        <button className="btn-admin-access" onClick={onAdminLogin}>
          <User size={18} />
          <span>Acceso Staff</span>
        </button>
      </header>

      <div style={{ marginBottom: 60, textAlign: 'center' }}>
        <h2 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: 20, letterSpacing: '-0.04em' }}>
          Descubre el próximo <span style={{ color: 'var(--primary)' }}>desafío</span>
        </h2>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-dim)', maxWidth: '600px', margin: '0 auto' }}>
          Selecciona una de nuestras competiciones o eventos activos para comenzar tu registro.
        </p>
      </div>

      <main className="events-grid">
        {events.length === 0 ? (
          <div className="no-events">
            <Calendar size={48} />
            <p>No hay eventos activos en este momento.</p>
          </div>
        ) : (
          events.map(event => (
            <div 
              key={event.id} 
              className="event-card" 
              onClick={() => onSelect(event)}
              style={{ '--primary-gradient': event.config?.colors?.primary_gradient } as any}
            >
              <div className="event-card-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="org-badge">{event.org_name}</span>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
                </div>
                <h3>{event.name}</h3>
                <div className="event-details">
                  <span><MapPin size={16} /> Presencial</span>
                  <span><Calendar size={16} /> 2024</span>
                </div>
                <button className="btn-enter">
                  Inscribirse <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {org?.isGlobal && (
        <div className="superadmin-notice">
          <p>Estás en el dominio de administración global.</p>
        </div>
      )}
    </div>
  );
}
