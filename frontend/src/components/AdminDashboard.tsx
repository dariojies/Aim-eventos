import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Ticket, Download, Trash2, LogOut, Euro, Wallet, Palette, Save, ArrowLeft, Edit2, Check as CheckIcon, Shirt } from 'lucide-react';

interface Props {
  apiBase: string;
  event: any;
  onLogout: () => void;
}

export default function AdminDashboard({ apiBase, event, onLogout }: Props) {
  // Axios instance with event header
  const api = axios.create({
    baseURL: apiBase,
    headers: { 'x-event-id': event?.id }
  });

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ 
    totalParticipants: 0, 
    totalShirts: 0, 
    totalDue: 0, 
    totalPaid: 0, 
    totalAmpaDebt: 0,
    breakdown: { registrations: 0, shirts: 0, ampa: 0 }
  });
  const [filters, setFilters] = useState({ type: 'all', course: 'all' });
  const [userRole, setUserRole] = useState<'superadmin' | 'admin' | 'teacher' | null>(null);
  const [assignedCourse, setAssignedCourse] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'registrations' | 'economics' | 'shirts' | 'settings'>('registrations');
  const [eventConfig, setEventConfig] = useState(event.config || { colors: { primary_gradient: '', accent: '' }, assets: { banner_url: '', logo_url: '' } });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [economicRecords, setEconomicRecords] = useState<any[]>([]);
  const [showAssignments, setShowAssignments] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newStaff, setNewStaff] = useState({ email: '', role: 'teacher', course: '' });
  const [newEconomicRecord, setNewEconomicRecord] = useState({ amount: '', date: new Date().toISOString().split('T')[0], observations: '', course: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempCourse, setTempCourse] = useState<string>('');
  const [tempType, setTempType] = useState<string>('');
  const [editingShirtsId, setEditingShirtsId] = useState<string | null>(null);
  const [tempShirts, setTempShirts] = useState<any>({});

  const COURSES = [
    '3 años A', '3 años B', '4 años A', '4 años B', '5 años A', '5 años B',
    '1º EPO A', '1º EPO B', '2º EPO A', '2º EPO B', '3º EPO A', '3º EPO B', '4º EPO A', '4º EPO B', '5º EPO A', '5º EPO B', '6º EPO A', '6º EPO B',
    '1º ESO A', '1º ESO B', '2º ESO A', '2º ESO B', '3º ESO A', '3º ESO B', '4º ESO A', '4º ESO B'
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get user role and assignments (Critical)
      const authRes = await axios.get(`${apiBase}/api/auth/status`, { params: { eventId: event.id } });
      setUserRole(authRes.data.role);
      setAssignedCourse(authRes.data.assignedCourse);
      const role = authRes.data.role;

      // 2. Fetch staff only for admins/superadmins
      if (role === 'superadmin' || role === 'admin') {
        try {
          const res = await api.get('/api/admin/staff');
          setStaffList(res.data);
        } catch (e) { console.error("Error fetching staff:", e); }
      }

      // 3. Fetch Main Data (Registrations)
      let registrations: any[] = [];
      try {
        const res = await api.get('/api/admin/registrations');
        registrations = res.data;
        setData(res.data);
      } catch (e) { console.error("Error fetching registrations:", e); }

      // 4. Fetch Economic Records
      let econRecords: any[] = [];
      try {
        const econRes = await api.get('/api/admin/economic-records');
        econRecords = econRes.data;
        setEconomicRecords(econRes.data);
      } catch (e) { console.error("Error fetching economic records:", e); }

      // 5. Compute Stats
      if (registrations.length > 0 || econRecords.length > 0) {
        const totalP = registrations.reduce((acc: number, curr: any) => acc + curr.total_participants, 0);
        const totalS = registrations.reduce((acc: number, curr: any) => {
          return acc + curr.shirt_4y + curr.shirt_8y + curr.shirt_12y + curr.shirt_16y + 
                 curr.shirt_s + curr.shirt_m + curr.shirt_l + curr.shirt_xl + curr.shirt_xxl;
        }, 0);

        const ampaDebt = registrations.reduce((acc: number, curr: any) => acc + (curr.ampa_members * 3), 0);

        const computed = registrations.reduce((acc: any, curr: any) => {
          const shirtsCount = (curr.shirt_4y || 0) + (curr.shirt_8y || 0) + (curr.shirt_12y || 0) + (curr.shirt_16y || 0) + 
                             (curr.shirt_s || 0) + (curr.shirt_m || 0) + (curr.shirt_l || 0) + (curr.shirt_xl || 0) + (curr.shirt_xxl || 0);
          
          const wantsBib = curr.wants_dorsal !== false; // Treat null as true
          const regAmount = wantsBib ? (curr.total_participants - curr.ampa_members) * 3 : 0;
          const shirtAmount = shirtsCount * 7;
          const total = regAmount + shirtAmount;

          return {
            registrations: acc.registrations + regAmount,
            shirts: acc.shirts + shirtAmount,
            ampa: acc.ampa + (wantsBib ? curr.ampa_members * 3 : 0),
            due: acc.due + total,
            paid: acc.paid + (curr.is_paid ? total : 0)
          };
        }, { registrations: 0, shirts: 0, ampa: 0, due: 0, paid: 0 });

        setStats({ 
          totalParticipants: totalP, 
          totalShirts: totalS, 
          totalDue: computed.due, 
          totalPaid: computed.paid,
          totalAmpaDebt: ampaDebt,
          breakdown: {
            registrations: computed.registrations,
            shirts: computed.shirts,
            ampa: computed.ampa
          }
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCourse = async (id: string) => {
    try {
      await api.put(`/api/admin/registrations/${id}`, { 
        type: tempType,
        course: tempType === 'alumno' ? tempCourse : '' 
      });
      setEditingId(null);
      await fetchData();
    } catch (err) {
      alert('Error al actualizar el registro');
    }
  };

  const handleUpdateShirts = async (id: string) => {
    try {
      await api.put(`/api/admin/registrations/${id}`, { shirts: tempShirts });
      setEditingShirtsId(null);
      await fetchData();
    } catch (err) {
      alert('Error al actualizar las camisetas');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerateDorsales = async () => {
    if (!confirm('¿Estás seguro de que quieres regenerar todos los dorsales? El orden se basará en el Tipo (Profesor > Curso > Externo) y orden alfabético.')) return;
    setLoading(true);
    try {
      await api.post('/api/admin/generate-dorsales');
      await fetchData();
      alert('Dorsales generados correctamente.');
    } catch (err) {
      alert('Error generando dorsales.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDorsales = async () => {
    if (!confirm('¿Estás seguro de que quieres borrar TODOS los dorsales asignados? Esta acción es irreversible.')) return;
    setLoading(true);
    try {
      await api.post('/api/admin/reset-dorsales');
      await fetchData();
      alert('Dorsales borrados correctamente.');
    } catch (err) {
      alert('Error al borrar dorsales.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta inscripción?')) return;
    try {
      await api.delete(`/api/admin/registrations/${id}`);
      await fetchData();
    } catch (err) {
      alert('Error eliminando.');
    }
  };


  const handleTogglePaid = async (id: string) => {
    try {
      await api.post(`/api/admin/registrations/${id}/toggle-paid`);
      await fetchData();
    } catch (err) {
      alert('Error al actualizar estado de pago.');
    }
  };


  const handleAddEconomicRecord = async () => {
    if (!newEconomicRecord.amount || !newEconomicRecord.date) return;
    try {
      await api.post('/api/admin/economic-records', newEconomicRecord);
      setNewEconomicRecord({ amount: '', date: new Date().toISOString().split('T')[0], observations: '', course: '' });
      await fetchData();
      alert('Entrega registrada correctamente.');
    } catch (err) {
      alert('Error al registrar entrega.');
    }
  };

  const handleDeleteEconomicRecord = async (id: string) => {
    if (!confirm('¿Eliminar este registro de entrega?')) return;
    try {
      await api.delete(`/api/admin/economic-records/${id}`);
      await fetchData();
    } catch (err) {
      alert('Error al eliminar registro.');
    }
  };

  const handleDeleteStaff = async (email: string) => {
    if (!window.confirm(`¿Quitar permisos de administrador a ${email}?`)) return;
    try {
      await api.delete(`/api/admin/staff/${email}`);
      fetchData();
    } catch (err) { alert('Error al borrar'); }
  };

  const handleAddStaff = async () => {
    if (!newStaff.email) return;
    try {
      await api.post('/api/admin/staff', newStaff);
      setNewStaff({ email: '', role: 'teacher', course: '' });
      fetchData();
    } catch (err: any) { 
      alert(err.response?.data?.error || 'Error al añadir'); 
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await api.put('/api/admin/event-config', { config: eventConfig });
      alert('Configuración guardada correctamente. Recarga para ver todos los cambios.');
      // Apply primary gradient immediately to the page for preview
      document.documentElement.style.setProperty('--primary-gradient', eventConfig.colors.primary_gradient);
      document.documentElement.style.setProperty('--accent', eventConfig.colors.accent);
    } catch (err) {
      alert('Error al guardar la configuración.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const calculateAmount = (reg: any) => {
    const shirtsCount = (reg.shirt_4y || 0) + (reg.shirt_8y || 0) + (reg.shirt_12y || 0) + (reg.shirt_16y || 0) + 
                       (reg.shirt_s || 0) + (reg.shirt_m || 0) + (reg.shirt_l || 0) + (reg.shirt_xl || 0) + (reg.shirt_xxl || 0);
    
    // 3€ per bib, unless it's an ampa member (free bib) or they don't want a bib (no bib)
    const wantsBib = reg.wants_dorsal !== false; // Default to true if null
    const bibCost = wantsBib ? (reg.total_participants - reg.ampa_members) * 3 : 0;
    return bibCost + shirtsCount * 7;
  };

  const exportCSV = () => {
    const headers = ["Tipo", "Curso", "Nombre", "Dorsales", "Socios AMPA", "Participantes Totales", "Importe", "Pagado", "Email (Externos)", "Teléfono (Externos)", "4y", "8y", "12y", "16y", "S", "M", "L", "XL", "XXL", "Observaciones"];
    const rows = data.map(r => [
      r.type,
      r.course || '-',
      `"${r.full_name.replace(/"/g, '""')}"`,
      r.dorsal_start ? `${r.dorsal_start}${r.dorsal_end > r.dorsal_start ? '-' + r.dorsal_end : ''}` : '-',
      r.ampa_members,
      r.total_participants,
      calculateAmount(r),
      r.is_paid ? 'SÍ' : 'NO',
      r.external_email || '-',
      r.external_phone || '-',
      r.shirt_4y, r.shirt_8y, r.shirt_12y, r.shirt_16y, r.shirt_s, r.shirt_m, r.shirt_l, r.shirt_xl, r.shirt_xxl,
      `"${(r.observations || "").replace(/"/g, '""')}"`
    ]);
    
    const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `marcha_solidaria_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = data.filter(reg => {
    if (filters.type !== 'all' && reg.type !== filters.type) return false;
    if (filters.course !== 'all' && reg.course !== filters.course) return false;
    return true;
  });

  const getShirtsLabel = (reg: any) => {
    if (!reg.wants_shirts) return 'No';
    const sizes = [
      { k: '4y', v: reg.shirt_4y }, { k: '8y', v: reg.shirt_8y }, 
      { k: '12y', v: reg.shirt_12y }, { k: '16y', v: reg.shirt_16y },
      { k: 'S', v: reg.shirt_s }, { k: 'M', v: reg.shirt_m }, 
      { k: 'L', v: reg.shirt_l }, { k: 'XL', v: reg.shirt_xl }, 
      { k: 'XXL', v: reg.shirt_xxl }
    ];
    const items = sizes.filter(s => s.v > 0).map(s => `${s.k}: ${s.v}`);
    return items.length > 0 ? items.join(', ') : '0 ud.';
  };

  return (
    <div className="container animate" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <header className="admin-header glass" style={{ padding: '20px 30px', marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button className="btn glass" onClick={() => window.location.href = '/'} title="Volver al Portal">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Gestión: {event.name}</h1>
            <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>
              {userRole === 'superadmin' ? 'Super Admin - Desarrollador' : 
               userRole === 'admin' ? `Staff de Gestión - ${event.org_name}` : 
               `Profesor - Clase: ${assignedCourse}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
          {userRole === 'superadmin' && (
            <button className="btn glass" onClick={() => setShowAssignments(true)} style={{ color: 'var(--primary)' }} title="Gestionar Staff">
              <Users size={18} />
            </button>
          )}
          <button className="btn glass" onClick={exportCSV} title="Exportar Datos">
            <Download size={18} />
          </button>
          <button className="btn glass" onClick={() => window.open(`/${event.slug}`, '_blank')}>
            Ver Inscripción
          </button>
          <button className="btn glass" style={{ color: '#ef4444' }} onClick={onLogout}>
            <LogOut size={18} /> Salir
          </button>
        </div>
      </header>
      {showAssignments && (
        <div className="glass modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ width: '90%', maxWidth: '700px', padding: 30, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>Gestión de Staff del Evento</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: 10, marginBottom: 20 }}>
              <input 
                type="email" 
                placeholder="Email" 
                className="input" 
                value={newStaff.email}
                onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
              />
              <select 
                className="input" 
                value={newStaff.role}
                onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
              >
                <option value="teacher">Profesor/Tutor</option>
                <option value="admin">Administrador/Secretaría</option>
              </select>
              {newStaff.role === 'teacher' && (
                <select 
                  className="input" 
                  value={newStaff.course}
                  onChange={e => setNewStaff({ ...newStaff, course: e.target.value })}
                >
                  <option value="">Seleccionar curso</option>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="Profesores">Profesores</option>
                  <option value="Externos">Externos</option>
                </select>
              )}
              <button className="btn btn-primary" onClick={handleAddStaff}>Añadir</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Curso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(s => (
                  <tr key={s.email}>
                    <td>{s.email}</td>
                    <td style={{ fontWeight: 600 }}>{s.role === 'teacher' ? 'PROFESOR/A' : s.role === 'admin' ? 'ADMINISTRADOR/A' : s.role.toUpperCase()}</td>
                    <td>{s.assigned_course || '-'}</td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteStaff(s.email)} style={{ color: '#ef4444' }}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn glass" onClick={() => setShowAssignments(false)} style={{ marginTop: 20, width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

      {(userRole === 'superadmin' || userRole === 'admin') && (
        <div style={{ display: 'flex', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="input-group" style={{ marginBottom: 0, width: '200px' }}>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 5, display: 'block' }}>Filtrar por Tipo</label>
            <select 
              value={filters.type} 
              onChange={e => setFilters({ ...filters, type: e.target.value })}
              style={{ padding: '8px 12px', width: '100%' }}
            >
              <option value="all">Todos los tipos</option>
              <option value="alumno">Alumnos</option>
              <option value="profesor">Profesores</option>
              <option value="externo">Externos</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0, width: '200px' }}>
            <label style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 5, display: 'block' }}>Filtrar por Curso</label>
            <select 
              value={filters.course} 
              onChange={e => setFilters({ ...filters, course: e.target.value })}
              style={{ padding: '8px 12px', width: '100%' }}
            >
              <option value="all">Todos los cursos</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 30, gap: 20 }}>
        <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={24} color="var(--primary)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalParticipants}</div>
          <label style={{ fontSize: '0.9rem', opacity: 0.8 }}>Participantes</label>
        </div>
        <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '4px solid var(--accent)' }}>
          <Euro size={24} color="var(--accent)" style={{ marginBottom: 10 }} />
          <div style={{ color: 'var(--accent)', fontSize: '2rem', fontWeight: 800 }}>{stats.totalDue}€</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 5 }}>
            {stats.breakdown.registrations}€ Insc. + {stats.breakdown.shirts}€ Camis.
          </div>
          <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Total a Recaudar</label>
        </div>

        {userRole === 'superadmin' || userRole === 'admin' ? (
          <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '4px solid #f59e0b' }}>
            <Users size={24} color="#f59e0b" style={{ marginBottom: 10 }} />
            <div style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: 800 }}>{stats.totalAmpaDebt}€</div>
            <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Importe AMPA</label>
          </div>
        ) : (
          <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '4px solid #ef4444' }}>
            <Wallet size={24} color="#ef4444" style={{ marginBottom: 10 }} />
            <div style={{ color: '#ef4444', fontSize: '2rem', fontWeight: 800 }}>{(stats.totalDue - stats.totalPaid).toFixed(2)}€</div>
            <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Falta por Recaudar</label>
          </div>
        )}

        <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '4px solid #10b981' }}>
          <Wallet size={24} color="#10b981" style={{ marginBottom: 10 }} />
          <div style={{ color: '#10b981', fontSize: '2rem', fontWeight: 800 }}>{stats.totalPaid}€</div>
          <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Ya Recaudado</label>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: 20, marginBottom: 30, width: '100%' }}>
        <button 
          className={`btn ${activeTab === 'registrations' ? 'btn-primary' : 'glass'}`} 
          onClick={() => setActiveTab('registrations')}
          style={{ flex: 1 }}
        >
          Inscripciones
        </button>
        <button 
          className={`btn ${activeTab === 'economics' ? 'btn-primary' : 'glass'}`} 
          onClick={() => setActiveTab('economics')}
          style={{ flex: 1 }}
        >
          Gestión Económica
        </button>
        <button 
          className={`btn ${activeTab === 'shirts' ? 'btn-primary' : 'glass'}`} 
          onClick={() => setActiveTab('shirts')}
          style={{ flex: 1 }}
        >
          Resumen Camisetas
        </button>
        {(userRole === 'superadmin' || userRole === 'admin') && (
          <button 
            className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'glass'}`} 
            onClick={() => setActiveTab('settings')}
            style={{ flex: 1 }}
          >
            Configuración / Branding
          </button>
        )}
      </div>

      {activeTab === 'shirts' && (
        <div className="animate">
          <div className="glass" style={{ padding: 40 }}>
            <h2 style={{ marginBottom: 30, textAlign: 'center' }}>Totales por Tallas</h2>
            
            {/* Primera fila: 5 tallas */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 20, marginBottom: 20 }}>
              {[
                { label: '4 Años', key: 'shirt_4y' }, { label: '8 Años', key: 'shirt_8y' },
                { label: '12 Años', key: 'shirt_12y' }, { label: '16 Años', key: 'shirt_16y' },
                { label: 'Talla S', key: 'shirt_s' }
              ].map(size => {
                const total = data.reduce((acc, curr) => acc + (parseInt(curr[size.key]) || 0), 0);
                return (
                  <div key={size.key} className="glass" style={{ padding: 25, textAlign: 'center', border: '2px solid var(--primary)', background: total > 0 ? 'rgba(99, 102, 241, 0.05)' : 'white' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase' }}>{size.label}</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary)' }}>{total}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Unidades</div>
                  </div>
                );
              })}
            </div>

            {/* Segunda fila: 4 tallas */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, maxWidth: '80%', margin: '0 auto' }}>
              {[
                { label: 'Talla M', key: 'shirt_m' }, { label: 'Talla L', key: 'shirt_l' },
                { label: 'Talla XL', key: 'shirt_xl' }, { label: 'Talla XXL', key: 'shirt_xxl' }
              ].map(size => {
                const total = data.reduce((acc, curr) => acc + (parseInt(curr[size.key]) || 0), 0);
                return (
                  <div key={size.key} className="glass" style={{ padding: 25, textAlign: 'center', border: '2px solid var(--primary)', background: total > 0 ? 'rgba(99, 102, 241, 0.05)' : 'white' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase' }}>{size.label}</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary)' }}>{total}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Unidades</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'economics' && (
        <div className="animate">
          {/* Resumen Económico Destacado */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 30, gap: 20 }}>
            <div className="glass" style={{ padding: 25, textAlign: 'center', borderBottom: '4px solid var(--primary)' }}>
              <Euro size={24} color="var(--primary)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.totalPaid}€</div>
              <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cobrado a Familias</label>
            </div>
            <div className="glass" style={{ padding: 25, textAlign: 'center', borderBottom: '4px solid var(--accent)' }}>
              <Download size={24} color="var(--accent)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)' }}>
                {economicRecords.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)}€
              </div>
              <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entregado a Dirección</label>
            </div>
            <div className="glass" style={{ padding: 25, textAlign: 'center', borderBottom: '4px solid var(--warning)' }}>
              <Wallet size={24} color="var(--warning)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--warning)' }}>
                {(stats.totalPaid - economicRecords.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)).toFixed(2)}€
              </div>
              <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dinero en Mano (Falta)</label>
            </div>
          </div>

          <div className="glass" style={{ padding: 35, marginBottom: 30 }}>
            <h3 style={{ marginBottom: 25, textAlign: 'center', fontWeight: 700 }}>Registrar Nueva Entrega a Dirección</h3>
            <div className="grid" style={{ gridTemplateColumns: (userRole === 'superadmin' || userRole === 'admin') ? '1.2fr 1fr 1fr 2fr 150px' : '1fr 1fr 2fr 150px', gap: 15 }}>
              {(userRole === 'superadmin' || userRole === 'admin') && (
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Curso</label>
                  <select 
                    value={newEconomicRecord.course} 
                    onChange={e => setNewEconomicRecord({ ...newEconomicRecord, course: e.target.value })}
                  >
                    <option value="">Curso...</option>
                    {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Profesores">Profesores</option>
                    <option value="Externos">Externos</option>
                    <option value="AMPA">Pago AMPA (Global)</option>
                  </select>
                </div>
              )}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Cantidad (€)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 80"
                  value={newEconomicRecord.amount}
                  onChange={e => setNewEconomicRecord({ ...newEconomicRecord, amount: e.target.value })}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Fecha</label>
                <input 
                  type="date"
                  value={newEconomicRecord.date}
                  onChange={e => setNewEconomicRecord({ ...newEconomicRecord, date: e.target.value })}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Observación (Opcional)</label>
                <input 
                  type="text"
                  placeholder="Ej: Entregado en mano..."
                  value={newEconomicRecord.observations}
                  onChange={e => setNewEconomicRecord({ ...newEconomicRecord, observations: e.target.value })}
                />
              </div>
              <button className="btn btn-primary" onClick={handleAddEconomicRecord} style={{ alignSelf: 'end', height: '54px', width: '100%' }}>
                Enviar
              </button>
            </div>
          </div>

          <div className="glass" style={{ padding: 30 }}>
            <h3 style={{ marginBottom: 20, fontWeight: 700 }}>Historial de Entregas</h3>
            <table>
              <thead>
                <tr>
                  {userRole === 'superadmin' && <th>Curso</th>}
                  <th>Fecha</th>
                  <th>Importe</th>
                  <th>Observaciones</th>
                  {userRole === 'superadmin' && <th style={{ textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {economicRecords.map(rec => (
                  <tr key={rec.id}>
                    {userRole === 'superadmin' && <td>{rec.course}</td>}
                    <td>{new Date(rec.payment_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 800, color: 'var(--accent)' }}>{rec.amount}€</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>{rec.observations || '-'}</td>
                    {(userRole === 'superadmin' || userRole === 'admin') && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn" style={{ padding: 5, color: '#ef4444', background: 'transparent' }} onClick={() => handleDeleteEconomicRecord(rec.id)}>
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {economicRecords.length === 0 && (
                  <tr>
                    <td colSpan={userRole === 'superadmin' ? 5 : 3} style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                      No hay registros de entregas todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'registrations' && (
        <div className="glass" style={{ padding: 20, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Tipo/Curso</th>
                <th>Apellidos y Nombre</th>
                <th>Dorsales</th>
                <th>Camisetas</th>
                <th>Importe</th>
                <th>Pagado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(reg => (
                <tr key={reg.id}>
                  <td>
                    {editingId === reg.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <select 
                          value={tempType} 
                          onChange={e => setTempType(e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 8, fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)' }}
                        >
                          <option value="alumno">Alumno/a</option>
                          <option value="profesor">Profesor/a</option>
                          <option value="externo">Externo/a</option>
                        </select>
                        
                        {tempType === 'alumno' && (
                          <select 
                            value={tempCourse} 
                            onChange={e => setTempCourse(e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: 8, fontSize: '0.8rem' }}
                          >
                            <option value="">-- Seleccionar Curso --</option>
                            {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}

                        <button 
                          className="btn" 
                          style={{ 
                            padding: 4, 
                            color: 'var(--primary)', 
                            background: 'rgba(255,255,255,0.1)',
                            opacity: (tempType === 'alumno' && !tempCourse) ? 0.3 : 1
                          }} 
                          onClick={() => handleUpdateCourse(reg.id)}
                          disabled={tempType === 'alumno' && !tempCourse}
                        >
                          <CheckIcon size={16} /> Guardar Cambios
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge badge-${reg.type}`}>
                          {reg.type === 'alumno' ? reg.course : reg.type.toUpperCase()}
                        </span>
                        {!reg.wants_dorsal && (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' }}>
                             Solo Camisetas
                          </span>
                        )}
                        {(userRole === 'superadmin' || userRole === 'admin') && (
                          <button 
                            className="btn" 
                            style={{ padding: 4, opacity: 0.5, background: 'transparent' }} 
                            onClick={() => {
                              setEditingId(reg.id);
                              setTempCourse(reg.course || '');
                              setTempType(reg.type);
                            }}
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{reg.full_name}</td>
                  <td>
                    {reg.dorsal_start ? (
                      <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                        {String(reg.dorsal_start).padStart(4, '0')}
                        {reg.dorsal_end > reg.dorsal_start ? ` - ${String(reg.dorsal_end).padStart(4, '0')}` : ''}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: '300px' }}>
                    {editingShirtsId === reg.id ? (
                      <div className="glass" style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                        {['4y', '8y', '12y', '16y', 's', 'm', 'l', 'xl', 'xxl'].map(sz => (
                          <div key={sz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.6rem', textTransform: 'uppercase' }}>{sz}</label>
                            <input 
                              type="number" 
                              value={tempShirts[sz] || 0}
                              onChange={e => setTempShirts({ ...tempShirts, [sz]: parseInt(e.target.value) || 0 })}
                              style={{ width: '40px', padding: '2px', fontSize: '0.8rem', textAlign: 'center' }}
                            />
                          </div>
                        ))}
                        <button className="btn" style={{ gridColumn: 'span 3', marginTop: 5, padding: 4, color: 'var(--primary)', background: 'rgba(255,255,255,0.1)' }} onClick={() => handleUpdateShirts(reg.id)}>
                          <CheckIcon size={14} /> Guardar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>{getShirtsLabel(reg)}</div>
                        {(userRole === 'superadmin' || userRole === 'admin') && (
                          <button 
                            className="btn" 
                            style={{ padding: 4, opacity: 0.5, background: 'transparent' }} 
                            onClick={() => {
                              setEditingShirtsId(reg.id);
                              setTempShirts({
                                '4y': reg.shirt_4y || 0, '8y': reg.shirt_8y || 0, '12y': reg.shirt_12y || 0, '16y': reg.shirt_16y || 0,
                                's': reg.shirt_s || 0, 'm': reg.shirt_m || 0, 'l': reg.shirt_l || 0, 'xl': reg.shirt_xl || 0, 'xxl': reg.shirt_xxl || 0
                              });
                            }}
                          >
                            <Shirt size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    {calculateAmount(reg)}€
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={reg.is_paid} 
                      onChange={() => handleTogglePaid(reg.id)}
                      style={{ width: 22, height: 22, cursor: 'pointer', accentColor: 'var(--primary)' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(userRole === 'superadmin' || userRole === 'admin') && (
                      <button className="btn" style={{ padding: 5, color: '#ef4444', background: 'transparent' }} onClick={() => handleDelete(reg.id)}>
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="animate">
          <div className="glass" style={{ padding: 40, maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 30 }}>
              <Palette size={32} color="var(--primary)" />
              <h2 style={{ margin: 0 }}>Administración y Estilo</h2>
            </div>

            <section style={{ marginBottom: 40, paddingBottom: 30, borderBottom: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Acciones Rápidas</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="glass" style={{ padding: 20, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <h4 style={{ color: '#f59e0b', margin: '0 0 10px 0', fontSize: '1rem' }}>Sorteo de Dorsales</h4>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 15 }}>Asigna números correlativos a todos los participantes.</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={handleGenerateDorsales} disabled={loading} style={{ flex: 1, padding: '8px' }}>
                      <Ticket size={16} /> Generar
                    </button>
                    <button className="btn glass" onClick={handleResetDorsales} disabled={loading} style={{ color: '#ef4444', flex: 1, padding: '8px' }}>
                      <Trash2 size={16} /> Reset
                    </button>
                  </div>
                </div>
                <div className="glass" style={{ padding: 20 }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>Descarga de Datos</h4>
                  <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: 15 }}>Exporta la base de datos actual a formato CSV.</p>
                  <button className="btn glass" onClick={exportCSV} style={{ width: '100%', padding: '8px' }}>
                    <Download size={16} /> Exportar CSV
                  </button>
                </div>
              </div>
            </section>

            <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Personalización Visual</h3>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 30 }}>
              <section>
                <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, marginBottom: 15 }}>Colores y Estilo</h3>
                
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                  <div className="input-group">
                    <label>Color Gradiente (Inicio)</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input 
                        type="color" 
                        value={eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[0] || '#6366f1'}
                        onChange={e => {
                          const start = e.target.value;
                          const currentEnd = eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[1] || start;
                          setEventConfig({ ...eventConfig, colors: { ...eventConfig.colors, primary_gradient: `linear-gradient(135deg, ${start} 0%, ${currentEnd} 100%)` } });
                        }}
                        style={{ width: 40, padding: 0, cursor: 'pointer', border: 'none', borderRadius: 4 }}
                      />
                      <input 
                        type="text" 
                        value={eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[0] || '#6366f1'}
                        onChange={e => {
                          const start = e.target.value;
                          const currentEnd = eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[1] || start;
                          setEventConfig({ ...eventConfig, colors: { ...eventConfig.colors, primary_gradient: `linear-gradient(135deg, ${start} 0%, ${currentEnd} 100%)` } });
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Color Gradiente (Fin)</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input 
                        type="color" 
                        value={eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[1] || '#a855f7'}
                        onChange={e => {
                          const end = e.target.value;
                          const currentStart = eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[0] || end;
                          setEventConfig({ ...eventConfig, colors: { ...eventConfig.colors, primary_gradient: `linear-gradient(135deg, ${currentStart} 0%, ${end} 100%)` } });
                        }}
                        style={{ width: 40, padding: 0, cursor: 'pointer', border: 'none', borderRadius: 4 }}
                      />
                      <input 
                        type="text" 
                        value={eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[1] || '#a855f7'}
                        onChange={e => {
                          const end = e.target.value;
                          const currentStart = eventConfig.colors?.primary_gradient?.match(/#(?:[0-9a-fA-F]{3}){1,2}/g)?.[0] || end;
                          setEventConfig({ ...eventConfig, colors: { ...eventConfig.colors, primary_gradient: `linear-gradient(135deg, ${currentStart} 0%, ${end} 100%)` } });
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <label>Color de Acento</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input 
                      type="color" 
                      style={{ width: 50, padding: 2, height: 45 }}
                      value={eventConfig.colors?.accent || '#6366f1'}
                      onChange={e => setEventConfig({ ...eventConfig, colors: { ...eventConfig.colors, accent: e.target.value } })}
                    />
                    <input 
                      type="text" 
                      value={eventConfig.colors?.accent || ''}
                      onChange={e => setEventConfig({ ...eventConfig, colors: { ...eventConfig.colors, accent: e.target.value } })}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, marginBottom: 15 }}>Imágenes y Assets</h3>
                
                <div className="input-group">
                  <label>URL del Cartel / Poster</label>
                  <input 
                    type="text" 
                    placeholder="https://..."
                    value={eventConfig.assets?.banner_url || ''}
                    onChange={e => setEventConfig({ ...eventConfig, assets: { ...eventConfig.assets, banner_url: e.target.value } })}
                  />
                </div>

                <div className="input-group">
                  <label>URL del Logo</label>
                  <input 
                    type="text" 
                    placeholder="https://..."
                    value={eventConfig.assets?.logo_url || ''}
                    onChange={e => setEventConfig({ ...eventConfig, assets: { ...eventConfig.assets, logo_url: e.target.value } })}
                  />
                </div>
              </section>
            </div>

            <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }}>
              <button 
                className="btn btn-primary" 
                style={{ minWidth: '200px' }} 
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
              >
                {isSavingConfig ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
