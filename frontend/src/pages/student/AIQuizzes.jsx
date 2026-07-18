import { useEffect, useState, useRef } from 'react'
import { PartyPopper, Star, RotateCcw, Play } from 'lucide-react'
import api from '../../api/axios'
import LoadingState from '../../components/LoadingState'
import useBrowserLock from '../../hooks/useBrowserLock'
import SecurityViolationModal from '../../components/SecurityViolationModal'
import { useNotification } from '../../context/NotificationContext'

const DIFF_COLORS = { easy: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', hard: 'bg-rose-100 text-rose-700' }

function QuizLock({ onViolation }) {
  useBrowserLock(onViolation)
  return null
}

export default function AIQuizzes() {
  const { showToast } = useNotification()
  const [quizzes, setQuizzes] = useState([])
  const [attempts, setAttempts] = useState([])
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [selected, setSelected] = useState({})
  const [startTime, setStartTime] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    Promise.all([api.get('/quizzes/'), api.get('/quizzes/my-attempts')])
      .then(([q, a]) => { setQuizzes(q.data); setAttempts(a.data) })
      .finally(() => setLoading(false))
  }, [])

  const startQuiz = (quiz) => {
    try { setQuestions(JSON.parse(quiz.questions)) } catch { setQuestions([]) }
    setActiveQuiz(quiz)
    setSelected({})
    setResult(null)
    setStartTime(Date.now())
    autoSubmittedRef.current = false
  }

  const submitQuiz = async (autoSubmit = false, forceAnswers = null) => {
    setSubmitting(true)
    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    const finalAnswers = forceAnswers || questions.map((_, i) => ({ selected: selected[i] || null }))
    try {
      const res = await api.post(`/quizzes/${activeQuiz.id}/attempt`, { answers: finalAnswers, time_spent_seconds: timeSpent })
      setResult(res.data)
      setAttempts((prev) => [...prev, res.data])
    } catch { 
      if (!autoSubmit) showToast('Failed to submit quiz', 'error')
    }
    finally { setSubmitting(false) }
  }

  const handleCheatingViolation = () => {
    if (!autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      setShowSecurityModal(true)
      // Pass the current state of answers directly to ensure we don't rely on stale closure if any
      submitQuiz(true, questions.map((_, i) => ({ selected: selected[i] || null })))
    }
  }

  const attemptCount = (quizId) => attempts.filter((a) => a.quiz_id === quizId).length
  const bestScore = (quizId) => {
    const scores = attempts.filter((a) => a.quiz_id === quizId && a.score != null).map((a) => a.score)
    return scores.length ? Math.max(...scores) : null
  }

  const totalCompleted = new Set(attempts.map((a) => a.quiz_id)).size
  const avgScore = attempts.filter((a) => a.score != null).reduce((sum, a, _, arr) => sum + a.score / arr.length, 0)
  const totalTime = attempts.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0)

  if (loading) return <LoadingState />

  if (activeQuiz && !result) {
    return (
      <div>
        <QuizLock onViolation={handleCheatingViolation} />
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setActiveQuiz(null)} className="text-slate-500 hover:text-slate-700">← Back</button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{activeQuiz.title}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${DIFF_COLORS[activeQuiz.difficulty]}`}>{activeQuiz.difficulty}</span>
          </div>
        </div>
        <div className="space-y-6">
          {questions.map((q, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <p className="font-semibold text-slate-900 mb-4">Q{i + 1}. {q.question}</p>
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => {
                  const letter = ['A', 'B', 'C', 'D'][oi]
                  return (
                    <button key={oi} onClick={() => setSelected({ ...selected, [i]: letter })}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${selected[i] === letter ? 'border-primary bg-primary-light text-primary-dark' : 'border-slate-200 hover:border-slate-300'}`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => submitQuiz()} disabled={submitting || Object.keys(selected).length < questions.length}
          className="mt-6 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl">
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </button>
        {showSecurityModal && <SecurityViolationModal onClose={() => setShowSecurityModal(false)} />}
      </div>
    )
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <PartyPopper className="w-14 h-14 mx-auto mb-4 text-violet-400" strokeWidth={1.5} />
        <h2 className="text-3xl font-black text-slate-900 mb-2">Quiz Complete!</h2>
        <p className="text-6xl font-black text-primary my-6">{result.score}%</p>
        <p className="text-slate-500 mb-8">Great job completing the quiz!</p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => { setActiveQuiz(null); setResult(null) }} className="bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-dark">Back to Quizzes</button>
          <button onClick={() => startQuiz(activeQuiz)} className="border border-slate-300 text-slate-700 font-semibold px-6 py-3 rounded-xl hover:bg-slate-50">Try Again</button>
        </div>
        {showSecurityModal && <SecurityViolationModal onClose={() => setShowSecurityModal(false)} />}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Quiz</h1>
      <p className="text-slate-500 text-sm mt-1 mb-6">Quizzes assigned by your teacher</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Completed', value: totalCompleted, color: 'text-primary' },
          { label: 'Total Quizzes', value: quizzes.length, color: 'text-sky-600' },
          { label: 'Average Score', value: `${Math.round(avgScore)}%`, color: 'text-emerald-600' },
          { label: 'Time Spent', value: `${Math.round(totalTime / 60)}m`, color: 'text-orange-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {quizzes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <p className="text-slate-400">No quizzes available yet. Quizzes are generated from uploaded exams.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {quizzes.map((quiz) => {
            const count = attemptCount(quiz.id)
            const best = bestScore(quiz.id)
            const qs = (() => { try { return JSON.parse(quiz.questions) } catch { return [] } })()
            return (
              <div key={quiz.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{quiz.title}</h3>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-xs px-2 py-0.5 bg-violet-100 text-primary-dark rounded-full">{quiz.subject}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DIFF_COLORS[quiz.difficulty]}`}>{quiz.difficulty}</span>
                    </div>
                  </div>
                  {best != null && (
                    <div className="text-right">
                      <p className="text-sm text-orange-500 font-bold flex items-center gap-1 justify-end"><Star className="w-3.5 h-3.5 fill-orange-500" strokeWidth={2} /> {best}%</p>
                      <p className="text-xs text-slate-400">Attempt {count}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-4">{qs.length} questions • ~{qs.length * 2} min</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{count > 0 ? `${count} attempt${count > 1 ? 's' : ''}` : 'Not attempted'}</span>
                  <button onClick={() => startQuiz(quiz)} className="bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1">
                    {count > 0 ? <><RotateCcw className="w-3 h-3" strokeWidth={2} /> Retry</> : <><Play className="w-3 h-3" strokeWidth={2} /> Start</>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
