import { useEffect, useState } from 'react'
import client from '@/api/client'

interface Approval {
  id: number
  type: string
  submitted_by: string
  description?: string
  created_at: string
}

export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([])

  const load = () => {
    client.get('/approvals/pending').then((r) => setApprovals(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const decide = (id: number, action: 'approve' | 'deny') => {
    client.post(`/approvals/${id}/${action}`)
      .then(() => load())
      .catch(() => {})
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Freigaben</h2>
      <div className="space-y-4">
        {approvals.map((approval) => (
          <div key={approval.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground">{approval.type}</span>
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">pending</span>
                </div>
                <div className="text-muted-foreground text-sm mb-1">Von: <span className="text-foreground">{approval.submitted_by}</span></div>
                {approval.description && <p className="text-muted-foreground text-sm">{approval.description}</p>}
                <div className="text-muted-foreground text-xs mt-1">{new Date(approval.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => decide(approval.id, 'approve')}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  Genehmigen
                </button>
                <button
                  onClick={() => decide(approval.id, 'deny')}
                  className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                >
                  Ablehnen
                </button>
              </div>
            </div>
          </div>
        ))}
        {approvals.length === 0 && <p className="text-muted-foreground">Keine ausstehenden Freigaben.</p>}
      </div>
    </div>
  )
}
