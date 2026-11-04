import { Link } from 'react-router-dom';
import { ArrowLeft, Skull } from 'lucide-react';

export default function BestiaryPage() {
  return (
    <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 24 }}>
        <ArrowLeft size={16} /> Voltar para o início
      </Link>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 80 }}>
        <Skull size={64} color="#7dd3fc" />
        <h1>Bestiário</h1>
        <p style={{ color: '#94a3b8', fontSize: 16, maxWidth: 400 }}>
          Em breve! Estamos importando os dados dos monstros, seus drops e as chances exatas de farm.
        </p>
      </div>
    </div>
  );
}
