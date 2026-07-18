import { useEffect, useState, useRef } from 'react'
import { CheckCircle2, XCircle, FileText, Clock, Flag, AlertTriangle, Pencil, Eye, Upload, Camera, Keyboard } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import CameraCapture from '../../components/CameraCapture'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { useNotification } from '../../context/NotificationContext'

function DetailsModal({ sub, onClose }) {
  if (!sub) return null
  let analysis = []
  try { analysis = JSON.parse(sub.question_analysis || '[]') } catch {}
  const score = sub.final_score ?? sub.ai_score
  const pct = score != null ? Math.round((score / sub.total_marks) * 100) : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{sub.assignment_title}</h2>
            </div>
            <button onClick={onClose} className="text-violet-200 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex items-end gap-6 mt-4">
            <div>
              <p className="text-violet-300 text-xs mb-0.5">Score</p>
              <p className="text-4xl font-black">{score}<span className="text-xl text-violet-300">/{sub.total_marks}</span></p>
            </div>
            {pct != null && (
              <div>
                <p className="text-violet-300 text-xs mb-0.5">Percentage</p>
                <p className="text-3xl font-black">{pct}%</p>
              </div>
            )}
            {sub.teacher_notes && (
              <div className="flex-1">
                <p className="text-violet-300 text-xs mb-0.5">Teacher Note</p>
                <p className="text-sm text-white opacity-90">{sub.teacher_notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {sub.ai_feedback && (
            <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Overall Feedback</p>
              <p className="text-slate-700 text-sm leading-relaxed">{sub.ai_feedback}</p>
            </div>
          )}

          {analysis.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Question Breakdown</p>
              <div className="space-y-3">
                {analysis.map(q => {
                  const pct = q.marks_available ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0
                  return (
                    <div key={q.question_number} className={`border rounded-xl p-4 ${q.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${q.correct ? 'bg-emerald-500' : 'bg-rose-500'}`}>Q{q.question_number}</span>
                          <span className={`text-sm font-semibold inline-flex items-center gap-1 ${q.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {q.correct ? <><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Correct</> : <><XCircle className="w-3.5 h-3.5" strokeWidth={2} /> Needs Improvement</>}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-black ${q.correct ? 'text-emerald-700' : 'text-rose-600'}`}>{q.marks_awarded}</span>
                          <span className="text-slate-400 text-sm">/{q.marks_available} marks</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full mb-3">
                        <div className={`h-1.5 rounded-full ${q.correct ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{q.feedback}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button onClick={onClose} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function StudentAssignments() {
  const { showToast } = useNotification()
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingId, setUploadingId] = useState(null)
  const [submitType, setSubmitType] = useState('upload')
  const [digitalText, setDigitalText] = useState('')
  const [cameraAssignmentId, setCameraAssignmentId] = useState(null)
  const [detailsSub, setDetailsSub] = useState(null)
  const fileRef = useRef()

  const fetchData = () =>
    Promise.all([api.get('/assignments/'), api.get('/assignments/my-submissions')])
      .then(([a, s]) => { setAssignments(a.data); setSubmissions(s.data) })
      .finally(() => setLoading(false))

  useEffect(() => { fetchData() }, [])

  // Poll while any submission is processing
  useEffect(() => {
    const hasProcessing = submissions.some(s => s.status === 'processing')
    if (!hasProcessing) return
    const id = setInterval(() => {
      api.get('/assignments/my-submissions').then(r => setSubmissions(r.data))
    }, 5000)
    return () => clearInterval(id)
  }, [submissions])

  const handleSubmit = async (assignmentId, overrideFile = null, onlineText = null) => {
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('assignment_id', assignmentId)
      if (overrideFile) {
        fd.append('submission_type', 'upload')
        fd.append('answer_sheet', overrideFile)
      } else if (onlineText !== null) {
        fd.append('submission_type', 'text')
        fd.append('digital_text', onlineText)
      } else if (submitType === 'upload' && fileRef.current?.files[0]) {
        fd.append('submission_type', 'upload')
        fd.append('answer_sheet', fileRef.current.files[0])
      } else {
        fd.append('submission_type', 'text')
        fd.append('digital_text', digitalText)
      }
      const res = await api.post(`/assignments/${assignmentId}/submit`, fd)
      setSubmissions(prev => [...prev, { ...res.data, assignment_title: assignments.find(a => a.id === assignmentId)?.title || '' }])
      setUploadingId(null)
      setCameraAssignmentId(null)
      setDigitalText('')
    } catch (err) {
      showToast(getErrorMessage(err, 'Submission failed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />

  const gradedSubs = submissions.filter(s => s.status === 'graded')
  const avgScore = gradedSubs.length
    ? gradedSubs.reduce((sum, s) => sum + ((s.final_score ?? s.ai_score) / s.total_marks) * 100, 0) / gradedSubs.length
    : null

  return (
    <div>
      {cameraAssignmentId && (
        <CameraCapture
          submitting={submitting}
          onClose={() => setCameraAssignmentId(null)}
          onSubmit={(file) => handleSubmit(cameraAssignmentId, file)}
        />
      )}

      {detailsSub && <DetailsModal sub={detailsSub} onClose={() => setDetailsSub(null)} />}

      <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Submit your assignments and view feedback</p>

      {avgScore != null && (
        <div className="bg-primary-light border border-violet-100 rounded-xl p-5 flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-slate-500">Your Average Assignment Score</p>
            <p className="text-5xl font-black text-primary mt-1">{Math.round(avgScore)}%</p>
            <p className="text-sm text-slate-400 mt-1">across {gradedSubs.length} graded assignment{gradedSubs.length !== 1 ? 's' : ''}</p>
          </div>
          <FileText className="w-10 h-10 text-violet-300" strokeWidth={1.5} />
        </div>
      )}

      <div className="space-y-4">
        {assignments.map(assignment => {
          const sub = submissions.find(s => s.assignment_id === assignment.id)
          const isOpen = uploadingId === assignment.id
          const isPast = new Date(assignment.due_date) < new Date()

          return (
            <div key={assignment.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">{assignment.title}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {assignment.teacher_name} · {assignment.subject}
                    {assignment.description && ` · ${assignment.description}`}
                  </p>

                  {sub ? (
                    <>
                      <p className="text-sm text-slate-600 mt-3">
                        {sub.status === 'processing' ? 'AI is grading your submission...' :
                         sub.status === 'pending_review' ? 'Graded by AI — awaiting teacher approval.' :
                         sub.status === 'flagged' ? 'Graded by AI — flagged for extra teacher review.' :
                         sub.status === 'manual_review' ? 'Submitted — teacher will grade manually.' :
                         sub.status === 'needs_review' ? (sub.ai_feedback || 'Could not automatically grade this submission — a teacher will review it manually.') :
                         sub.status === 'graded' ? (sub.ai_feedback || 'Graded.') :
                         'Submitted.'}
                      </p>
                      <div className="flex items-center gap-3 mt-4 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          sub.status === 'graded' ? 'bg-emerald-100 text-emerald-700' :
                          sub.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                          sub.status === 'flagged' ? 'bg-rose-100 text-rose-700' :
                          sub.status === 'manual_review' ? 'bg-violet-100 text-primary-dark' :
                          sub.status === 'needs_review' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {sub.status === 'processing' ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={2} /> Grading...</span> :
                           sub.status === 'pending_review' ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={2} /> Awaiting Review</span> :
                           sub.status === 'flagged' ? <span className="inline-flex items-center gap-1"><Flag className="w-3 h-3" strokeWidth={2} /> Flagged for Review</span> :
                           sub.status === 'manual_review' ? <span className="inline-flex items-center gap-1"><Pencil className="w-3 h-3" strokeWidth={2} /> Manual Review</span> :
                           sub.status === 'needs_review' ? <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" strokeWidth={2} /> Needs Manual Review</span> :
                           sub.status === 'graded' ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" strokeWidth={2} /> Graded</span> :
                           sub.status}
                        </span>
                        {sub.status === 'graded' && (
                          <button onClick={() => setDetailsSub(sub)}
                            className="flex items-center gap-1 text-sm text-primary border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-primary-light">
                            <Eye className="w-4 h-4" strokeWidth={2} /> Details
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm text-rose-500 font-medium">
                        Due: {new Date(assignment.due_date).toLocaleDateString()} {new Date(assignment.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isPast && ' (Closed)'}
                      </p>
                      {!isPast && (() => {
                        const fmt = assignment.submission_format || 'both'
                        const showUpload = fmt === 'upload' || fmt === 'both'
                        const showType = fmt === 'typed' || fmt === 'both'
                        return (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {showUpload && (
                              <>
                                <button onClick={() => { setSubmitType('upload'); setUploadingId(isOpen ? null : assignment.id) }}
                                  className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
                                  <Upload className="w-4 h-4" strokeWidth={2} /> Upload File
                                </button>
                                <button onClick={() => { setSubmitType('upload'); setUploadingId(null); setCameraAssignmentId(assignment.id) }}
                                  className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
                                  <Camera className="w-4 h-4" strokeWidth={2} /> Use Camera
                                </button>
                              </>
                            )}
                            {showType && (
                              <button onClick={() => { setSubmitType('text'); setUploadingId(isOpen ? null : assignment.id) }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
                                <Keyboard className="w-4 h-4" strokeWidth={2} /> Type Answer
                              </button>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {isOpen && (
                    <div className="mt-4 border border-violet-200 rounded-xl p-4 bg-primary-light">
                      {submitType === 'upload' ? (
                        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white" />
                      ) : (
                        <textarea value={digitalText} onChange={e => setDigitalText(e.target.value)}
                          rows={5} placeholder="Type your answers here..."
                          className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      )}
                      <button onClick={() => handleSubmit(assignment.id)} disabled={submitting}
                        className="mt-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                        {submitting ? 'Submitting...' : 'Submit'}
                      </button>
                    </div>
                  )}
                </div>

                {sub && sub.status === 'graded' && (
                  <div className="text-right ml-6 flex-shrink-0">
                    <span className="text-4xl font-black text-primary">{Math.round(sub.final_score ?? sub.ai_score ?? 0)}</span>
                    <span className="text-slate-400 text-sm">/{assignment.total_marks}</span>
                    {sub.teacher_notes && <p className="text-xs text-slate-500 mt-1 max-w-[120px] text-right">{sub.teacher_notes}</p>}
                  </div>
                )}
                {sub && ['pending_review', 'manual_review', 'processing'].includes(sub.status) && (
                  <div className="text-center ml-6 flex-shrink-0">
                    <Clock className="w-6 h-6 mx-auto mb-1 text-amber-400" strokeWidth={2} />
                    <p className="text-xs text-amber-600 font-semibold">Pending<br/>Review</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {assignments.length === 0 && (
          <div className="text-center py-16 text-slate-400">No assignments available yet.</div>
        )}
      </div>
    </div>
  )
}
