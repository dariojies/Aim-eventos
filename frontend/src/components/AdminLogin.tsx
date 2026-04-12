import { LogIn } from 'lucide-react';

interface Props {
  apiBase: string;
}

export default function AdminLogin({ apiBase }: Props) {
  const handleLogin = () => {
    window.location.href = `${apiBase}/auth/google`;
  };

  return (
    <div className="card glass animate" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <h1>Panel de Administración</h1>
      <p style={{ color: 'var(--text-dim)', marginBottom: 40 }}>
        Solo para personal autorizado del colegio Huerta de la Cruz.
      </p>

      <button className="btn btn-primary" onClick={handleLogin} style={{ padding: '15px 40px', fontSize: '1.1rem', margin: '0 auto' }}>
        <LogIn size={24} /> Iniciar Sesión con Google
      </button>

      <div style={{ marginTop: 40, borderTop: '1px solid #e2e8f0', paddingTop: 20, width: '100%' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          * Si tienes problemas para acceder, contacta con el administrador.
        </p>
      </div>
    </div>
  );
}
