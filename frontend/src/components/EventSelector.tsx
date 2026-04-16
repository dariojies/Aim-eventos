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
    <div className="event-selector-container">
      <header className="selector-header">
        <div className="logo-section">
          <h1>{org?.name || 'AIM Education'}</h1>
          <p>{org?.isGlobal ? 'Panel de Gestión Global' : 'Eventos Disponibles'}</p>
        </div>
        <button className="btn-admin-access" onClick={onAdminLogin}>
          <User size={18} />
          <span>Acceso Staff</span>
        </button>
      </header>

      <main className="events-grid">
        {events.length === 0 ? (
          <div className="no-events">
            <Calendar size={48} />
            <p>No hay eventos activos en este momento.</p>
          </div>
        ) : (
          events.map(event => (
            <div key={event.id} className="event-card" onClick={() => onSelect(event)}>
              <div className="event-card-content">
                <span className="org-badge">{event.org_name}</span>
                <h3>{event.name}</h3>
                <div className="event-details">
                  <span><MapPin size={14} /> Presencial</span>
                  <span><Calendar size={14} /> Activo</span>
                </div>
                <button className="btn-enter">
                  Inscribirse <ArrowRight size={16} />
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
