import { useEffect, useState, useRef } from 'react'
import { Pencil, Clock, Flag, AlertTriangle, ClipboardList, Bot, FileText, Image, CheckCircle2, XCircle } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import { useNotification } from '../../context/NotificationContext'
import { getErrorMessage } from '../../utils/getErrorMessage'

const STATUS_STYLE = {
  graded: 'bg-emerald-100 text-emerald-700',
  pending_review: 'bg-amber-100 text-amber-700',
  manual_review: 'bg-violet-100 text-primary-dark',
  processing: 'bg-slate-100 text-slate-600',
  flagged: 'bg-rose-100 text-rose-700',
  needs_review: 'bg-orange-100 text-orange-700',
}

const STATUS_LABEL = {
  manual_review: { icon: Pencil, text: 'Needs Manual Grade' },
  pending_review: { icon: Clock, text: 'AI Graded — Pending Approval' },
  flagged: { icon: Flag, text: 'Flagged — Low AI Confidence' },
  needs_review: { icon: AlertTriangle, text: 'Could Not Auto-Grade' },
}

export default function Assignments() {
  const { showToast } = useNotification()
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewSub, setReviewSub] = useState(null)
  const [overrideScore, setOverrideScore] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/assignments/'), api.get('/assignments/teacher/all-submissions')])
      .then(([a, s]) => { setAssignments(a.data); setSubmissions(s.data) })
      .finally(() => setLoading(false))
  }, [])


  const submitReview = async (action) => {
    setReviewing(true)
    try {
      const params = new URLSearchParams({ action })
      if (action !== 'approve') params.append('final_score', overrideScore)
      if (overrideNote) params.append('teacher_notes', overrideNote)
      const res = await api.post(`/assignments/submissions/${reviewSub.id}/teacher-review?${params}`)
      setSubmissions(prev => prev.map(s => s.id === reviewSub.id ? { ...s, ...res.data } : s))
      setReviewSub(null); setOverrideScore(''); setOverrideNote('')
    } catch (err) {
      showToast(getErrorMessage(err, 'Review failed'), 'error')
    } finally {
      setReviewing(false)
    }
  }

  const pendingSubs = submissions.filter(s => ['pending_review', 'manual_review', 'flagged', 'needs_review'].includes(s.status))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and grade student assignments</p>
        </div>
      </div>

      {/* Assignments list */}
      {!loading && assignments.length === 0 && (
        <div className="border-2 border-dashed border-violet-200 rounded-xl p-8 text-center mb-6 bg-primary-light/40">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-violet-200" strokeWidth={1.5} />
          <p className="font-semibold text-slate-700">No assignments yet</p>
          <p className="text-sm text-slate-400 mt-1">Go to <strong>Grade Management</strong> to upload a new assignment</p>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Assignments</h2>
          <div className="space-y-3">
            {assignments.map(a => {
              const subCount = submissions.filter(s => s.assignment_id === a.id).length
              const isPast = new Date(a.due_date) < new Date()
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-y-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-slate-900 text-sm">{a.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${a.has_marking_scheme ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.has_marking_scheme ? <><Bot className="w-3 h-3" strokeWidth={2} /> AI Grading</> : <><Pencil className="w-3 h-3" strokeWidth={2} /> Manual Grading</>}
                      </span>
                      {isPast && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Closed</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.subject} · {a.total_marks} marks · {subCount} submission{subCount !== 1 ? 's' : ''} · Due {new Date(a.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending review */}
      {pendingSubs.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Pending Your Review</h2>
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingSubs.length}</span>
          </div>
          <div className="space-y-3">
            {pendingSubs.map(s => (
              <div key={s.id} className="bg-white border-2 border-amber-200 rounded-xl px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-y-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900 text-sm">{s.student_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-600'}`}>
                      {(() => {
                        const info = STATUS_LABEL[s.status]
                        if (!info) return s.status
                        const StatusIcon = info.icon
                        return <><StatusIcon className="w-3 h-3" strokeWidth={2} /> {info.text}</>
                      })()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {s.assignment_title}
                    {s.ai_score != null && <> · AI Score: <strong className="text-primary">{Math.round(s.ai_score)}/{s.total_marks}</strong></>}
                  </p>
                </div>
                <button onClick={() => { setReviewSub(s); setOverrideScore(''); setOverrideNote('') }}
                  className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  {s.status === 'manual_review' || s.status === 'needs_review' ? 'Grade →' : 'Review & Approve →'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All submissions table */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">All Submissions</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Student', 'Assignment', 'Score', 'Feedback', 'Status'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingState.Row colSpan={5} />
            ) : submissions.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">No submissions yet</td></tr>
            ) : submissions.map(s => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-4 text-sm font-medium text-slate-900">{s.student_name}</td>
                <td className="px-5 py-4 text-sm text-slate-600">{s.assignment_title}</td>
                <td className="px-5 py-4 text-sm font-semibold text-primary">
                  {s.final_score != null ? `${Math.round(s.final_score)}/${s.total_marks}` :
                   s.ai_score != null ? `${Math.round(s.ai_score)}/${s.total_marks}` : '--'}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 max-w-[220px] truncate">{s.ai_feedback || (s.status === 'manual_review' ? 'Awaiting manual grade' : 'In progress...')}</td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-600'}`}>
                    {s.status === 'manual_review' ? 'Manual Review' : s.status === 'needs_review' ? 'Needs Review' : s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Review modal */}
      {reviewSub && (() => {
        let analysis = []
        try { analysis = JSON.parse(reviewSub.question_analysis || '[]') } catch {}
        const isManual = reviewSub.status === 'manual_review'
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setReviewSub(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-primary text-white px-6 py-4 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-lg">{isManual ? 'Grade Assignment' : 'Review Submission'}</h2>
                    <p className="text-violet-200 text-sm mt-0.5">{reviewSub.student_name} · {reviewSub.assignment_title}</p>
                  </div>
                  <button onClick={() => setReviewSub(null)} className="text-violet-200 hover:text-white text-2xl leading-none">×</button>
                </div>
                {!isManual && (
                  <div className="mt-2 text-sm">AI Score: <strong>{Math.round(reviewSub.ai_score ?? 0)}/{reviewSub.total_marks}</strong></div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Student submission content */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Student Submission</p>
                  {reviewSub.submission_type === 'text' && reviewSub.digital_text ? (
                    <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{reviewSub.digital_text}</p>
                    </div>
                  ) : reviewSub.answer_sheet_url ? (
                    <div className="flex items-center gap-3">
                      {reviewSub.answer_sheet_url.match(/\.(pdf)$/i)
                        ? <FileText className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
                        : <Image className="w-8 h-8 text-slate-300" strokeWidth={1.5} />}
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {reviewSub.answer_sheet_url.match(/\.(pdf)$/i) ? 'PDF Document' : 'Image File'}
                        </p>
                        <a href={`http://localhost:8000${reviewSub.answer_sheet_url}`} target="_blank" rel="noreferrer"
                          className="text-sm text-primary hover:underline font-medium">
                          View / Download →
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No content available</p>
                  )}
                </div>

                {!isManual && reviewSub.ai_feedback && (
                  <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">AI Overall Feedback</p>
                    <p className="text-sm text-slate-700">{reviewSub.ai_feedback}</p>
                  </div>
                )}

                {analysis.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Question Breakdown</p>
                    <div className="space-y-3">
                      {analysis.map(q => (
                        <div key={q.question_number} className={`border rounded-xl p-4 ${q.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${q.correct ? 'bg-emerald-500' : 'bg-rose-500'}`}>Q{q.question_number}</span>
                              <span className={`text-sm font-semibold inline-flex items-center gap-1 ${q.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {q.correct ? <><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Correct</> : <><XCircle className="w-3.5 h-3.5" strokeWidth={2} /> Needs Improvement</>}
                              </span>
                            </div>
                            <span className={`text-lg font-black ${q.correct ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {q.marks_awarded}<span className="text-slate-400 text-sm font-normal">/{q.marks_available}</span>
                            </span>
                          </div>
                          {q.justification && (
                            <div className="bg-white/70 rounded-lg px-3 py-2 mb-2">
                              <p className="text-xs font-semibold text-slate-500 mb-0.5">AI Justification</p>
                              <p className="text-xs text-slate-700">{q.justification}</p>
                            </div>
                          )}
                          {q.feedback && <p className="text-xs text-slate-600 italic">{q.feedback}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">{isManual ? 'Enter Grade' : 'Override Score (optional)'}</p>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0">
                      <label className="text-xs text-slate-500 block mb-1">Score</label>
                      <input type="number" min={0} max={reviewSub.total_marks}
                        value={overrideScore}
                        onChange={e => setOverrideScore(e.target.value)}
                        placeholder={isManual ? '0' : String(Math.round(reviewSub.ai_score ?? 0))}
                        className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      <p className="text-xs text-slate-400 mt-1">out of {reviewSub.total_marks}</p>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-1">Note to Student (optional)</label>
                      <textarea value={overrideNote} onChange={e => setOverrideNote(e.target.value)} rows={2}
                        placeholder="e.g. Good effort, see comments..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                <button onClick={() => setReviewSub(null)} className="border border-slate-300 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-100">Cancel</button>
                {isManual ? (
                  <button onClick={() => submitReview('manual_grade')} disabled={reviewing || !overrideScore}
                    className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                    {reviewing ? 'Saving...' : <><CheckCircle2 className="w-4 h-4" strokeWidth={2} /> Save Grade ({overrideScore || '?'}/{reviewSub.total_marks})</>}
                  </button>
                ) : overrideScore !== '' && Number(overrideScore) !== Math.round(reviewSub.ai_score ?? 0) ? (
                  <button onClick={() => submitReview('override')} disabled={reviewing || !overrideScore}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                    {reviewing ? 'Saving...' : <><Pencil className="w-4 h-4" strokeWidth={2} /> Override & Approve ({overrideScore}/{reviewSub.total_marks})</>}
                  </button>
                ) : (
                  <button onClick={() => submitReview('approve')} disabled={reviewing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                    {reviewing ? 'Approving...' : <><CheckCircle2 className="w-4 h-4" strokeWidth={2} /> Approve AI Score ({Math.round(reviewSub.ai_score ?? 0)}/{reviewSub.total_marks})</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
