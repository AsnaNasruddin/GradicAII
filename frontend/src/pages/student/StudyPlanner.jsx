import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Sparkles, BookOpen, Target, Clock, Calendar, AlertTriangle, Trophy, ThumbsUp,
  RotateCcw, ClipboardList, Pencil, X, Lightbulb, Brain, Timer,
} from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import { useNotification } from '../../context/NotificationContext'
import { getErrorMessage } from '../../utils/getErrorMessage'

const TAG_COLORS = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

const BORDER_COLORS = [
  'border-l-violet-400',
  'border-l-sky-400',
  'border-l-emerald-400',
  'border-l-orange-400',
  'border-l-pink-400',
  'border-l-teal-400',
]

const SUBJECT_SUGGESTIONS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'English Literature', 'History', 'Geography', 'Economics', 'Accounting',
  'Statistics', 'Calculus', 'Database Systems', 'Algorithms', 'Networking',
  'Psychology', 'Sociology', 'Political Science', 'Philosophy', 'Art',
]

const EXAM_PRESSURE_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'No exams soon', color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { value: 'medium', label: 'Medium', desc: 'Exams in a few weeks', color: 'border-amber-400 bg-amber-50 text-amber-700' },
  { value: 'high', label: 'High', desc: 'Exams very soon!', color: 'border-rose-400 bg-rose-50 text-rose-700' },
]

// ─── Enrollment / Generate Modal ───────────────────────────────────────────
function EnrollmentModal({ onClose, onGenerate, generating }) {
  const [step, setStep] = useState(1) // 1 = subjects, 2 = preferences
  const [subjects, setSubjects] = useState([])
  const [subjectInput, setSubjectInput] = useState('')
  const [goals, setGoals] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState(2)
  const [examPressure, setExamPressure] = useState('medium')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSuggestions = SUBJECT_SUGGESTIONS.filter(
    s => s.toLowerCase().includes(subjectInput.toLowerCase()) && !subjects.includes(s)
  )

  const addSubject = (name) => {
    const trimmed = name.trim()
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects(prev => [...prev, trimmed])
    }
    setSubjectInput('')
    setShowSuggestions(false)
  }

  const removeSubject = (s) => setSubjects(prev => prev.filter(x => x !== s))

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && subjectInput.trim()) {
      e.preventDefault()
      addSubject(subjectInput)
    }
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  const handleGenerate = () => {
    onGenerate({ subjects, goals, hours_per_day: hoursPerDay, exam_pressure: examPressure })
  }

  const subjectColors = [
    'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-violet-100 text-violet-800 border-violet-200',
    'bg-rose-100 text-rose-800 border-rose-200',
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold font-display flex items-center gap-2"><Sparkles className="w-5 h-5" strokeWidth={2} /> AI Study Plan Generator</h2>
              <p className="text-violet-200 text-sm mt-0.5">
                {step === 1 ? 'Step 1 of 2 — Tell us your subjects' : 'Step 2 of 2 — Your study preferences'}
              </p>
            </div>
            <button onClick={onClose} className="text-violet-200 hover:text-white text-2xl leading-none">×</button>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <>
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <BookOpen className="w-4 h-4 text-slate-400" strokeWidth={2} /> Which subjects are you enrolled in?
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Type a subject name and press <kbd className="bg-slate-100 border border-slate-300 rounded px-1 text-xs">Enter</kbd> to add it, or pick from suggestions below.
              </p>

              {/* Subject tags */}
              {subjects.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {subjects.map((s, i) => (
                    <span
                      key={s}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${subjectColors[i % subjectColors.length]}`}
                    >
                      {s}
                      <button
                        onClick={() => removeSubject(s)}
                        className="hover:opacity-70 font-bold text-base leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Input with autocomplete */}
              <div className="relative">
                <input
                  value={subjectInput}
                  onChange={e => { setSubjectInput(e.target.value); setShowSuggestions(true) }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="e.g. Database Systems"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 z-10 max-h-48 overflow-y-auto">
                    {filteredSuggestions.map(s => (
                      <button
                        key={s}
                        onMouseDown={() => addSubject(s)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-light hover:text-primary-dark transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {subjectInput.trim() && (
                <button
                  onClick={() => addSubject(subjectInput)}
                  className="mt-2 text-xs text-primary hover:text-violet-800 font-medium"
                >
                  + Add "{subjectInput.trim()}"
                </button>
              )}

              <div className="mt-4">
                <p className="text-xs text-slate-400 mb-2">Quick add:</p>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_SUGGESTIONS.slice(0, 8).filter(s => !subjects.includes(s)).map(s => (
                    <button
                      key={s}
                      onClick={() => addSubject(s)}
                      className="text-xs px-3 py-1.5 border border-slate-200 rounded-full hover:border-violet-400 hover:bg-primary-light hover:text-primary-dark transition"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={subjects.length === 0}
                  className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Goals */}
              <div className="mb-5">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <Target className="w-4 h-4 text-slate-400" strokeWidth={2} /> What are your study goals? <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={goals}
                  onChange={e => setGoals(e.target.value)}
                  rows={3}
                  placeholder="e.g. Prepare for finals, improve weak areas in Database Systems, target 80%+ in all subjects..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                />
              </div>

              {/* Hours per day */}
              <div className="mb-5">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
                  <Clock className="w-4 h-4 text-slate-400" strokeWidth={2} /> How many hours can you study per day?
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={hoursPerDay}
                    onChange={e => setHoursPerDay(Number(e.target.value))}
                    className="flex-1 accent-violet-600"
                  />
                  <span className="text-2xl font-black text-primary w-16 text-center">{hoursPerDay}h</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1 hr</span><span>4 hrs</span><span>8 hrs</span>
                </div>
              </div>

              {/* Exam pressure */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
                  <Calendar className="w-4 h-4 text-slate-400" strokeWidth={2} /> How is your exam pressure right now?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {EXAM_PRESSURE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setExamPressure(opt.value)}
                      className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition ${
                        examPressure === opt.value ? opt.color + ' border-current' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-lg font-bold">{opt.label}</span>
                      <span className="text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected subjects summary */}
              <div className="bg-primary-light border border-violet-100 rounded-xl p-4 mb-5">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Your Enrolled Subjects</p>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s, i) => (
                    <span key={s} className={`text-xs px-2.5 py-1 rounded-full font-medium ${subjectColors[i % subjectColors.length]}`}>{s}</span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  ← Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
                >
                  <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" strokeWidth={2} /> {generating ? 'Generating...' : 'Generate My Plan'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Session Modal ──────────────────────────────────────────────────────
function AddSessionModal({ onClose, onAdd, enrolledSubjects }) {
  const { showToast } = useNotification()
  const [form, setForm] = useState({
    topic: '', subject: enrolledSubjects[0] || '', scheduled_date: '', duration_minutes: 60, tags: ''
  })
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!form.topic.trim() || !form.subject.trim() || !form.scheduled_date) {
      showToast('Please fill in topic, subject, and date.', 'error')
      return
    }
    setAdding(true)
    try {
      await onAdd({
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        duration_minutes: Number(form.duration_minutes),
      })
      onClose()
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to add session'), 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-6 py-5 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-lg font-bold font-display">+ Add Study Session</h2>
          <button onClick={onClose} className="text-violet-200 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Topic *</label>
            <input
              value={form.topic}
              onChange={e => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g. SQL Joins and Subqueries"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Subject *</label>
            {enrolledSubjects.length > 0 ? (
              <select
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {enrolledSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="">Other (type below)</option>
              </select>
            ) : (
              <input
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Mathematics"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            )}
          </div>
          {enrolledSubjects.length > 0 && form.subject === '' && (
            <input
              placeholder="Enter subject name"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              onChange={e => setForm({ ...form, subject: e.target.value })}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.scheduled_date}
                onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Duration (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                min={15}
                max={300}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Activities (comma-separated)</label>
            <input
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              placeholder="Practice Problems, Review Notes, Quiz"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              {adding ? 'Adding...' : '+ Add Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Viewer Modal ──────────────────────────────────────────────────
function ActivityViewerModal({ onClose, topic, subject, activityType }) {
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState(null)
  const [error, setError] = useState(null)
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await api.post('/study-planner/generate-content', {
          topic, subject, activity_type: activityType
        })
        setContent(res.data)
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to generate content'))
      } finally {
        setLoading(false)
      }
    }
    fetchContent()
  }, [topic, subject, activityType])

  const nextCard = () => {
    setFlipped(false)
    setTimeout(() => {
      setFlashcardIndex(prev => Math.min(prev + 1, content.content.length - 1))
    }, 150)
  }

  const prevCard = () => {
    setFlipped(false)
    setTimeout(() => {
      setFlashcardIndex(prev => Math.max(prev - 1, 0))
    }, 150)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold font-display">{activityType}</h2>
            <p className="text-violet-200 text-sm">{topic} · {subject}</p>
          </div>
          <button onClick={onClose} className="text-violet-200 hover:text-white text-3xl leading-none">×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="animate-spin w-10 h-10 text-primary mb-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-slate-600 font-medium animate-pulse">Generating your personalized study material...</p>
              <p className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1">Powered by AI <Sparkles className="w-3 h-3" strokeWidth={2} /></p>
            </div>
          ) : error ? (
            <div className="text-center h-64 flex flex-col items-center justify-center">
              <p className="text-rose-500 font-medium mb-4">{error}</p>
              <button onClick={onClose} className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100">Close</button>
            </div>
          ) : content?.type === 'flashcards' && !content.content?.length ? (
            <div className="text-center h-64 flex flex-col items-center justify-center">
              <p className="text-slate-400 font-medium mb-4">No flashcards were generated for this topic.</p>
              <button onClick={onClose} className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100">Close</button>
            </div>
          ) : content?.type === 'flashcards' ? (
            <div className="flex flex-col items-center max-w-md mx-auto w-full py-4">
              <div
                onClick={() => setFlipped(!flipped)}
                className="w-full aspect-[4/3] relative cursor-pointer group perspective-1000"
              >
                <div className={`w-full h-full transition-all duration-500 transform-style-preserve-3d relative ${flipped ? 'rotate-y-180' : ''}`}>
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden bg-white border-2 border-violet-100 rounded-2xl shadow-md flex flex-col items-center justify-center p-8 text-center">
                    <span className="absolute top-4 right-4 text-xs font-bold text-violet-300 uppercase tracking-widest">Question</span>
                    <h3 className="text-xl font-bold font-display text-slate-800">{content.content[flashcardIndex].front}</h3>
                    <p className="absolute bottom-4 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to flip</p>
                  </div>
                  {/* Back */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180 bg-primary-light border-2 border-violet-200 rounded-2xl shadow-md flex flex-col items-center justify-center p-8 text-center">
                    <span className="absolute top-4 right-4 text-xs font-bold text-violet-400 uppercase tracking-widest">Answer</span>
                    <p className="text-lg text-slate-700 font-medium">{content.content[flashcardIndex].back}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between w-full mt-6">
                <button
                  onClick={prevCard}
                  disabled={flashcardIndex === 0}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 disabled:opacity-30 hover:bg-white"
                >
                  ← Prev
                </button>
                <span className="text-sm font-bold text-slate-400">{flashcardIndex + 1} / {content.content.length}</span>
                <button
                  onClick={nextCard}
                  disabled={flashcardIndex === content.content.length - 1}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-30 hover:bg-primary-dark shadow-sm"
                >
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm prose prose-violet max-w-none text-sm sm:text-base">
              <ReactMarkdown>{content.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Inline AI Quiz Modal ────────────────────────────────────────────────────
function InlineQuizModal({ onClose, topic, subject }) {
  const [phase, setPhase] = useState('loading') // loading | quiz | result | error
  const [questions, setQuestions] = useState([])
  const [selected, setSelected] = useState({})
  const [score, setScore] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const generate = async () => {
      try {
        const res = await api.post('/study-planner/generate-content', {
          topic,
          subject,
          activity_type: 'quiz_inline'
        })
        const data = res.data
        if (data.type === 'error') throw new Error(data.content)
        if (data.type === 'quiz' && Array.isArray(data.content)) {
          setQuestions(data.content)
          setPhase('quiz')
        } else {
          throw new Error('Unexpected response from server')
        }
      } catch (e) {
        setErrorMsg(getErrorMessage(e, e.message || 'Failed to generate quiz'))
        setPhase('error')
      }
    }
    generate()
  }, [topic, subject])

  const submitQuiz = () => {
    let correct = 0
    questions.forEach((q, i) => {
      if (selected[i] === q.answer) correct++
    })
    setScore(Math.round((correct / questions.length) * 100))
    setPhase('result')
  }

  const retry = () => {
    setSelected({})
    setScore(null)
    setPhase('quiz')
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold font-display flex items-center gap-2"><Sparkles className="w-4 h-4" strokeWidth={2} /> AI Practice Quiz</h2>
            <p className="text-violet-200 text-sm">{topic} · {subject}</p>
          </div>
          <button onClick={onClose} className="text-violet-200 hover:text-white text-3xl leading-none">×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg className="animate-spin w-10 h-10 text-primary mb-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-slate-600 font-medium animate-pulse">Generating quiz questions...</p>
              <p className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1">Powered by AI <Sparkles className="w-3 h-3" strokeWidth={2} /></p>
            </div>
          )}

          {phase === 'error' && (
            <div className="text-center h-64 flex flex-col items-center justify-center">
              <AlertTriangle className="w-10 h-10 mb-3 text-rose-400" strokeWidth={1.5} />
              <p className="text-rose-500 font-medium mb-4">{errorMsg}</p>
              <button onClick={onClose} className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100">Close</button>
            </div>
          )}

          {phase === 'quiz' && (
            <div className="space-y-5">
              {questions.map((q, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <p className="font-semibold text-slate-900 mb-3">Q{i + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {(q.options || []).map((opt, oi) => {
                      const letter = ['A', 'B', 'C', 'D'][oi]
                      return (
                        <button
                          key={oi}
                          onClick={() => setSelected(prev => ({ ...prev, [i]: letter }))}
                          className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${
                            selected[i] === letter
                              ? 'border-violet-500 bg-primary-light text-primary-dark font-medium'
                              : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/40'
                          }`}
                        >
                          <span className="font-bold mr-2">{letter}.</span>{opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={submitQuiz}
                disabled={Object.keys(selected).length < questions.length}
                className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm mt-2"
              >
                Submit Quiz
              </button>
            </div>
          )}

          {phase === 'result' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-4">
                {score >= 80 ? <Trophy className="w-14 h-14 text-amber-400" strokeWidth={1.5} /> :
                 score >= 60 ? <ThumbsUp className="w-14 h-14 text-violet-400" strokeWidth={1.5} /> :
                 <BookOpen className="w-14 h-14 text-slate-300" strokeWidth={1.5} />}
              </div>
              <h3 className="text-2xl font-black font-display text-slate-900 mb-1">Quiz Complete!</h3>
              <p className={`text-5xl font-black my-4 ${
                score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-rose-500'
              }`}>{score}%</p>
              <p className="text-slate-500 text-sm mb-6">
                {score >= 80 ? 'Excellent work! You have a strong grasp of this topic.' :
                  score >= 60 ? 'Good effort! Review the questions you missed.' :
                  'Keep studying! Try reviewing the material and attempt again.'}
              </p>
              <div className="flex gap-3">
                <button onClick={retry} className="border border-slate-300 text-slate-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-slate-50 text-sm flex items-center gap-1.5"><RotateCcw className="w-4 h-4" strokeWidth={2} /> Try Again</button>
                <button onClick={onClose} className="bg-primary text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-dark text-sm">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main StudyPlanner Component ────────────────────────────────────────────
export default function StudyPlanner() {
  const { showToast } = useNotification()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [enrolledSubjects, setEnrolledSubjects] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [deletingId, setDeletingId] = useState(null)
  const [activeActivity, setActiveActivity] = useState(null) // { topic, subject, activityType }
  const [activeQuiz, setActiveQuiz] = useState(null) // { topic, subject }

  const handleTagClick = (tag, topic, subject) => {
    const t = tag.toLowerCase()
    if (t.includes('video lecture')) {
      // Video Lecture not supported — do nothing
      return
    } else if (t.includes('quiz') || t.includes('practice problem') || t.includes('mock test')) {
      setActiveQuiz({ topic, subject })
    } else {
      setActiveActivity({ topic, subject, activityType: tag })
    }
  }

  const load = () =>
    api.get('/study-planner/')
      .then(r => setSessions(r.data))
      .catch((err) => showToast(getErrorMessage(err, 'Failed to load study sessions'), 'error'))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  // Derive enrolled subjects from sessions history (persisted in localStorage too)
  useEffect(() => {
    const stored = localStorage.getItem('enrolledSubjects')
    if (stored) {
      try { setEnrolledSubjects(JSON.parse(stored)) } catch {}
    }
  }, [])

  const handleGenerate = async ({ subjects, goals, hours_per_day, exam_pressure }) => {
    setGenerating(true)
    setShowEnrollModal(false)
    // Persist enrolled subjects
    setEnrolledSubjects(subjects)
    localStorage.setItem('enrolledSubjects', JSON.stringify(subjects))
    try {
      const res = await api.post('/study-planner/generate', { subjects, goals, hours_per_day, exam_pressure })
      setSessions(prev => [...prev.filter(s => !s.is_ai_generated), ...res.data])
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to generate plan'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleAddSession = async (sessionData) => {
    const res = await api.post('/study-planner/', sessionData)
    setSessions(prev => [...prev, res.data])
  }

  const deleteSession = async (id) => {
    setDeletingId(id)
    try {
      await api.delete(`/study-planner/${id}`)
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete session'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const parseTags = (tags) => { try { return JSON.parse(tags || '[]') } catch { return [] } }

  // All unique subjects across sessions
  const sessionSubjects = [...new Set(sessions.map(s => s.subject).filter(Boolean))]
  const allSubjects = [...new Set([...enrolledSubjects, ...sessionSubjects])]

  // Filter sessions
  const filteredSessions = activeFilter === 'all'
    ? sessions
    : sessions.filter(s => s.subject === activeFilter)

  const aiSessions = sessions.filter(s => s.is_ai_generated)
  const manualSessions = sessions.filter(s => !s.is_ai_generated)
  const totalHours = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

  if (loading) return <LoadingState />

  return (
    <div>
      {/* Modals */}
      {showEnrollModal && (
        <EnrollmentModal
          onClose={() => setShowEnrollModal(false)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}
      {showAddModal && (
        <AddSessionModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddSession}
          enrolledSubjects={allSubjects}
        />
      )}
      {activeActivity && (
        <ActivityViewerModal
          onClose={() => setActiveActivity(null)}
          topic={activeActivity.topic}
          subject={activeActivity.subject}
          activityType={activeActivity.activityType}
        />
      )}
      {activeQuiz && (
        <InlineQuizModal
          onClose={() => setActiveQuiz(null)}
          topic={activeQuiz.topic}
          subject={activeQuiz.subject}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Study Planner</h1>
          <p className="text-slate-500 text-sm mt-1">AI-personalized study schedule tailored to your subjects</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowEnrollModal(true)}
            disabled={generating}
            className="bg-violet-100 hover:bg-violet-200 text-primary-dark font-medium px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Generating...
              </>
            ) : <><Sparkles className="w-4 h-4" strokeWidth={2} /> AI Generate Plan</>}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-primary-dark text-white font-medium px-4 py-2 rounded-lg text-sm transition flex items-center gap-1.5"
          >
            + Add Session
          </button>
        </div>
      </div>

      {/* Stats row */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Sessions', value: sessions.length, color: 'text-primary', icon: ClipboardList },
            { label: 'AI Generated', value: aiSessions.length, color: 'text-violet-500', icon: Sparkles },
            { label: 'Manual Added', value: manualSessions.length, color: 'text-primary', icon: Pencil },
            { label: 'Total Hours', value: `${Math.round(totalHours / 60 * 10) / 10}h`, color: 'text-emerald-600', icon: Clock },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Subject filter tabs */}
      {sessions.length > 0 && allSubjects.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              activeFilter === 'all'
                ? 'bg-primary text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300'
            }`}
          >
            All
          </button>
          {allSubjects.map(subj => (
            <button
              key={subj}
              onClick={() => setActiveFilter(subj)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                activeFilter === subj
                  ? 'bg-primary text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      )}

      {/* Schedule list */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-[18px] h-[18px] text-slate-400" strokeWidth={2} />
            <h3 className="font-bold font-display text-slate-900">Your Study Schedule</h3>
          </div>
          {sessions.length > 0 && (
            <span className="text-xs text-slate-400">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
              {activeFilter !== 'all' ? ` in ${activeFilter}` : ''}
            </span>
          )}
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-200" strokeWidth={1.5} />
            <p className="text-slate-600 font-semibold">No study sessions yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Click <strong className="inline-flex items-center gap-1 align-middle"><Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> AI Generate Plan</strong> to create a personalized schedule
            </p>
            <div>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="mt-4 bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-dark inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" strokeWidth={2} /> Generate My Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((s, i) => {
              const tags = parseTags(s.tags)
              const sessionDate = new Date(s.scheduled_date)
              const isToday = sessionDate.toDateString() === new Date().toDateString()
              const isPast = sessionDate < new Date()

              return (
                <div
                  key={s.id}
                  className={`border-l-4 ${BORDER_COLORS[i % BORDER_COLORS.length]} bg-slate-50 rounded-r-xl px-5 py-4 transition ${isPast ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold font-display text-slate-900">{s.topic}</h4>
                        {s.is_ai_generated && (
                          <span className="text-xs bg-violet-100 text-primary px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1"><Sparkles className="w-3 h-3" strokeWidth={2} /> AI</span>
                        )}
                        {isToday && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Today</span>
                        )}
                        {isPast && !isToday && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Past</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 font-medium">{s.subject}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">
                          {sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' '}
                          {sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {tags.filter(t => !t.toLowerCase().includes('video lecture')).map((t, ti) => (
                            <button
                              key={ti}
                              onClick={() => handleTagClick(t, s.topic, s.subject)}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-transform hover:scale-105 hover:brightness-95 shadow-sm active:scale-95 ${TAG_COLORS[ti % TAG_COLORS.length]}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <span className="text-sm text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" strokeWidth={2} /> {s.duration_minutes >= 60
                          ? `${Math.round(s.duration_minutes / 60 * 10) / 10}h`
                          : `${s.duration_minutes}m`}
                      </span>
                      <button
                        onClick={() => deleteSession(s.id)}
                        disabled={deletingId === s.id}
                        className="text-slate-300 hover:text-rose-500 leading-none disabled:opacity-50 transition"
                        title="Delete session"
                      >
                        {deletingId === s.id ? '...' : <X className="w-4 h-4" strokeWidth={2} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* AI Recommendations — dynamic based on enrolled subjects */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-bold font-display text-slate-900 mb-4 flex items-center gap-2"><Lightbulb className="w-[18px] h-[18px] text-amber-400" strokeWidth={2} /> AI Study Recommendations</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              icon: Target,
              title: 'Focus on Weak Areas',
              desc: allSubjects.length > 0
                ? `Prioritize more study time for your enrolled subjects with the lowest scores.`
                : 'Generate an AI plan and we\'ll identify which areas need the most attention.',
            },
            {
              icon: Calendar,
              title: 'Spaced Repetition',
              desc: 'Spacing out study sessions across the week improves long-term retention by up to 40%.',
            },
            {
              icon: Brain,
              title: 'Active Recall',
              desc: 'Use AI Quizzes to test yourself after each study session — retrieval practice beats re-reading.',
            },
            {
              icon: Timer,
              title: 'Pomodoro Technique',
              desc: 'Study in 25-minute focused blocks with 5-minute breaks to maximize concentration.',
            },
          ].map(r => (
            <div key={r.title} className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <r.icon className="w-4 h-4 text-slate-400" strokeWidth={2} />
                <h4 className="font-semibold font-display text-slate-900 text-sm">{r.title}</h4>
              </div>
              <p className="text-xs text-slate-500">{r.desc}</p>
            </div>
          ))}
        </div>

        {enrolledSubjects.length > 0 && (
          <div className="mt-4 bg-primary-light border border-violet-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Your Enrolled Subjects</p>
            <div className="flex flex-wrap gap-2">
              {enrolledSubjects.map((s, i) => (
                <span key={s} className={`text-xs px-3 py-1 rounded-full font-medium ${TAG_COLORS[i % TAG_COLORS.length]}`}>{s}</span>
              ))}
            </div>
            <button
              onClick={() => setShowEnrollModal(true)}
              className="mt-3 text-xs text-primary hover:text-violet-800 font-semibold inline-flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" strokeWidth={2} /> Update subjects & regenerate plan
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
