import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Monitor, FileEdit, Clock, Eye, AlertTriangle, Upload } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import OnlineExam from '../../components/OnlineExam'
import { getErrorMessage } from '../../utils/getErrorMessage'
import StructuredExam from '../../components/StructuredExam'
import ExamBriefing from '../../components/ExamBriefing'
import { useNotification } from '../../context/NotificationContext'

function DetailsModal({ submission, exam, onClose }) {
  if (!submission) return null
  let analysis = []
  try { analysis = JSON.parse(submission.question_analysis || '[]') } catch {}

  const totalAwarded = analysis.reduce((s, q) => s + (q.marks_awarded || 0), 0)
  const totalAvailable = analysis.reduce((s, q) => s + (q.marks_available || 0), 0)
  const percentage = totalAvailable ? Math.round((totalAwarded / totalAvailable) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold font-display">{exam?.title}</h2>
              <p className="text-violet-200 text-sm mt-0.5">{exam?.teacher_name} • {exam?.subject}</p>
            </div>
            <button onClick={onClose} className="text-violet-200 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex items-end gap-6 mt-4">
            <div>
              <p className="text-violet-300 text-xs mb-0.5">Score</p>
              <p className="text-4xl font-black">{submission.final_score ?? submission.ai_score}<span className="text-xl text-violet-300">/{exam?.total_marks}</span></p>
            </div>
            <div>
              <p className="text-violet-300 text-xs mb-0.5">Percentage</p>
              <p className="text-3xl font-black">{Math.round(((submission.final_score ?? submission.ai_score) / (exam?.total_marks || 100)) * 100)}%</p>
            </div>
            <div>
              <p className="text-violet-300 text-xs mb-0.5">Result</p>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${(submission.final_score ?? submission.ai_score) >= (exam?.passing_marks || 0) ? 'bg-emerald-400 text-emerald-900' : 'bg-rose-400 text-rose-900'}`}>
                {(submission.final_score ?? submission.ai_score) >= (exam?.passing_marks || 0) ? 'PASS' : 'FAIL'}
              </span>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Overall Feedback</p>
            <p className="text-slate-700 text-sm leading-relaxed">{submission.ai_feedback || 'No feedback available.'}</p>
          </div>
          {analysis.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Question-by-Question Breakdown</p>
              <div className="space-y-3">
                {analysis.map((q) => {
                  const pct = q.marks_available ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0
                  return (
                    <div key={q.question_number} className={`border rounded-xl p-4 ${q.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${q.correct ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                            Q{q.question_number}
                          </span>
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
          {analysis.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">Detailed question analysis not available.</div>
          )}
          {analysis.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-emerald-600">{analysis.filter(q => q.correct).length} correct</span>
                {' · '}
                <span className="font-semibold text-rose-500">{analysis.filter(q => !q.correct).length} need improvement</span>
                {' · '}
                <span className="text-slate-500">{analysis.length} total questions</span>
              </div>
              <span className="font-black text-primary text-lg">{percentage}%</span>
            </div>
          )}
          <button onClick={onClose} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-xl transition">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function OnlineExams() {
  const { showToast } = useNotification()
  const [exams, setExams] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [detailsSub, setDetailsSub] = useState(null)
  const [detailsExam, setDetailsExam] = useState(null)
  const [onlineExam, setOnlineExam] = useState(null)
  const [structuredExam, setStructuredExam] = useState(null)
  const [briefingExam, setBriefingExam] = useState(null)
  const [briefingType, setBriefingType] = useState(null)
  // Only meaningful when the exam's submission_format is 'both' ("Either") — records
  // which of the two the student picked, so OnlineExam.jsx knows whether to render
  // the typed textarea or the file-upload widget instead of always defaulting to typed.
  const [examMode, setExamMode] = useState(null)
  const [blockedExamIds, setBlockedExamIds] = useState(new Set())

  const fetchData = () =>
    Promise.all([api.get('/exams/'), api.get('/submissions/my'), api.get('/proctoring/blocks/my')])
      .then(([e, s, b]) => {
        setExams(e.data)
        setSubmissions(s.data)
        setBlockedExamIds(new Set(b.data.map(x => x.exam_id)))
      })
      .finally(() => setLoading(false))

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const hasProcessing = submissions.some(s => s.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(() => {
      api.get('/submissions/my').then(r => setSubmissions(r.data))
    }, 5000)
    return () => clearInterval(interval)
  }, [submissions])

  // Every call site provides either an overrideFile (upload) or onlineText
  // (typed) — the OnlineExam overlay is the only submitter and always passes
  // one of the two.
  const handleSubmit = async (examId, overrideFile = null, onlineText = null, isViolation = false) => {
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('exam_id', examId)
      if (overrideFile) {
        fd.append('submission_type', 'upload')
        fd.append('answer_sheet', overrideFile)
      } else {
        fd.append('submission_type', 'text')
        fd.append('digital_text', onlineText || '')
      }
      const res = await api.post('/submissions/', fd)
      setSubmissions(prev => [...prev, res.data])
      if (!isViolation) {
        setOnlineExam(null)
        setStructuredExam(null)
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Submission failed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />

  // Filter: structured exams OR exams that are explicitly online/both
  // exam_type is authoritative for which list an exam belongs in — is_structured only
  // describes an online exam's internal question format, it must never admit a
  // Physical (or other) exam into this list on its own.
  const onlineExams = exams.filter(e => e.exam_type === 'online' || e.exam_type === 'both' || !e.exam_type)

  // Group by subject
  const bySubject = onlineExams.reduce((acc, exam) => {
    const subj = exam.subject || 'General'
    if (!acc[subj]) acc[subj] = []
    acc[subj].push(exam)
    return acc
  }, {})

  const subjects = Object.keys(bySubject).sort()

  const gradedSubs = submissions.filter(s => s.status === 'graded' && (s.final_score ?? s.ai_score) != null)
  const onlineSubs = gradedSubs.filter(s => onlineExams.some(e => e.id === s.exam_id))
  const avgScore = onlineSubs.length
    ? onlineSubs.reduce((sum, s, _, arr) => sum + (s.final_score ?? s.ai_score) / arr.length, 0)
    : 0

  const openDetails = (sub, exam) => { setDetailsSub(sub); setDetailsExam(exam) }

  return (
    <div>
      {/* Pre-exam briefing */}
      {briefingExam && (
        <ExamBriefing
          exam={briefingExam}
          onCancel={() => { setBriefingExam(null); setBriefingType(null) }}
          onStart={() => {
            const exam = briefingExam
            setBriefingExam(null)
            if (briefingType === 'structured') {
              setStructuredExam(exam)
            } else {
              setOnlineExam(exam)
            }
          }}
        />
      )}

      {/* Online exam overlay */}
      {onlineExam && (
        <OnlineExam
          exam={onlineExam}
          forceMode={examMode}
          submitting={submitting}
          onClose={() => { setOnlineExam(null); setExamMode(null) }}
          onSubmit={(payload, isViolation = false) =>
            payload instanceof File
              ? handleSubmit(onlineExam.id, payload, null, isViolation)
              : handleSubmit(onlineExam.id, null, payload, isViolation)
          }
        />
      )}

      {/* Structured exam overlay */}
      {structuredExam && (
        <StructuredExam
          exam={structuredExam}
          submitting={submitting}
          onClose={() => setStructuredExam(null)}
          onSubmit={(subData, isViolation = false) => {
            setSubmissions(prev => [...prev, { ...subData, exam_id: structuredExam.id }])
            if (!isViolation) {
              setStructuredExam(null)
            }
          }}
        />
      )}

      {detailsSub && (
        <DetailsModal
          submission={detailsSub}
          exam={detailsExam}
          onClose={() => { setDetailsSub(null); setDetailsExam(null) }}
        />
      )}

      <h1 className="text-2xl font-bold font-display text-slate-900">Online Exams</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Take and track your online examinations by subject</p>

      {/* Average score banner */}
      {onlineSubs.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-slate-500">Your Online Exam Average</p>
            <p className="text-5xl font-black text-emerald-600 mt-1">{Math.round(avgScore)}</p>
            <p className="text-sm text-slate-400 mt-1">across {onlineSubs.length} completed exams</p>
          </div>
          <Monitor className="w-10 h-10 text-emerald-300" strokeWidth={1.5} />
        </div>
      )}

      {/* Exams grouped by subject */}
      {subjects.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No online exams available yet.</div>
      ) : (
        <div className="space-y-8">
          {subjects.map(subject => (
            <div key={subject}>
              {/* Subject heading */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                <h2 className="text-lg font-bold font-display text-slate-800">{subject}</h2>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">{bySubject[subject].length} exam{bySubject[subject].length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-4">
                {bySubject[subject].map(exam => {
                  const sub = submissions.find(s => s.exam_id === exam.id)
                  const deadline = new Date(exam.available_until)
                  const isPast = deadline < new Date()

                  return (
                    <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {exam.is_structured ? <FileEdit className="w-[18px] h-[18px] text-violet-500" strokeWidth={2} /> : <Monitor className="w-[18px] h-[18px] text-emerald-500" strokeWidth={2} />}
                            <h3 className="text-lg font-bold font-display text-slate-900">{exam.title}</h3>
                            {exam.is_structured && <span className="ml-2 text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-bold">Structured</span>}
                          </div>
                          <p className="text-sm text-slate-400 mt-0.5">
                            {exam.teacher_name} • {new Date(exam.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {sub ? (
                            <>
                              <p className="text-sm text-slate-600 mt-3">
                                {sub.status === 'pending_review' || sub.status === 'flagged'
                                  ? 'Your submission has been graded by AI and is awaiting teacher approval.'
                                  : sub.ai_feedback || 'Grading in progress...'}
                              </p>
                              <div className="flex items-center gap-3 mt-4 flex-wrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  sub.status === 'graded' ? 'bg-emerald-100 text-emerald-700' :
                                  sub.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                                  sub.status === 'flagged' ? 'bg-amber-100 text-amber-700' :
                                  'bg-violet-100 text-violet-700'
                                }`}>
                                  {sub.status === 'pending_review' || sub.status === 'flagged' ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={2} /> Awaiting Review</span> : sub.status}
                                </span>
                                {sub.status === 'graded' && (
                                  <button
                                    onClick={() => openDetails(sub, exam)}
                                    className="flex items-center gap-1 text-sm text-primary border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-primary-light">
                                    <Eye className="w-4 h-4" strokeWidth={2} /> Details
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="mt-3">
                              <p className="text-sm text-rose-500 font-medium">
                                Deadline: {deadline.toLocaleDateString()} {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isPast && ' (Closed)'}
                              </p>
                              {!isPast && (
                                <div className="flex gap-2 mt-3 flex-wrap">
                                  {blockedExamIds.has(exam.id) ? (
                                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={2} />
                                      <div>
                                        <p className="text-sm font-bold text-red-700">Exam Access Revoked</p>
                                        <p className="text-xs text-red-500">Cheating detected — 3 proctoring violations recorded</p>
                                      </div>
                                    </div>
                                  ) : exam.submission_format === 'both' ? (
                                    // "Either" — the teacher allows both, so the student must be
                                    // offered an explicit choice instead of silently defaulting to typed.
                                    <>
                                      <button
                                        onClick={() => {
                                          setExamMode('typed')
                                          setBriefingExam(exam)
                                          setBriefingType(exam.is_structured ? 'structured' : 'online')
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                                      >
                                        {exam.is_structured ? <FileEdit className="w-4 h-4" strokeWidth={2} /> : <Monitor className="w-4 h-4" strokeWidth={2} />} Type Answers
                                      </button>
                                      <button
                                        onClick={() => {
                                          // Upload always uses the single-document OnlineExam overlay
                                          // (one file for the whole exam), regardless of is_structured —
                                          // StructuredExam has no per-question upload capability.
                                          setExamMode('upload')
                                          setBriefingExam(exam)
                                          setBriefingType('online')
                                        }}
                                        className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                                      >
                                        <Upload className="w-4 h-4" strokeWidth={2} /> Upload Handwritten Answers
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        // Upload-format exams always use the single-document overlay
                                        // (one file for the whole exam), skipping the per-question flow.
                                        const isUpload = exam.submission_format === 'upload'
                                        setExamMode(isUpload ? 'upload' : 'typed')
                                        setBriefingExam(exam)
                                        setBriefingType(!isUpload && exam.is_structured ? 'structured' : 'online')
                                      }}
                                      className={`${exam.submission_format === 'upload' ? 'bg-primary hover:bg-primary-dark' : exam.is_structured ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5`}
                                    >
                                      {exam.submission_format === 'upload' ? <><Upload className="w-4 h-4" strokeWidth={2} /> Upload Handwritten Answers</> :
                                       exam.is_structured ? <><FileEdit className="w-4 h-4" strokeWidth={2} /> Take Structured Exam</> :
                                       <><Monitor className="w-4 h-4" strokeWidth={2} /> Take Exam Online</>}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {sub && (
                          <div className="text-right ml-6 flex-shrink-0">
                            {sub.status === 'pending_review' || sub.status === 'flagged' ? (
                              <div className="text-center">
                                <Clock className="w-6 h-6 mx-auto mb-1 text-amber-400" strokeWidth={2} />
                                <p className="text-xs text-amber-600 font-semibold">Awaiting teacher<br/>review</p>
                              </div>
                            ) : sub.status === 'graded' && (sub.final_score ?? sub.ai_score) != null ? (
                              <div>
                                <span className="text-4xl font-black text-emerald-600">{Math.round(sub.final_score ?? sub.ai_score)}</span>
                                <span className="text-slate-400 text-sm">/{exam.total_marks || 100}</span>
                                {sub.teacher_notes && (
                                  <p className="text-xs text-slate-500 mt-1 max-w-[120px] text-right">{sub.teacher_notes}</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
