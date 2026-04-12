import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Ticket, Download, Trash2, LogOut, Euro, Wallet } from 'lucide-react';

interface Props {
  apiBase: string;
  onLogout: () => void;
}

export default function AdminDashboard({ apiBase, onLogout }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalParticipants: 0, totalShirts: 0, totalDue: 0, totalPaid: 0, totalAmpaDebt: 0 });
  const [filters, setFilters] = useState({ type: 'all', course: 'all' });
  const [userRole, setUserRole] = useState<'superadmin' | 'teacher' | null>(null);
  const [assignedCourse, setAssignedCourse] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'registrations' | 'economics'>('registrations');
  const [economicRecords, setEconomicRecords] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showAssignments, setShowAssignments] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ email: '', course: '' });
  const [newEconomicRecord, setNewEconomicRecord] = useState({ amount: '', date: new Date().toISOString().split('T')[0], observations: '', course: '' });

  const COURSES = [
    '3 años A', '3 años B', '4 años A', '4 años B', '5 años A', '5 años B',
    '1º EPO A', '1º EPO B', '2º EPO A', '2º EPO B', '3º EPO A', '3º EPO B', '4º EPO A', '4º EPO B', '5º EPO A', '5º EPO B', '6º EPO A', '6º EPO B',
    '1º ESO A', '1º ESO B', '2º ESO A', '2º ESO B', '3º ESO A', '3º ESO B', '4º ESO A', '4º ESO B'
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get user role and assignments
      const authRes = await axios.get(`${apiBase}/api/auth/status`);
      setUserRole(authRes.data.role);
      setAssignedCourse(authRes.data.assignedCourse);

      if (authRes.data.role === 'superadmin') {
        const assignRes = await axios.get(`${apiBase}/api/admin/assignments`);
        setAssignments(assignRes.data);
      }

      const res = await axios.get(`${apiBase}/api/admin/registrations`);
      setData(res.data);
      
      const econRes = await axios.get(`${apiBase}/api/admin/economic-records`);
      setEconomicRecords(econRes.data);

      const totalP = res.data.reduce((acc: number, curr: any) => acc + curr.total_participants, 0);
      const totalS = res.data.reduce((acc: number, curr: any) => {
        return acc + curr.shirt_4y + curr.shirt_8y + curr.shirt_12y + curr.shirt_16y + 
               curr.shirt_s + curr.shirt_m + curr.shirt_l + curr.shirt_xl + curr.shirt_xxl;
      }, 0);

      const ampaDebt = res.data.reduce((acc: number, curr: any) => acc + (curr.ampa_members * 3), 0);

      const computed = res.data.reduce((acc: any, curr: any) => {
        const amount = (curr.total_participants - curr.ampa_members) * 3 + 
                      (curr.shirt_4y + curr.shirt_8y + curr.shirt_12y + curr.shirt_16y + 
                       curr.shirt_s + curr.shirt_m + curr.shirt_l + curr.shirt_xl + curr.shirt_xxl) * 7;
        return {
          due: acc.due + amount,
          paid: acc.paid + (curr.is_paid ? amount : 0)
        };
      }, { due: 0, paid: 0 });

      setStats({ 
        totalParticipants: totalP, 
        totalShirts: totalS, 
        totalDue: computed.due, 
        totalPaid: computed.paid,
        totalAmpaDebt: ampaDebt
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerateDorsales = async () => {
    if (!confirm('¿Estás seguro de que quieres regenerar todos los dorsales? El orden se basará en el Tipo (Profesor > Curso > Externo) y orden alfabético.')) return;
    setLoading(true);
    try {
      await axios.post(`${apiBase}/api/admin/generate-dorsales`);
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
      await axios.post(`${apiBase}/api/admin/reset-dorsales`);
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
      await axios.delete(`${apiBase}/api/admin/registrations/${id}`);
      await fetchData();
    } catch (err) {
      alert('Error eliminando.');
    }
  };

  const handleLogout = async () => {
    await axios.get(`${apiBase}/api/auth/logout`);
    onLogout();
  };

  const handleTogglePaid = async (id: string) => {
    try {
      await axios.post(`${apiBase}/api/admin/registrations/${id}/toggle-paid`);
      await fetchData();
    } catch (err) {
      alert('Error al actualizar estado de pago.');
    }
  };

  const handleAddAssignment = async () => {
    if (!newAssignment.email || !newAssignment.course) return;
    try {
      await axios.post(`${apiBase}/api/admin/assignments`, newAssignment);
      setNewAssignment({ email: '', course: '' });
      await fetchData();
    } catch (err) {
      alert('Error al guardar asignación.');
    }
  };

  const handleDeleteAssignment = async (email: string) => {
    if (!confirm(`¿Eliminar asignación para ${email}?`)) return;
    try {
      await axios.delete(`${apiBase}/api/admin/assignments/${email}`);
      await fetchData();
    } catch (err) {
      alert('Error al eliminar asignación.');
    }
  };

  const handleAddEconomicRecord = async () => {
    if (!newEconomicRecord.amount || !newEconomicRecord.date) return;
    try {
      await axios.post(`${apiBase}/api/admin/economic-records`, newEconomicRecord);
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
      await axios.delete(`${apiBase}/api/admin/economic-records/${id}`);
      await fetchData();
    } catch (err) {
      alert('Error al eliminar registro.');
    }
  };

  const calculateAmount = (reg: any) => {
    const shirtsCount = reg.shirt_4y + reg.shirt_8y + reg.shirt_12y + reg.shirt_16y + 
                       reg.shirt_s + reg.shirt_m + reg.shirt_l + reg.shirt_xl + reg.shirt_xxl;
    return (reg.total_participants - reg.ampa_members) * 3 + shirtsCount * 7;
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
    <div className="container animate" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="admin-header">
        <div>
          <h1 style={{ textAlign: 'left', margin: 0, fontSize: '1.8rem' }}>Panel Control Carrera</h1>
          <p style={{ color: 'var(--text-dim)' }}>
            {userRole === 'superadmin' ? 'Super Admin - Acceso Total' : `Profesor - Clase: ${assignedCourse}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {userRole === 'superadmin' && (
            <>
              <button className="btn glass" onClick={() => setShowAssignments(true)} style={{ color: 'var(--accent)' }}>
                <Users size={18} /> Asignaciones
              </button>
              <button className="btn glass" onClick={handleResetDorsales} disabled={loading} style={{ color: '#f59e0b' }}>
                <Trash2 size={18} /> Borrar Dorsales
              </button>
              <button className="btn btn-primary" onClick={handleGenerateDorsales} disabled={loading}>
                <Ticket size={18} /> {loading ? 'Generando...' : 'Generar Dorsales'}
              </button>
            </>
          )}
          <button className="btn glass" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={18} /> Exportar CSV
          </button>
          <button className="btn glass" onClick={handleLogout} style={{ color: '#ef4444' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {showAssignments && (
        <div className="glass modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ width: '90%', maxWidth: '600px', padding: 30, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>Gestión de Profesores</h2>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input 
                type="email" 
                placeholder="Email del profesor" 
                className="input" 
                value={newAssignment.email}
                onChange={e => setNewAssignment({ ...newAssignment, email: e.target.value })}
              />
              <select 
                className="input" 
                value={newAssignment.course}
                onChange={e => setNewAssignment({ ...newAssignment, course: e.target.value })}
              >
                <option value="">Seleccionar curso</option>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Profesores">Profesores</option>
                <option value="Externos">Externos</option>
              </select>
              <button className="btn btn-primary" onClick={handleAddAssignment}>Asignar</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Curso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.email}>
                    <td>{a.email}</td>
                    <td>{a.assigned_course}</td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteAssignment(a.email)} style={{ color: '#ef4444' }}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn glass" onClick={() => setShowAssignments(false)} style={{ marginTop: 20, width: '100%' }}>Cerrar</button>
          </div>
        </div>
      )}

      {userRole === 'superadmin' && (
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
        <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Euro size={24} color="var(--accent)" style={{ marginBottom: 10 }} />
          <div style={{ color: 'var(--accent)', fontSize: '2rem', fontWeight: 700 }}>{stats.totalDue}€</div>
          <label style={{ fontSize: '0.9rem', opacity: 0.8 }}>Importe Total</label>
        </div>
        <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={24} color="#f59e0b" style={{ marginBottom: 10 }} />
          <div style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: 700 }}>{stats.totalAmpaDebt}€</div>
          <label style={{ fontSize: '0.9rem', opacity: 0.8 }}>Deuda AMPA</label>
        </div>
        <div className="glass" style={{ padding: 25, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={24} color="#10b981" style={{ marginBottom: 10 }} />
          <div style={{ color: '#10b981', fontSize: '2rem', fontWeight: 700 }}>{stats.totalPaid}€</div>
          <label style={{ fontSize: '0.9rem', opacity: 0.8 }}>Recaudado</label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 25 }}>
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
          Gestión Económica (Entregas)
        </button>
      </div>

      {activeTab === 'economics' ? (
        <div className="glass animate" style={{ padding: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
            <div>
              <h2 style={{ margin: 0 }}>Entregas a Dirección</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Registra el dinero que entregas al centro</p>
            </div>
            {userRole === 'teacher' && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
                  {stats.totalPaid - economicRecords.reduce((acc, curr) => acc + parseFloat(curr.amount), 0)}€
                </div>
                <label style={{ fontSize: '0.7rem' }}>Pendiente de entregar</label>
              </div>
            )}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', background: 'rgba(0,0,0,0.03)', padding: 20, borderRadius: 16, marginBottom: 30 }}>
            {userRole === 'superadmin' && (
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Curso</label>
                <select 
                  value={newEconomicRecord.course} 
                  onChange={e => setNewEconomicRecord({ ...newEconomicRecord, course: e.target.value })}
                >
                  <option value="">Seleccionar curso</option>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="Profesores">Profesores</option>
                  <option value="Externos">Externos</option>
                </select>
              </div>
            )}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Importe (€)</label>
              <input 
                type="number" 
                placeholder="0.00"
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
              <label>Observaciones</label>
              <input 
                type="text"
                placeholder="Opcional..."
                value={newEconomicRecord.observations}
                onChange={e => setNewEconomicRecord({ ...newEconomicRecord, observations: e.target.value })}
              />
            </div>
            <button className="btn btn-primary" onClick={handleAddEconomicRecord} style={{ alignSelf: 'end', height: '45px' }}>
              Registrar
            </button>
          </div>

          <table>
            <thead>
              <tr>
                {userRole === 'superadmin' && <th>Curso</th>}
                <th>Fecha Entrega</th>
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
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{rec.amount}€</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{rec.observations || '-'}</td>
                  {userRole === 'superadmin' && (
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn" style={{ padding: 5, color: '#ef4444' }} onClick={() => handleDeleteEconomicRecord(rec.id)}>
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {economicRecords.length === 0 && (
                <tr>
                  <td colSpan={userRole === 'superadmin' ? 5 : 3} style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                    No hay registros de entregas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
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
                    <span className={`badge badge-${reg.type}`}>
                      {reg.type === 'alumno' ? reg.course : reg.type.toUpperCase()}
                    </span>
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
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: '200px' }}>
                     {getShirtsLabel(reg)}
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
                    {userRole === 'superadmin' && (
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
    </div>
  );
}
