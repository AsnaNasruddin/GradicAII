import { useEffect, useState, useRef } from 'react'
import { CheckCircle2, XCircle, FileText, Clock, BarChart3, Upload, Camera, Keyboard } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import CameraCapture from '../../components/CameraCapture'
import { getErrorMessage } from '../../utils/getErrorMessage'
import { useNotification } from '../../context/NotificationContext'

const BACKEND_URL = api.defaults.baseURL

function ExamReportModal({ sub, exam, onClose }) {
  if (!sub) return null
  let analysis = []
  try { analysis = JSON.parse(sub.question_analysis || '[]') } catch {}
  const total = sub.total_marks || exam?.total_marks || 100
  const score = sub.final_score ?? sub.ai_score
  const pct = score != null ? Math.round((score / total) * 100) : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-6 py-5 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{exam?.title || sub.exam_title || 'Exam Report'}</h2>
              <p className="text-violet-200 text-sm mt-0.5">{sub.teacher_name} • {exam?.subject || sub.exam_subject || 'Exam'}</p>
            </div>
            <button onClick={onClose} className="text-violet-200 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="flex items-end gap-6 mt-4">
            <div>
              <p className="text-violet-300 text-xs mb-0.5">Score</p>
              <p className="text-4xl font-black">{score}<span className="text-xl text-violet-300">/{total}</span></p>
            </div>
            {pct != null && (
              <div>
                <p className="text-violet-300 text-xs mb-0.5">Percentage</p>
                <p className="text-3xl font-black">{pct}%</p>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 space-y-5">
          {sub.ai_feedback && (
            <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Overall Feedback</p>
              <p className="text-slate-700 text-sm leading-relaxed">{sub.ai_feedback}</p>
            </div>
          )}
          {sub.teacher_notes && (
            <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Teacher's Note</p>
              <p className="text-slate-700 text-sm leading-relaxed">{sub.teacher_notes}</p>
            </div>
          )}
          {analysis.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Question Breakdown</p>
              <div className="space-y-3">
                {analysis.map(q => {
                  const qPct = q.marks_available ? Math.round((q.marks_awarded / q.marks_available) * 100) : 0
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
                        <div className={`h-1.5 rounded-full ${q.correct ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${qPct}%` }} />
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

export default function PhysicalExams() {
  const { showToast } = useNotification()
  const [exams, setExams] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingExam, setUploadingExam] = useState(null)
  const [typingExamId, setTypingExamId] = useState(null)
  const [digitalText, setDigitalText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cameraExamId, setCameraExamId] = useState(null)
  const [reportSub, setReportSub] = useState(null)
  const [reportExam, setReportExam] = useState(null)
  const fileRef = useRef()

  const fetchData = () =>
    Promise.all([api.get('/exams/'), api.get('/submissions/my')])
      .then(([e, s]) => {
        setExams(e.data)
        setSubmissions(s.data)
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

  const handleSubmit = async (examId, overrideFile = null, onlineText = null) => {
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('exam_id', examId)
      if (overrideFile) {
        fd.append('submission_type', 'upload')
        fd.append('answer_sheet', overrideFile)
      } else if (onlineText !== null) {
        fd.append('submission_type', 'text')
        fd.append('digital_text', onlineText)
      } else if (fileRef.current?.files[0]) {
        fd.append('submission_type', 'upload')
        fd.append('answer_sheet', fileRef.current.files[0])
      } else {
        throw new Error('Please select a file')
      }

      const res = await api.post('/submissions/', fd)
      setSubmissions(prev => [...prev, res.data])
      setUploadingExam(null)
      setCameraExamId(null)
      setTypingExamId(null)
      setDigitalText('')
    } catch (err) {
      showToast(getErrorMessage(err, err.message || 'Submission failed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />

  // Filter: physical exams or both
  const physicalExams = exams.filter(e => e.exam_type === 'physical' || e.exam_type === 'both' || !e.exam_type)

  const bySubject = physicalExams.reduce((acc, exam) => {
    const subj = exam.subject || 'General'
    if (!acc[subj]) acc[subj] = []
    acc[subj].push(exam)
    return acc
  }, {})

  const subjects = Object.keys(bySubject).sort()

  return (
    <div>
      {/* Camera full-screen overlay */}
      {cameraExamId && (
        <CameraCapture
          submitting={submitting}
          onClose={() => setCameraExamId(null)}
          onSubmit={(file) => handleSubmit(cameraExamId, file)}
        />
      )}

      {/* Graded report modal */}
      {reportSub && (
        <ExamReportModal
          sub={reportSub}
          exam={reportExam}
          onClose={() => { setReportSub(null); setReportExam(null) }}
        />
      )}

      <h1 className="text-2xl font-bold text-slate-900">Physical Exams</h1>
      <p className="text-slate-500 text-sm mt-1 mb-8">Upload your handwritten answer sheets for AI grading and teacher review.</p>

      {/* Exams grouped by subject */}
      {subjects.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No physical exams available yet.</div>
      ) : (
        <div className="space-y-8">
          {subjects.map(subject => (
            <div key={subject}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-6 bg-primary rounded-full" />
                <h2 className="text-lg font-bold text-slate-800">{subject}</h2>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">{bySubject[subject].length} exam{bySubject[subject].length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-4">
                {bySubject[subject].map(exam => {
                  const sub = submissions.find(s => s.exam_id === exam.id)
                  const isOpen = uploadingExam === exam.id
                  const isTyping = typingExamId === exam.id
                  const deadline = new Date(exam.available_until)
                  const isPast = deadline < new Date()

                  return (
                    <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-[18px] h-[18px] text-violet-500" strokeWidth={2} />
                            <h3 className="text-lg font-bold text-slate-900">{exam.title}</h3>
                          </div>
                          <p className="text-sm text-slate-400 mt-0.5">
                            {exam.teacher_name} • {new Date(exam.created_at).toLocaleDateString()}
                          </p>
                          
                          {sub ? (
                            <>
                              <p className="text-sm text-slate-600 mt-3">
                                {sub.status === 'processing' ? 'Your answer sheet is being graded by AI...' :
                                 sub.status === 'pending_review' || sub.status === 'flagged' ? 'Graded by AI — awaiting teacher approval.' :
                                 'Grading completed.'}
                              </p>
                              <div className="flex items-center gap-3 mt-4 flex-wrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  sub.status === 'graded' ? 'bg-emerald-100 text-emerald-700' :
                                  sub.status === 'processing' ? 'bg-violet-100 text-primary-dark' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {sub.status === 'processing' ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={2} /> Grading...</span> :
                                   sub.status === 'graded' ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" strokeWidth={2} /> Graded</span> :
                                   <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={2} /> Awaiting Review</span>}
                                </span>
                                {sub.status === 'graded' && (
                                  <button
                                    onClick={() => { setReportSub(sub); setReportExam(exam) }}
                                    className="bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5"
                                  >
                                    <BarChart3 className="w-3.5 h-3.5" strokeWidth={2} /> View Report
                                  </button>
                                )}
                                {exam.question_paper_url && (
                                  <a
                                    href={`${BACKEND_URL}${exam.question_paper_url}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5"
                                  >
                                    <FileText className="w-3.5 h-3.5" strokeWidth={2} /> View Question Paper
                                  </a>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="mt-3">
                              <p className="text-sm text-rose-500 font-medium">
                                Deadline: {deadline.toLocaleDateString()} {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isPast && ' (Closed)'}
                              </p>
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {exam.question_paper_url && (
                                  <a
                                    href={`${BACKEND_URL}${exam.question_paper_url}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                                  >
                                    <FileText className="w-4 h-4" strokeWidth={2} /> View Question Paper
                                  </a>
                                )}
                                {!isPast && (() => {
                                  const fmt = exam.submission_format || 'upload'
                                  const showUpload = fmt === 'upload' || fmt === 'both'
                                  const showType = fmt === 'typed' || fmt === 'both'
                                  return (
                                    <>
                                      {showUpload && (
                                        <>
                                          <button
                                            onClick={() => { setTypingExamId(null); setUploadingExam(isOpen ? null : exam.id) }}
                                            className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                                          >
                                            <Upload className="w-4 h-4" strokeWidth={2} /> Upload File
                                          </button>
                                          <button
                                            onClick={() => { setUploadingExam(null); setTypingExamId(null); setCameraExamId(exam.id) }}
                                            className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                                          >
                                            <Camera className="w-4 h-4" strokeWidth={2} /> Use Camera
                                          </button>
                                        </>
                                      )}
                                      {showType && (
                                        <button
                                          onClick={() => { setUploadingExam(null); setTypingExamId(isTyping ? null : exam.id) }}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                                        >
                                          <Keyboard className="w-4 h-4" strokeWidth={2} /> Type Answer
                                        </button>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Upload form */}
                          {isOpen && (
                            <div className="mt-4 border border-violet-200 rounded-xl p-4 bg-primary-light">
                              <p className="text-sm text-slate-700 mb-3 font-medium">Upload your scanned answer sheet (PDF, Word doc, or Image)</p>
                              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white" />
                              <button onClick={() => handleSubmit(exam.id)} disabled={submitting}
                                className="mt-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                                {submitting ? 'Submitting...' : 'Submit Answer Sheet'}
                              </button>
                            </div>
                          )}

                          {/* Typed answer form */}
                          {isTyping && (
                            <div className="mt-4 border border-emerald-200 rounded-xl p-4 bg-emerald-50">
                              <p className="text-sm text-slate-700 mb-3 font-medium">Type your answers below. Label each question (e.g. Q1: ...)</p>
                              <textarea value={digitalText} onChange={e => setDigitalText(e.target.value)}
                                rows={6} placeholder={`Q1: (your answer here)\n\nQ2: (your answer here)`}
                                className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                              <button onClick={() => handleSubmit(exam.id, null, digitalText)} disabled={submitting}
                                className="mt-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                                {submitting ? 'Submitting...' : 'Submit Answer'}
                              </button>
                            </div>
                          )}
                        </div>

                        {sub && sub.status === 'graded' && (
                          <div className="text-right ml-6 flex-shrink-0">
                            <span className="text-4xl font-black text-primary">{Math.round(sub.final_score ?? sub.ai_score ?? 0)}</span>
                            <span className="text-slate-400 text-sm">/{exam.total_marks || 100}</span>
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
