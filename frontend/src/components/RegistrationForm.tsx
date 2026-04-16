import { useState, useEffect, type FormEvent } from 'react';
import axios from 'axios';
import { Send, CheckCircle, Info } from 'lucide-react';

const COURSES = [
  '3 años A', '3 años B', '4 años A', '4 años B', '5 años A', '5 años B',
  '1º EPO A', '1º EPO B', '2º EPO A', '2º EPO B', '3º EPO A', '3º EPO B', '4º EPO A', '4º EPO B', '5º EPO A', '5º EPO B', '6º EPO A', '6º EPO B',
  '1º ESO A', '1º ESO B', '2º ESO A', '2º ESO B', '3º ESO A', '3º ESO B', '4º ESO A', '4º ESO B'
];

const SHIRT_SIZES = ['4y', '8y', '12y', '16y', 's', 'm', 'l', 'xl', 'xxl'];

interface Props {
  apiBase: string;
  event: any;
  preselectCourse?: string | null;
}

export default function RegistrationForm({ apiBase, event, preselectCourse }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'alumno',
    course: preselectCourse || COURSES[0],
    full_name: '',
    total_participants: 1,
    ampa_members: 0,
    wants_shirts: false,
    shirts: { '4y': 0, '8y': 0, '12y': 0, '16y': 0, 's': 0, 'm': 0, 'l': 0, 'xl': 0, 'xxl': 0 },
    observations: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (preselectCourse) {
      setFormData(prev => ({ ...prev, course: preselectCourse }));
    }
  }, [preselectCourse]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Sanitize numeric fields before sending: empty strings should be 0 or 1
    const sanitizedData = {
      ...formData,
      event_id: event.id,
      total_participants: formData.total_participants === ('' as any) ? 1 : Number(formData.total_participants),
      ampa_members: formData.ampa_members === ('' as any) ? 0 : Number(formData.ampa_members),
      shirts: Object.keys(formData.shirts).reduce((acc, size) => {
        const val = (formData.shirts as any)[size];
        acc[size] = val === '' ? 0 : Number(val);
        return acc;
      }, {} as any)
    };

    try {
      await axios.post(`${apiBase}/api/register`, sanitizedData);
      setSubmitted(true);
    } catch (err) {
      alert('Error en el registro. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleShirtChange = (size: string, value: string) => {
    // Allow empty string for clearing inputs
    const val = value === '' ? '' : parseInt(value);
    setFormData({ ...formData, shirts: { ...formData.shirts, [size]: val } });
  };

  if (submitted) {
    return (
      <div className="card glass animate success-message">
        <CheckCircle size={64} color="var(--primary, #10b981)" style={{ marginBottom: 20 }} />
        <h2>¡Registro Completado!</h2>
        <p style={{ marginTop: 15, color: '#475569' }}>
          Tus datos han sido guardados correctamente en <strong>{event.name}</strong>.
        </p>
        <button className="btn btn-primary" style={{ marginTop: 30 }} onClick={() => setSubmitted(false)}>
          Nuevo Registro
        </button>
      </div>
    );
  }

  return (
    <div className="card glass animate">
      {event.config?.assets?.banner_url && (
        <img 
          src={event.config.assets.banner_url} 
          alt="Cartel del evento" 
          style={{ width: '100%', borderRadius: 16, marginBottom: 30, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
        />
      )}
      <h1>{event.name}</h1>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Soy...</label>
          <select 
            value={formData.type} 
            onChange={e => setFormData({ ...formData, type: e.target.value })}
          >
            <option value="profesor">Profesor/a</option>
            <option value="alumno">Alumno/a</option>
            <option value="externo">Externo/a (Amigos, Antiguos alumnos, etc.)</option>
          </select>
        </div>

        {formData.type === 'alumno' && (
          <div className="input-group">
            <label>Curso/Grupo</label>
            <select 
              value={formData.course} 
              onChange={e => setFormData({ ...formData, course: e.target.value })}
            >
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div className="input-group">
          <label>Apellidos y Nombre</label>
          <input 
            type="text" 
            required 
            placeholder="Ej: García López, Juan"
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
          />
        </div>

        {formData.type === 'externo' && (
          <div className="grid" style={{ marginBottom: 20 }}>
            <div className="input-group">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                required 
                placeholder="ejemplo@email.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Teléfono</label>
              <input 
                type="tel" 
                required 
                placeholder="600 000 000"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="grid" style={{ marginBottom: 20 }}>
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              Participantes Totales 
              <div className="tooltip">
                <Info size={12} />
                <span className="tooltiptext">Incluye a todos los miembros a registrar tanto si son del AMPA como si no.</span>
              </div>
            </label>
            <input 
              type="number" 
              min="1" 
              required
              value={formData.total_participants}
              onChange={e => setFormData({ ...formData, total_participants: e.target.value === '' ? '' : parseInt(e.target.value) as any })}
            />
          </div>
          <div className="input-group">
            <label>Miembros AMPA</label>
            <input 
              type="number" 
              min="0" 
              max={formData.total_participants === ('' as any) ? undefined : formData.total_participants}
              value={formData.ampa_members}
              onChange={e => setFormData({ ...formData, ampa_members: e.target.value === '' ? '' : parseInt(e.target.value) as any })}
            />
          </div>
        </div>

        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <input 
            type="checkbox" 
            id="wants_shirts" 
            style={{ width: 'auto' }}
            checked={formData.wants_shirts}
            onChange={e => setFormData({ ...formData, wants_shirts: e.target.checked })}
          />
          <label htmlFor="wants_shirts" style={{ marginBottom: 0 }}>¿Queréis camisetas de la carrera?</label>
        </div>

        {formData.wants_shirts && (
          <div className="input-group animate">
            <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              Tallaje de Camisetas
            </label>
            <div className="grid" style={{ background: 'rgba(0,0,0,0.2)', padding: 15, borderRadius: 12 }}>
              {SHIRT_SIZES.map(size => (
                <div key={size} className="shirt-input">
                  <label style={{ fontSize: '0.7rem' }}>{size.toUpperCase()}</label>
                  <input 
                    type="number" 
                    min="0" 
                    className="input-sm"
                    style={{ padding: '8px 5px' }}
                    value={(formData.shirts as any)[size]}
                    onChange={e => handleShirtChange(size, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="input-group">
          <label>Observaciones (Opcional)</label>
          <textarea 
            rows={3} 
            placeholder="Alergias, tallas especiales, etc."
            value={formData.observations}
            onChange={e => setFormData({ ...formData, observations: e.target.value })}
          ></textarea>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
          {loading ? 'Enviando...' : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Send size={18} /> Confirmar Inscripción
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
