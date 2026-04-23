import { useState, useEffect, type FormEvent } from 'react';
import axios from 'axios';
import { Shield, Send, Info, ArrowLeft } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState<any>(null);

  const SIZE_LABELS: any = {
    '4y': '4 AÑOS',
    '8y': '8 AÑOS',
    '12y': '12 AÑOS',
    '16y': '16 AÑOS',
    's': 'S',
    'm': 'M',
    'l': 'L',
    'xl': 'XL',
    'xxl': 'XXL'
  };

  useEffect(() => {
    fetchStock();
  }, [event.slug]);

  const fetchStock = async () => {
    try {
      const res = await axios.get(`${apiBase}/api/events/${event.slug}/shirts-stock`);
      setStock(res.data);
    } catch (e) {
      console.error("Error fetching stock:", e);
    }
  };

  const getInitialState = () => ({
    type: 'alumno',
    course: preselectCourse || COURSES[0],
    full_name: '',
    total_participants: 1,
    ampa_members: 0,
    wants_shirts: false,
    shirts: { '4y': 0, '8y': 0, '12y': 0, '16y': 0, 's': 0, 'm': 0, 'l': 0, 'xl': 0, 'xxl': 0 },
    observations: '',
    email: '',
    phone: '',
    wants_dorsal: true
  });

  const [formData, setFormData] = useState(getInitialState());

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
      course: formData.type === 'alumno' ? formData.course : '', // Only students have a course
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
      setFormData(getInitialState());
      fetchStock(); // Refresh stock after purchase
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error en el registro. Por favor, inténtalo de nuevo.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleShirtChange = (size: string, value: string) => {
    const val = value === '' ? 0 : parseInt(value);
    
    // Validar stock si lo tenemos cargado
    if (stock && stock[size]) {
      const available = stock[size].available;
      if (val > available) {
        alert(`Lo sentimos, se ha alcanzado el límite de stock para la talla ${SIZE_LABELS[size]}. Quedan ${available} unidades.`);
        setFormData({
          ...formData,
          shirts: { ...formData.shirts, [size]: available }
        });
        return;
      }
    }

    setFormData({
      ...formData,
      shirts: { ...formData.shirts, [size]: val }
    });
  };

  return (
    <>
      <div className="registration-container animate">
        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 25 }}>
          <button onClick={() => window.history.back()} className="btn btn-secondary" style={{ padding: '8px' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Formulario de Inscripción</h1>
        </div>

        <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="grid">
            <div className="input-group">
              <label>Tipo de Participante</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="alumno">Alumno/a</option>
                <option value="profesor">Profesor/a</option>
                <option value="externo">Externo/a (Familiar, antiguo alumno...)</option>
              </select>
            </div>

            {formData.type === 'alumno' && (
              <div className="input-group">
                <label>Curso</label>
                <select 
                  value={formData.course}
                  onChange={e => setFormData({ ...formData, course: e.target.value })}
                >
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="input-group">
            <label>Nombre y Apellidos {formData.type === 'alumno' ? 'del Alumno/a' : ''}</label>
            <input 
              required 
              placeholder="Ej: Juan García Pérez"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          {formData.type !== 'alumno' && (
            <div className="grid">
              <div className="input-group">
                <label>Email de contacto</label>
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

          <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input 
              type="checkbox" 
              id="wants_dorsal" 
              style={{ width: 'auto' }}
              checked={!formData.wants_dorsal}
              onChange={e => {
                const isNoDorsal = e.target.checked;
                setFormData({ 
                  ...formData, 
                  wants_dorsal: !isNoDorsal,
                  wants_shirts: isNoDorsal ? true : formData.wants_shirts 
                });
              }}
            />
            <label htmlFor="wants_dorsal" style={{ marginBottom: 0, fontWeight: 700, color: '#ef4444' }}>Sin dorsal para correr</label>
          </div>

          <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <input 
              type="checkbox" 
              id="wants_shirts" 
              style={{ width: 'auto' }}
              checked={formData.wants_shirts}
              onChange={e => setFormData({ ...formData, wants_shirts: e.target.checked })}
              disabled={!formData.wants_dorsal}
            />
            <label htmlFor="wants_shirts" style={{ marginBottom: 0 }}>¿Queréis camisetas de la carrera?</label>
          </div>

          {formData.wants_shirts && (
            <div className="input-group animate">
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                Tallaje de Camisetas
              </label>
              <div className="grid" style={{ background: 'rgba(0,0,0,0.2)', padding: 15, borderRadius: 12 }}>
                {SHIRT_SIZES.map(size => {
                  const available = stock?.[size]?.available ?? 999;
                  const isOutOfStock = available <= 0;

                  return (
                    <div key={size} className={`shirt-input ${isOutOfStock ? 'disabled' : ''}`}>
                      <label style={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                        {SIZE_LABELS[size]}
                        {stock && (
                          <span style={{ display: 'block', fontSize: '0.55rem', color: isOutOfStock ? '#ef4444' : '#10b981' }}>
                            {isOutOfStock ? 'AGOTADA' : `Libres: ${available}`}
                          </span>
                        )}
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        max={available}
                        className="input-sm"
                        style={{ padding: '8px 5px', opacity: isOutOfStock ? 0.3 : 1 }}
                        value={(formData.shirts as any)[size]}
                        onChange={e => handleShirtChange(size, e.target.value)}
                        disabled={isOutOfStock}
                      />
                    </div>
                  );
                })}
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
      </div>

      <div 
        className="fab-admin" 
        onClick={() => window.location.href = `/${event.slug}/admin`}
        title="Acceso Administración"
      >
        <Shield size={28} />
      </div>
    </>
  );
}
