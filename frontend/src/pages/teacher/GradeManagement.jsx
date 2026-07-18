import { useEffect, useState, useRef } from 'react'
import {
  Hash, BookOpen, Monitor, FileCheck2, ClipboardList, Brain,
  Keyboard, Paperclip, Shuffle, ShieldCheck, Image, FileText, ListChecks,
  Pencil, Settings2, Loader2, AlertTriangle, CheckCircle2, XCircle, Flag, Clock,
  Smartphone, Users, UserX,
} from 'lucide-react'

// Mirrors ProctoringOverlay.jsx's WARNING_MESSAGES vocabulary so the teacher
// sees the same violation names the student saw during the exam.
const VIOLATION_LABELS = {
  phone: { icon: Smartphone, label: 'Mobile Phone Detected' },
  book: { icon: BookOpen, label: 'Study Material Detected' },
  multiple_persons: { icon: Users, label: 'Multiple People Detected' },
  face_absent: { icon: UserX, label: 'Left Camera View' },
  tab_switch: { icon: Shuffle, label: 'Tab Switch Detected' },
}
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import ExamBuilder from '../../components/ExamBuilder'
import { useNotification } from '../../context/NotificationContext'
import { getErrorMessage } from '../../utils/getErrorMessage'

const STATUS_STYLE = {
  graded: 'bg-emerald-100 text-emerald-700',
  needs_review: 'bg-orange-100 text-orange-700',
  processing: 'bg-violet-100 text-primary-dark',
  flagged: 'bg-rose-100 text-rose-700',
  pending_review: 'bg-amber-100 text-amber-700',
  terminated: 'bg-rose-100 text-rose-700',
}

export default function GradeManagement() {
  const { showToast } = useNotification()
  const [exams, setExams] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [builderExam, setBuilderExam] = useState(null)
  const [fixingExam, setFixingExam] = useState(null)
  const [reviewSub, setReviewSub] = useState(null)
  const [reviewScreenshots, setReviewScreenshots] = useState([])
  const [reviewEvents, setReviewEvents] = useState([])
  const [overrideScore, setOverrideScore] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const submitReview = async (action) => {
    setReviewing(true)
    try {
      const params = new URLSearchParams({ action })
      if (action === 'override') params.append('final_score', overrideScore)
      if (overrideNote) params.append('teacher_notes', overrideNote)
      const res = await api.post(`/submissions/${reviewSub.id}/teacher-review?${params}`)
      setSubmissions(prev => prev.map(s => s.id === reviewSub.id ? res.data : s))
      setReviewSub(null)
      setOverrideScore('')
      setOverrideNote('')
    } catch (err) {
      showToast(getErrorMessage(err, 'Review failed'), 'error')
    } finally {
      setReviewing(false)
    }
  }

  const autoStructure = async (exam) => {
    setFixingExam(exam.id)
    try {
      await api.post(`/exams/${exam.id}/extract-questions`)
      await api.post(`/exams/${exam.id}/publish-structured`)
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, is_structured: true } : e))
    } catch (err) {
      showToast(getErrorMessage(err, 'Setup failed'), 'error')
    } finally {
      setFixingExam(null)
    }
  }
  const [form, setForm] = useState({
    title: '', subject: '', description: '', total_marks: 100, passing_marks: 50,
    available_from: '', available_until: '', duration_minutes: 60, category: 'online_exam',
    proctoring_enabled: false, submission_format: 'typed',
    quiz_difficulty: 'medium', quiz_topics: '', quiz_num_questions: 8,
  })

  const DEFAULT_FORMAT_BY_CATEGORY = { online_exam: 'typed', physical_exam: 'upload', assignment: 'both' }

  // AI Quiz assessments don't have a real exam window/duration — the backend still
  // requires these fields on the underlying Exam row, so auto-fill harmless defaults
  // instead of asking the teacher to fill in a form that doesn't apply to them.
  const toDatetimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  const aiQuizDefaults = () => {
    const now = new Date()
    const oneYearOut = new Date(now)
    oneYearOut.setFullYear(now.getFullYear() + 1)
    return {
      total_marks: 100, passing_marks: 0, duration_minutes: 0,
      available_from: toDatetimeLocal(now), available_until: toDatetimeLocal(oneYearOut),
    }
  }

  const qpRef = useRef()
  const msRef = useRef()

  useEffect(() => {
    Promise.all([
      api.get('/exams/'),
      api.get('/submissions/teacher/all'),
    ]).then(([e, s]) => {
      setExams(e.data)
      setSubmissions(s.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    setUploading(true)
    try {
      // The "Available From/Until" inputs are <input type="datetime-local">, which yields
      // a plain "YYYY-MM-DDTHH:MM" string with no timezone info — new Date(...) parses that
      // as the browser's own local time, so calling toISOString() on it correctly converts
      // the teacher's intended wall-clock moment into a true, unambiguous UTC instant. Sending
      // the raw local-looking string as-is (previously) let the backend's UTC-based comparisons
      // silently misread it, opening/closing exams hours off from what the teacher set.
      const toUtcIso = (localValue) => localValue ? new Date(localValue).toISOString() : localValue

      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (['proctoring_enabled', 'category', 'quiz_difficulty', 'quiz_topics', 'quiz_num_questions'].includes(k)) return
        fd.append(k, (k === 'available_from' || k === 'available_until') ? toUtcIso(v) : v)
      })

      if (form.category === 'assignment') {
        fd.append('due_date', toUtcIso(form.available_until))
        if (qpRef.current?.files[0]) fd.append('question_paper', qpRef.current.files[0])
        if (msRef.current?.files[0]) fd.append('marking_scheme', msRef.current.files[0])
        await api.post('/assignments/', fd)
        showToast('Assignment created successfully! You can manage it in the Assignments tab.', 'success')
      } else {
        if (form.category === 'online_exam') fd.append('exam_type', 'online')
        else if (form.category === 'physical_exam') fd.append('exam_type', 'physical')
        else fd.append('exam_type', 'ai_quiz_source') // ai_quiz: a lightweight source doc, not a real exam

        if (qpRef.current?.files[0]) fd.append('question_paper', qpRef.current.files[0])
        if (form.category !== 'ai_quiz' && msRef.current?.files[0]) fd.append('marking_scheme', msRef.current.files[0])
        const res = await api.post('/exams/', fd)
        const exam = res.data

        if (form.category === 'online_exam' && form.submission_format !== 'upload') {
          await api.post(`/exams/${exam.id}/extract-questions`)
          await api.post(`/exams/${exam.id}/publish-structured`)
          exam.is_structured = true
          if (form.proctoring_enabled) {
            await api.post(`/exams/${exam.id}/toggle-proctoring`)
            exam.proctoring_enabled = true
          }
        } else if (form.category === 'ai_quiz') {
          const difficulty = form.quiz_difficulty || 'medium'
          const params = new URLSearchParams({ difficulty, num_questions: String(form.quiz_num_questions || 8) })
          if (form.quiz_topics.trim()) params.append('topics', form.quiz_topics.trim())
          await api.post(`/quizzes/generate/${exam.id}?${params}`)
          showToast(`${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} AI quiz generated! Students can find it in AI Quizzes.`, 'success')
        }

        setExams((prev) => [...prev, exam])
      }

      setShowUpload(false)
      setForm({ title: '', subject: '', description: '', total_marks: 100, passing_marks: 50, available_from: '', available_until: '', duration_minutes: 60, category: 'online_exam', proctoring_enabled: false, submission_format: 'typed', quiz_difficulty: 'medium', quiz_topics: '', quiz_num_questions: 8 })
      if (qpRef.current) qpRef.current.value = ''
      if (msRef.current) msRef.current.value = ''
    } catch (err) {
      showToast(getErrorMessage(err, 'Upload failed'), 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {builderExam && (
        <ExamBuilder
          exam={builderExam}
          onClose={() => setBuilderExam(null)}
          onPublished={() => {
            setExams(prev => prev.map(e => e.id === builderExam.id ? { ...e, is_structured: true } : e))
            setBuilderExam(null)
          }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Grade Management</h1>
          <p className="text-slate-500 text-sm mt-1">Upload and manage grades for your assignments</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)}
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow transition">
          + Create Assessment
        </button>
      </div>

      {/* Upload Exam Form */}
      {showUpload && (
        <div className="bg-white border border-violet-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="font-bold font-display text-slate-900 mb-5">Create New Assessment</h3>
          <form onSubmit={handleUpload}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Exam Title *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="e.g. Mathematics Midterm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Subject *</label>
                <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="e.g. Mathematics" />
              </div>
              {form.category !== 'ai_quiz' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Total Marks *</label>
                    <input required type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Passing Marks *</label>
                    <input required type="number" value={form.passing_marks} onChange={(e) => setForm({ ...form, passing_marks: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Available From *</label>
                    <input required type="datetime-local" value={form.available_from} onChange={(e) => setForm({ ...form, available_from: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Available Until *</label>
                    <input required type="datetime-local" value={form.available_until} onChange={(e) => setForm({ ...form, available_until: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>
                </>
              )}
              {form.category !== 'assignment' && form.category !== 'ai_quiz' && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Duration (minutes) *</label>
                  <input required type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Optional description" />
              </div>
            </div>

            {/* Category selection */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Assessment Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { value: 'online_exam', icon: Monitor, label: 'Online Exam', desc: 'In portal' },
                  { value: 'physical_exam', icon: FileCheck2, label: 'Physical Exam', desc: 'Upload answers' },
                  { value: 'assignment', icon: ClipboardList, label: 'Assignment', desc: 'Homework task' },
                  { value: 'ai_quiz', icon: Brain, label: 'AI Quiz', desc: 'Auto-generated quiz' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm({
                      ...form,
                      category: opt.value,
                      submission_format: DEFAULT_FORMAT_BY_CATEGORY[opt.value] || form.submission_format,
                      ...(opt.value === 'ai_quiz' ? aiQuizDefaults() : {}),
                    })}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition ${form.category === opt.value ? 'border-primary bg-primary-light' : 'border-slate-200 hover:border-slate-300'}`}>
                    <opt.icon className={`w-6 h-6 ${form.category === opt.value ? 'text-primary' : 'text-slate-400'}`} strokeWidth={1.75} />
                    <span className={`text-sm font-semibold ${form.category === opt.value ? 'text-primary-dark' : 'text-slate-700'}`}>{opt.label}</span>
                    <span className="text-[10px] text-center leading-tight text-slate-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Answer format selection — how students must submit their answers */}
            {form.category !== 'ai_quiz' && (
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-600 mb-2 block">Answer Format</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'typed', icon: Keyboard, label: 'Type Answers', desc: 'Students type in portal' },
                    { value: 'upload', icon: Paperclip, label: 'Upload File', desc: 'Handwritten PDF / Word doc' },
                    { value: 'both', icon: Shuffle, label: 'Either', desc: 'Student chooses' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm({ ...form, submission_format: opt.value })}
                      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition ${form.submission_format === opt.value ? 'border-primary bg-primary-light' : 'border-slate-200 hover:border-slate-300'}`}>
                      <opt.icon className={`w-6 h-6 ${form.submission_format === opt.value ? 'text-primary' : 'text-slate-400'}`} strokeWidth={1.75} />
                      <span className={`text-sm font-semibold ${form.submission_format === opt.value ? 'text-primary-dark' : 'text-slate-700'}`}>{opt.label}</span>
                      <span className="text-[10px] text-center leading-tight text-slate-400">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Quiz settings — difficulty + topics, in place of exam-only fields */}
            {form.category === 'ai_quiz' && (
              <div className="mb-4 bg-violet-50 border border-violet-200 rounded-xl p-4">
                <label className="text-xs font-medium text-slate-600 mb-2 block">Quiz Difficulty</label>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { value: 'easy', label: 'Easy', color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
                    { value: 'medium', label: 'Medium', color: 'border-amber-400 bg-amber-50 text-amber-700' },
                    { value: 'hard', label: 'Hard', color: 'border-rose-400 bg-rose-50 text-rose-700' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setForm({ ...form, quiz_difficulty: opt.value })}
                      className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition ${form.quiz_difficulty === opt.value ? opt.color : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5 mb-1"><Hash className="w-3.5 h-3.5" strokeWidth={2} /> Number of Questions</label>
                <input
                  type="number" min={1} max={30}
                  value={form.quiz_num_questions}
                  onChange={(e) => setForm({ ...form, quiz_num_questions: e.target.value })}
                  className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                />
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5 mb-1"><BookOpen className="w-3.5 h-3.5" strokeWidth={2} /> Topics for this quiz (optional)</label>
                <p className="text-xs text-slate-500 mb-2">
                  List the specific topics the quiz should cover. Leave blank to generate from the uploaded slides below, or general <strong>{form.subject || 'subject'}</strong> concepts if nothing is uploaded.
                </p>
                <textarea
                  value={form.quiz_topics}
                  onChange={(e) => setForm({ ...form, quiz_topics: e.target.value })}
                  rows={4}
                  placeholder={`e.g.\n• Normalization (1NF, 2NF, 3NF)\n• SQL Joins and subqueries\n• Entity-Relationship diagrams`}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-white"
                />
              </div>
            )}

            {/* Proctoring toggle — only for online exams */}
            {form.category === 'online_exam' && (
              <div className="mb-4 bg-primary-light border border-violet-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" strokeWidth={2} /> AI Proctoring</p>
                  <p className="text-xs text-slate-500 mt-0.5">Live camera monitoring — detects phones, books, multiple people</p>
                </div>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, proctoring_enabled: !f.proctoring_enabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${form.proctoring_enabled ? 'bg-primary' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.proctoring_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}

            {/* File uploads */}
            {form.category === 'ai_quiz' ? (
              <div className="mb-5">
                <div className="border-2 border-dashed border-violet-300 rounded-xl p-5 text-center">
                  <Image className="w-8 h-8 mx-auto mb-2 text-violet-300" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-slate-700">Upload Slides / Source Material (optional)</p>
                  <p className="text-xs text-slate-400 mb-3">PDF, Word doc, JPG, PNG — leave blank to generate purely from the topics above</p>
                  <input ref={qpRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="text-xs w-full" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-slate-700">Upload Question Paper</p>
                  <p className="text-xs text-slate-400 mb-3">PDF, JPG, PNG</p>
                  <input ref={qpRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-xs w-full" />
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center">
                  <ListChecks className="w-8 h-8 mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-slate-700">Upload Marking Scheme</p>
                  <p className="text-xs text-slate-400 mb-3">PDF, JPG, PNG</p>
                  <input ref={msRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-xs w-full" />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={uploading}
                className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg text-sm transition">
                {uploading
                  ? 'Processing...'
                  : 'Create Assessment'}
              </button>
              <button type="button" onClick={() => setShowUpload(false)} className="text-slate-500 hover:text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-100 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Exams list */}
      {!loading && exams.length === 0 && !showUpload && (
        <div className="border-2 border-dashed border-violet-200 rounded-xl p-8 text-center mb-6 bg-primary-light/40">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-violet-200" strokeWidth={1.5} />
          <p className="font-semibold text-slate-700">No exams uploaded yet</p>
          <p className="text-sm text-slate-400 mt-1">Click <strong>+ Add New Exam</strong> above to get started</p>
        </div>
      )}

      {!loading && exams.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Exams</h2>
          <div className="space-y-3">
            {exams.map((exam) => {
              const subCount = submissions.filter((s) => s.exam_id === exam.id).length
              const isPast = new Date(exam.available_until) < new Date()
              return (
                <div key={exam.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-y-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-slate-900 text-sm">{exam.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                        exam.exam_type === 'ai_quiz_source' ? 'bg-violet-100 text-violet-700' :
                        exam.exam_type === 'online' ? 'bg-violet-100 text-violet-700' :
                        exam.exam_type === 'both' ? 'bg-violet-100 text-violet-700' :
                        'bg-violet-100 text-violet-700'
                      }`}>
                        {exam.exam_type === 'ai_quiz_source' ? <><Brain className="w-3 h-3" strokeWidth={2} /> AI Quiz</> :
                         exam.exam_type === 'online' ? <><Monitor className="w-3 h-3" strokeWidth={2} /> Online</> :
                         exam.exam_type === 'both' ? <><Shuffle className="w-3 h-3" strokeWidth={2} /> Both</> :
                         <><FileCheck2 className="w-3 h-3" strokeWidth={2} /> Physical</>}
                      </span>
                      {exam.exam_type !== 'ai_quiz_source' && exam.submission_format && exam.submission_format !== 'both' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 inline-flex items-center gap-1">
                          {exam.submission_format === 'typed' ? <><Keyboard className="w-3 h-3" strokeWidth={2} /> Typed</> : <><Paperclip className="w-3 h-3" strokeWidth={2} /> Upload</>}
                        </span>
                      )}
                      {exam.exam_type !== 'ai_quiz_source' && isPast && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Closed</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {exam.exam_type === 'ai_quiz_source'
                        ? `${exam.subject} · source material for AI-generated quizzes`
                        : <>{exam.subject} · {exam.total_marks} marks · {subCount} submission{subCount !== 1 ? 's' : ''} · Until {new Date(exam.available_until).toLocaleDateString()}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-4 flex-wrap justify-end">
                    {/* Online/Both: auto-structured — show Edit or one-time Setup (not applicable in upload-answer mode) */}
                    {(exam.exam_type === 'online' || exam.exam_type === 'both') && exam.submission_format !== 'upload' && (
                      exam.is_structured
                        ? <button onClick={() => setBuilderExam(exam)}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition inline-flex items-center gap-1">
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} /> Edit Questions
                          </button>
                        : <button onClick={() => autoStructure(exam)} disabled={fixingExam === exam.id}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition disabled:opacity-50 inline-flex items-center gap-1">
                            {fixingExam === exam.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> Setting up...</> : <><Settings2 className="w-3.5 h-3.5" strokeWidth={2} /> Setup Questions</>}
                          </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewSub && (() => {
        let analysis = []
        try { analysis = JSON.parse(reviewSub.question_analysis || '[]') } catch {}
        const exam = exams.find(e => e.id === reviewSub.exam_id)
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setReviewSub(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-primary text-white px-6 py-4 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold font-display text-lg">Review Submission</h2>
                    <p className="text-violet-200 text-sm mt-0.5">{reviewSub.student_name} · {reviewSub.exam_title}</p>
                  </div>
                  <button onClick={() => setReviewSub(null)} className="text-violet-200 hover:text-white text-2xl leading-none transition">×</button>
                </div>
                <div className="flex gap-6 mt-3 text-sm">
                  <span>AI Score: <strong>{Math.round(reviewSub.ai_score ?? 0)}/{reviewSub.total_marks}</strong></span>
                  <span>Type: <strong className="capitalize">{reviewSub.submission_type}</strong></span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Terminated / Cheating banner */}
                {reviewSub.status === 'terminated' && (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-rose-500 flex-shrink-0" strokeWidth={2} />
                    <div>
                      <p className="font-bold text-rose-700">Exam Terminated — Cheating Detected</p>
                      <p className="text-sm text-rose-600 mt-0.5">This student received 3 proctoring violations. Their exam access has been permanently revoked.</p>
                    </div>
                  </div>
                )}

                {/* Violation breakdown — what was actually detected, in plain words */}
                {reviewEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide mb-2">Violations Detected ({reviewEvents.length})</p>
                    <div className="space-y-1.5">
                      {reviewEvents.map((ev) => {
                        const info = VIOLATION_LABELS[ev.event_type] || { icon: AlertTriangle, label: ev.event_type }
                        const EvIcon = info.icon
                        return (
                          <div key={ev.id} className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                            <EvIcon className="w-4 h-4 text-rose-500 flex-shrink-0" strokeWidth={2} />
                            <span className="text-sm text-rose-700 font-medium">{info.label}</span>
                            <span className="text-xs text-slate-400 ml-auto">{new Date(ev.detected_at).toLocaleTimeString()}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Violation screenshots */}
                {reviewScreenshots.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide mb-2">Violation Screenshots ({reviewScreenshots.length})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {reviewScreenshots.map((url, i) => (
                        <img key={i} src={`http://localhost:8000${url}`} alt={`Violation ${i+1}`}
                          className="w-full rounded-lg border border-rose-200 object-cover" style={{height:'120px'}} />
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Overall Feedback */}
                <div className="bg-primary-light border border-violet-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">AI Overall Feedback</p>
                  <p className="text-sm text-slate-700">{reviewSub.ai_feedback || 'No feedback.'}</p>
                </div>

                {/* Per-question breakdown with justification */}
                {analysis.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Question-by-Question Breakdown</p>
                    <div className="space-y-3">
                      {analysis.map((q) => (
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

                {/* Override score input */}
                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Override Score (optional)</p>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0">
                      <label className="text-xs text-slate-500 block mb-1">Final Score</label>
                      <input
                        type="number" min={0} max={reviewSub.total_marks}
                        value={overrideScore}
                        onChange={e => setOverrideScore(e.target.value)}
                        placeholder={String(Math.round(reviewSub.ai_score ?? 0))}
                        className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <p className="text-xs text-slate-400 mt-1">out of {reviewSub.total_marks}</p>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-1">Note to Student (optional)</label>
                      <textarea
                        value={overrideNote}
                        onChange={e => setOverrideNote(e.target.value)}
                        rows={2}
                        placeholder="e.g. Marks adjusted after manual review..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                <button onClick={() => setReviewSub(null)}
                  className="border border-slate-300 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-100 transition">
                  Cancel
                </button>
                {overrideScore !== '' && Number(overrideScore) !== Math.round(reviewSub.ai_score ?? 0) ? (
                  <button onClick={() => submitReview('override')} disabled={reviewing || !overrideScore}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition">
                    {reviewing ? 'Saving...' : <><Pencil className="w-4 h-4" strokeWidth={2} /> Override & Approve ({overrideScore}/{reviewSub.total_marks})</>}
                  </button>
                ) : (
                  <button onClick={() => submitReview('approve')} disabled={reviewing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition">
                    {reviewing ? 'Approving...' : <><CheckCircle2 className="w-4 h-4" strokeWidth={2} /> Approve AI Score ({Math.round(reviewSub.ai_score ?? 0)}/{reviewSub.total_marks})</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pending Review — requires teacher action */}
      {submissions.filter(s => ['pending_review','flagged','terminated'].includes(s.status)).length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Pending Your Review</h2>
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {submissions.filter(s => ['pending_review','flagged','terminated'].includes(s.status)).length}
            </span>
          </div>
          <div className="space-y-3">
            {submissions.filter(s => ['pending_review','flagged','terminated'].includes(s.status)).map(s => (
              <div key={s.id} className={`bg-white border-2 rounded-xl px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-y-2 ${s.status === 'terminated' ? 'border-rose-300' : 'border-amber-200'}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900 text-sm">{s.student_name || `Student #${s.student_id}`}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                      s.status === 'terminated' ? 'bg-rose-100 text-rose-700' :
                      s.status === 'flagged' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {s.status === 'terminated' ? <><AlertTriangle className="w-3 h-3" strokeWidth={2} /> Cheating — Terminated</> :
                       s.status === 'flagged' ? <><Flag className="w-3 h-3" strokeWidth={2} /> Flagged</> :
                       <><Clock className="w-3 h-3" strokeWidth={2} /> Pending Review</>}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{s.exam_title} · AI Score: <strong className="text-primary">{Math.round(s.ai_score ?? 0)}/{s.total_marks}</strong></p>
                </div>
                <button onClick={async () => {
                    setReviewSub(s); setOverrideScore(''); setOverrideNote('')
                    try {
                      const r = await api.get(`/proctoring/screenshots/${s.id}`)
                      setReviewScreenshots(r.data.screenshots || [])
                    } catch { setReviewScreenshots([]) }
                    try {
                      const r = await api.get(`/proctoring/events/${s.id}`)
                      setReviewEvents(r.data || [])
                    } catch { setReviewEvents([]) }
                  }}
                  className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                  Review & Approve →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submissions table */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Student Submissions</h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Student Name', 'Exam', 'AI Score', 'Feedback', 'Status'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingState.Row colSpan={5} />
            ) : submissions.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">No submissions yet</td></tr>
            ) : submissions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4 text-sm font-medium text-slate-900">{s.student_name || `Student #${s.student_id}`}</td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  <div>{s.exam_title}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-flex items-center gap-1 ${
                    s.submission_type === 'text' ? 'bg-violet-100 text-violet-700' : 'bg-violet-100 text-violet-700'
                  }`}>
                    {s.submission_type === 'text' ? <><Monitor className="w-3 h-3" strokeWidth={2} /> Online</> : <><FileText className="w-3 h-3" strokeWidth={2} /> Upload</>}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-primary">
                  {s.ai_score != null ? `${Math.round(s.ai_score)}/${s.total_marks || 100}` : '--'}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 max-w-[220px] truncate">{s.ai_feedback || 'AI analysis in progress...'}</td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-600'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
