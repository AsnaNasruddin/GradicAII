import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import { useNotification } from '../../context/NotificationContext'

const FLAG_STYLE = {
  ai_uncertainty: 'bg-orange-100 text-orange-700',
  suspicious: 'bg-rose-100 text-rose-700',
}

export default function FlaggedAnswers() {
  const { showToast } = useNotification()
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/flagged/').then((r) => setFlags(r.data)).finally(() => setLoading(false))
  }, [])

  const resolve = async (id, resolved) => {
    try {
      const res = await api.put(`/flagged/${id}/resolve`, { resolved })
      setFlags((prev) => prev.map((f) => (f.id === id ? res.data : f)))
    } catch { showToast('Failed to resolve flag', 'error') }
  }

  const pending = flags.filter((f) => !f.resolved)
  const resolved = flags.filter((f) => f.resolved)

  if (loading) return <LoadingState />

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Flagged Answers</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Review answers flagged by the AI for uncertainty or suspicious activity</p>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Flags</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{flags.length}</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-100 p-5 shadow-sm">
          <p className="text-sm text-orange-600">Pending Review</p>
          <p className="text-3xl font-black text-orange-700 mt-1">{pending.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-5 shadow-sm">
          <p className="text-sm text-emerald-600">Resolved</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">{resolved.length}</p>
        </div>
      </div>

      {flags.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-300" strokeWidth={1.5} />
          <p className="text-slate-400">No flagged answers. AI has high confidence in all graded submissions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((f) => (
            <div key={f.id} className={`bg-white rounded-xl border shadow-sm p-5 ${f.resolved ? 'opacity-60' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${FLAG_STYLE[f.flag_type] || 'bg-slate-100 text-slate-600'}`}>
                      {f.flag_type === 'ai_uncertainty' ? <><AlertTriangle className="w-3 h-3" strokeWidth={2} /> AI Uncertainty</> : <><ShieldAlert className="w-3 h-3" strokeWidth={2} /> Suspicious</>}
                    </span>
                    {f.resolved && <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" strokeWidth={2} /> Resolved</span>}
                  </div>
                  <p className="font-semibold text-slate-900">{f.exam_title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">Student: {f.student_name}</p>
                  <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-lg px-3 py-2">{f.reason}</p>
                </div>
                {!f.resolved && (
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => resolve(f.id, true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Resolve
                    </button>
                    <button onClick={() => resolve(f.id, false)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
