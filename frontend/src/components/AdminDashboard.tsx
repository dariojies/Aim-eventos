import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Ticket, Download, Trash2, LogOut, RefreshCw } from 'lucide-react';

interface Props {
  apiBase: string;
  onLogout: () => void;
}

export default function AdminDashboard({ apiBase, onLogout }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalParticipants: 0, totalShirts: 0 });
  const [filters, setFilters] = useState({ type: 'all', course: 'all' });

  const COURSES = [
    '3 años A', '3 años B', '4 años A', '4 años B', '5 años A', '5 años B',
    '1º EPO A', '1º EPO B', '2º EPO A', '2º EPO B', '3º EPO A', '3º EPO B', '4º EPO A', '4º EPO B', '5º EPO A', '5º EPO B', '6º EPO A', '6º EPO B',
    '1º ESO A', '1º ESO B', '2º ESO A', '2º ESO B', '3º ESO A', '3º ESO B', '4º ESO A', '4º ESO B'
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/registrations`);
      setData(res.data);
      
      const totalP = res.data.reduce((acc: number, curr: any) => acc + curr.total_participants, 0);
      const totalS = res.data.reduce((acc: number, curr: any) => {
        return acc + curr.shirt_4y + curr.shirt_8y + curr.shirt_12y + curr.shirt_16y + 
               curr.shirt_s + curr.shirt_m + curr.shirt_l + curr.shirt_xl + curr.shirt_xxl;
      }, 0);
      setStats({ totalParticipants: totalP, totalShirts: totalS });
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

  const exportCSV = () => {
    const headers = ["Tipo", "Curso", "Nombre", "Dorsales", "Socios AMPA", "Participantes Totales", "4y", "8y", "12y", "16y", "S", "M", "L", "XL", "XXL", "Observaciones"];
    const rows = data.map(r => [
      r.type,
      r.course || '-',
      `"${r.full_name.replace(/"/g, '""')}"`,
      r.dorsal_start ? `${r.dorsal_start}${r.dorsal_end > r.dorsal_start ? '-' + r.dorsal_end : ''}` : '-',
      r.ampa_members,
      r.total_participants,
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
    if (filters.type === 'alumno' && filters.course !== 'all' && reg.course !== filters.course) return false;
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
          <p style={{ color: 'var(--text-dim)' }}>Gestión de inscripciones y dorsales</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn glass" onClick={handleResetDorsales} disabled={loading} style={{ color: '#f59e0b' }}>
            <Trash2 size={18} /> Borrar Dorsales
          </button>
          <button className="btn btn-primary" onClick={handleGenerateDorsales} disabled={loading}>
            <Ticket size={18} /> {loading ? 'Generando...' : 'Generar Dorsales'}
          </button>
          <button className="btn glass" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={18} /> Exportar CSV
          </button>
          <button className="btn glass" onClick={handleLogout} style={{ color: '#ef4444' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="input-group" style={{ marginBottom: 0, width: '200px' }}>
          <select 
            value={filters.type} 
            onChange={e => setFilters({ ...filters, type: e.target.value, course: 'all' })}
            style={{ padding: '8px 12px' }}
          >
            <option value="all">Todos los tipos</option>
            <option value="alumno">Alumnos</option>
            <option value="profesor">Profesores</option>
            <option value="externo">Externos</option>
          </select>
        </div>
        {filters.type === 'alumno' && (
          <div className="input-group" style={{ marginBottom: 0, width: '200px' }}>
            <select 
              value={filters.course} 
              onChange={e => setFilters({ ...filters, course: e.target.value })}
              style={{ padding: '8px 12px' }}
            >
              <option value="all">Todos los cursos</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 30, gap: 20 }}>
        <div className="glass" style={{ padding: 25, textAlign: 'center' }}>
          <Users size={24} color="var(--primary)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalParticipants}</div>
          <label>Participantes Totales</label>
        </div>
        <div className="glass" style={{ padding: 25, textAlign: 'center' }}>
          <Download size={24} color="var(--secondary)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalShirts}</div>
          <label>Camisetas Reservadas</label>
        </div>
        <div className="glass" style={{ padding: 25, textAlign: 'center' }}>
          <RefreshCw size={24} color="var(--accent)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{data.length}</div>
          <label>Registros Únicos</label>
        </div>
      </div>

      <div className="glass" style={{ padding: 20, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Tipo/Curso</th>
              <th>Apellidos y Nombre</th>
              <th>Dorsales</th>
              <th>Camisetas</th>
              <th>AMPA / Total</th>
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
                <td style={{ textAlign: 'center' }}>
                   <span style={{ color: 'var(--accent)' }}>{reg.ampa_members}</span> / {reg.total_participants}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn" style={{ padding: 5, color: '#ef4444', background: 'transparent' }} onClick={() => handleDelete(reg.id)}>
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
