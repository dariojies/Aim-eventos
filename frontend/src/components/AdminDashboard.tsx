import React, { useState, useEffect } from 'react';
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
      r.full_name,
      r.dorsal_start ? `${r.dorsal_start}${r.dorsal_end > r.dorsal_start ? '-' + r.dorsal_end : ''}` : '-',
      r.ampa_members,
      r.total_participants,
      r.shirt_4y, r.shirt_8y, r.shirt_12y, r.shirt_16y, r.shirt_s, r.shirt_m, r.shirt_l, r.shirt_xl, r.shirt_xxl,
      r.observations || ''
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `marcha_solidaria_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="container animate" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="admin-header">
        <div>
          <h1 style={{ textAlign: 'left', margin: 0, fontSize: '1.8rem' }}>Panel Control Carrera</h1>
          <p style={{ color: 'var(--text-dim)' }}>Gestión de inscripciones y dorsales</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
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
            {data.map(reg => (
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
                <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {!reg.wants_shirts ? 'No' : (
                    reg.shirt_4y + reg.shirt_8y + reg.shirt_12y + reg.shirt_16y + reg.shirt_s + reg.shirt_m + reg.shirt_l + reg.shirt_xl + reg.shirt_xxl + ' ud.'
                  )}
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
