import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X, CheckCircle2, Mic } from 'lucide-react'
import api from '../api/axios'
import ProctoringOverlay from './ProctoringOverlay'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../utils/getErrorMessage'
import useBrowserLock from '../hooks/useBrowserLock'
import SecurityViolationModal from './SecurityViolationModal'
import { useNotification } from '../context/NotificationContext'

function formatTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

// Voice-to-text hook using Web Speech API
function useVoiceInput(onResult) {
  const recogRef = useRef(null)
  const [listening, setListening] = useState(false)
  const { showToast } = useNotification()

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { showToast('Voice input not supported in this browser.', 'info'); return }
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'
    r.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(res => res[0].transcript).join('')
      onResult(transcript)
    }
    r.onerror = () => { setListening(false) }
    r.onend = () => { setListening(false) }
    r.start()
    recogRef.current = r
    setListening(true)
  }

  const stop = () => {
    recogRef.current?.stop()
    setListening(false)
  }

  return { listening, start, stop }
}

function MCQQuestion({ q, opts, answer, onChange }) {
  return (
    <div className="space-y-2 mt-3">
      {opts.map((opt, i) => {
        const letter = ['A', 'B', 'C', 'D'][i]
        const selected = answer?.selected_option === letter
        return (
          <button key={i} onClick={() => onChange({ selected_option: letter })}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition ${
              selected ? 'border-primary bg-primary-light text-violet-800 font-medium' : 'border-slate-200 hover:border-slate-300 text-slate-700'
            }`}>
            <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold mr-3 ${
              selected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
            }`}>{letter}</span>
            {opt.replace(/^[A-D]\)\s*/, '')}
          </button>
        )
      })}
    </div>
  )
}

function OpenQuestion({ q, answer, onChange, rows = 4 }) {
  const [isVoice, setIsVoice] = useState(false)
  const { listening, start, stop } = useVoiceInput((text) => {
    onChange({ answer_text: text, is_voice_answer: true })
    setIsVoice(true)
  })

  return (
    <div className="mt-3">
      <div className="relative">
        <textarea
          value={answer?.answer_text || ''}
          onChange={e => { onChange({ answer_text: e.target.value, is_voice_answer: false }); setIsVoice(false) }}
          rows={rows}
          placeholder="Type your answer here..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none pr-12"
        />
        <button
          onMouseDown={start}
          onMouseUp={stop}
          onTouchStart={start}
          onTouchEnd={stop}
          title="Hold to speak"
          className={`absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${
            listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
          }`}>
          <Mic className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
      {isVoice && <p className="text-xs text-violet-500 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Voice input recorded</p>}
      {listening && <p className="text-xs text-rose-500 mt-1 animate-pulse">● Recording... Release to stop</p>}
    </div>
  )
}

export default function StructuredExam({ exam, onClose, onSubmit, submitting }) {
  const { user } = useAuth()
  const { showToast } = useNotification()
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})  // question_id → {answer_text, selected_option, is_voice_answer}
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState((exam.duration_minutes || 60) * 60)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [terminated, setTerminated] = useState(false)
  const timerRef = useRef(null)
  const proctoringKey = useRef(`proctor_${exam.id}_${Date.now()}`)
  const answersRef = useRef(answers)
  const autoRef = useRef(false)
  answersRef.current = answers

  useEffect(() => {
    api.get(`/exams/${exam.id}/questions`).then(r => setQuestions(r.data)).finally(() => setLoading(false))
  }, [exam.id])

  useBrowserLock(() => {
    if (!autoRef.current) {
      autoRef.current = true
      setShowSecurityModal(true)
      handleSubmit(true)
    }
  })

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          if (!autoRef.current) { autoRef.current = true; handleSubmit(true) }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const setAnswer = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...(prev[qId] || {}), ...val } }))
  }

  const answered = Object.keys(answers).filter(k => {
    const a = answers[k]
    return (a.answer_text?.trim() || a.selected_option)
  }).length

  const handleSubmit = async (auto = false) => {
    clearInterval(timerRef.current)
    const payload = {
      exam_id: exam.id,
      answers: questions.map(q => ({
        question_id: q.id,
        answer_text: answers[q.id]?.answer_text || null,
        selected_option: answers[q.id]?.selected_option || null,
        is_voice_answer: answers[q.id]?.is_voice_answer || false,
      })),
    }
    try {
      const res = await api.post('/submissions/structured', payload)
      onSubmit(res.data, auto)
    } catch (err) {
      // Always surface this, even on an auto-submit (timeout/violation) — silently
      // swallowing it here left the exam screen stuck open with a dead timer and
      // no indication anything went wrong, unlike the equivalent OnlineExam flow.
      showToast(getErrorMessage(err, 'Submission failed — please try Submit again.'), 'error')
    }
  }

  const isLow = timeLeft <= 300
  const q = questions[current]
  const opts = q ? (() => { try { return JSON.parse(q.options || '[]') } catch { return [] } })() : []

  if (loading) return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center">
      <div className="text-white text-lg">Loading exam...</div>
    </div>
  )

  if (terminated) return (
    <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center text-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="w-14 h-14 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-rose-600" strokeWidth={2} />
        </div>
        <h2 className="text-2xl font-bold font-display text-slate-900 mb-3">Exam Terminated</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">3 proctoring violations were recorded during this exam. Your teacher has been notified and this attempt has been submitted.</p>
        <button onClick={onClose} className="w-full bg-primary hover:bg-primary-dark text-white font-semibold px-8 py-3 rounded-xl transition text-sm">Return to Dashboard</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div>
          <h1 className="font-bold font-display text-slate-900 text-sm">{exam.title}</h1>
          <p className="text-xs text-slate-400">{exam.subject} · {questions.length} questions · {exam.total_marks} marks</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="text-center hidden sm:block">
            <p className="text-xs text-slate-400">Answered</p>
            <p className="font-bold text-slate-900 text-sm">{answered}/{questions.length}</p>
          </div>
          {/* Timer */}
          <div className={`px-4 py-2 rounded-xl font-mono font-black text-lg ${isLow ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-800'}`}>
            {formatTime(timeLeft)}
          </div>
          <button onClick={() => setShowConfirm(true)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" strokeWidth={2} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question nav sidebar */}
        <div className="hidden md:flex flex-col w-48 bg-white border-r border-slate-200 p-3 gap-1 overflow-y-auto flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">Questions</p>
          {questions.map((qs, i) => {
            const ans = answers[qs.id]
            const done = ans?.answer_text?.trim() || ans?.selected_option
            return (
              <button key={qs.id} onClick={() => setCurrent(i)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition ${
                  i === current ? 'bg-primary text-white font-semibold' :
                  done ? 'bg-emerald-50 text-emerald-700 font-medium' :
                  'text-slate-600 hover:bg-slate-50'
                }`}>
                <span className="font-bold">Q{i + 1}</span>
                <span className="text-xs ml-1 opacity-70">{qs.marks}m</span>
                {done && i !== current && <CheckCircle2 className="w-3 h-3 ml-1 inline" strokeWidth={2} />}
              </button>
            )
          })}
        </div>

        {/* Main question area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            {q && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                {/* Question header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center font-black text-sm">
                      Q{current + 1}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      q.question_type === 'mcq' ? 'bg-sky-100 text-sky-700' :
                      q.question_type === 'short' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-violet-100 text-violet-700'
                    }`}>
                      {q.question_type === 'mcq' ? 'Multiple Choice' :
                       q.question_type === 'short' ? 'Short Answer' : 'Long Answer'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-500">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                </div>

                {/* Question text */}
                <p className="text-slate-900 text-base leading-relaxed font-medium">{q.question_text}</p>

                {/* Answer input */}
                {q.question_type === 'mcq' ? (
                  <MCQQuestion q={q} opts={opts} answer={answers[q.id]}
                    onChange={val => setAnswer(q.id, val)} />
                ) : (
                  <OpenQuestion q={q} answer={answers[q.id]}
                    rows={q.question_type === 'long' ? 8 : 4}
                    onChange={val => setAnswer(q.id, val)} />
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button onClick={() => setCurrent(c => Math.max(0, c - 1))}
                disabled={current === 0}
                className="border border-slate-300 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-slate-50">
                ← Previous
              </button>

              {/* Mobile question dots */}
              <div className="flex gap-1.5 md:hidden">
                {questions.map((qs, i) => {
                  const done = answers[qs.id]?.answer_text?.trim() || answers[qs.id]?.selected_option
                  return (
                    <button key={i} onClick={() => setCurrent(i)}
                      className={`w-2.5 h-2.5 rounded-full transition ${
                        i === current ? 'bg-primary' : done ? 'bg-emerald-400' : 'bg-slate-300'
                      }`} />
                  )
                })}
              </div>

              {current < questions.length - 1 ? (
                <button onClick={() => setCurrent(c => c + 1)}
                  className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium">
                  Next →
                </button>
              ) : (
                <button onClick={() => setShowConfirm(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-1.5">
                  Submit Exam <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Proctoring overlay */}
      {exam.proctoring_enabled && (
        <ProctoringOverlay
          sessionKey={proctoringKey.current}
          examId={exam.id}
          studentId={user?.id}
          onTerminate={() => setTerminated(true)}
        />
      )}

      {/* Submit confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black font-display text-slate-900 text-xl mb-2">Submit Exam?</h3>
            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Answered</span>
                <span className="font-bold text-emerald-600">{answered}/{questions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Unanswered</span>
                <span className={`font-bold ${questions.length - answered > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {questions.length - answered}
                </span>
              </div>
              {questions.length - answered > 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} /> You have unanswered questions.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50">
                Keep Going
              </button>
              <button onClick={() => { setShowConfirm(false); handleSubmit() }} disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">
                {submitting ? 'Submitting...' : 'Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Security Violation Modal */}
      {showSecurityModal && (
        <SecurityViolationModal onClose={() => setShowSecurityModal(false)} />
      )}
    </div>
  )
}
