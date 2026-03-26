import { useEffect, useState } from 'react'
import client from '@/api/client'
import { EmbedPreview } from '@/components/EmbedPreview'

interface Approval {
  id: number
  type: string
  submitted_by: string
  payload?: { description?: string; embed?: Record<string, unknown> }
  description?: string
  created_at: string
}

export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [reviewModal, setReviewModal] = useState<{ id: number; action: 'approve' | 'deny'; submitter: string } | null>(null)
  const [dmMessage, setDmMessage] = useState('')

  const load = () => {
    client.get('/approvals/pending').then((r) => setApprovals(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const openReview = (id: number, action: 'approve' | 'deny', submitter: string) => {
    const defaultMsg = action === 'approve'
      ? '✅ Deine Anfrage wurde genehmigt.'
      : '❌ Deine Anfrage wurde abgelehnt.'
    setDmMessage(defaultMsg)
    setReviewModal({ id, action, submitter })
  }

  const confirm = () => {
    if (!reviewModal) return
    client.patch(`/approvals/${reviewModal.id}`, {
      status: reviewModal.action === 'approve' ? 'approved' : 'denied',
      dm_message: dmMessage,
    }).then(() => { load(); setReviewModal(null) }).catch(() => {})
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
                {(approval.payload?.description || approval.description) && (
                  <p className="text-muted-foreground text-sm">{approval.payload?.description || approval.description}</p>
                )}
                {approval.payload?.embed && (
                  <div className="mt-2">
                    <EmbedPreview embed={approval.payload.embed as Parameters<typeof EmbedPreview>[0]['embed']} />
                  </div>
                )}
                <div className="text-muted-foreground text-xs mt-1">{new Date(approval.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => openReview(approval.id, 'approve', approval.submitted_by)}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  Genehmigen
                </button>
                <button
                  onClick={() => openReview(approval.id, 'deny', approval.submitted_by)}
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

      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-1">
              {reviewModal.action === 'approve' ? 'Anfrage genehmigen' : 'Anfrage ablehnen'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Die folgende Discord-DM wird an den Nutzer geschickt:</p>
            <textarea
              value={dmMessage}
              onChange={e => setDmMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setReviewModal(null)} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
                Abbrechen
              </button>
              <button onClick={confirm}
                className={`px-4 py-2 rounded-md text-sm text-white transition-colors ${reviewModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {reviewModal.action === 'approve' ? 'Genehmigen & DM senden' : 'Ablehnen & DM senden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
