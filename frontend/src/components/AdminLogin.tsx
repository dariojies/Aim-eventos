import React from 'react';
import { LogIn } from 'lucide-react';

interface Props {
  apiBase: string;
}

export default function AdminLogin({ apiBase }: Props) {
  const handleLogin = () => {
    window.location.href = `${apiBase}/auth/google`;
  };

  return (
    <div className="card glass animate" style={{ textAlign: 'center' }}>
      <h1>Panel de Administración</h1>
      <p style={{ color: '#94a3b8', marginBottom: 40 }}>
        Solo para personal autorizado del colegio Huerta de la Cruz.
      </p>

      <button className="btn btn-primary" onClick={handleLogin} style={{ padding: '15px 40px', fontSize: '1.1rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LogIn size={24} /> Iniciar Sesión con Google
        </span>
      </button>

      <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
          * Si tienes problemas para acceder, contacta con el administrador.
        </p>
      </div>
    </div>
  );
}
