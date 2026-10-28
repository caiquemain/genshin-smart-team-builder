import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ReactionListResponse } from '../types'

export default function ReactionsPage() {
  const [data, setData] = useState<ReactionListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listReactions().then(setData).catch((e) => setError(String(e)))
  }, [])

  if (error) return <p className="error">Erro: {error}</p>
  if (!data) return <p className="status">Carregando...</p>

  return (
    <div>
      <h1>Reações Elementais</h1>
      <table className="reactions">
        <thead>
          <tr><th>Nome</th><th>Elementos</th><th>Efeito</th></tr>
        </thead>
        <tbody>
          {data.items.map((r) => (
            <tr key={r.slug}>
              <td>{r.name}</td>
              <td>{r.elements.join(' + ')}</td>
              <td>{r.effect ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
