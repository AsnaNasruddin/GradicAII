import { useEffect, useRef, useState } from 'react'
import { X, Bot, Sparkles, ShieldCheck, RotateCcw, Save, Rocket } from 'lucide-react'
import api from '../api/axios'
import { useNotification } from '../context/NotificationContext'
import { getErrorMessage } from '../utils/getErrorMessage'

const TYPE_LABEL = { mcq: 'MCQ', short: 'Short Answer', long: 'Long Answer' }
const TYPE_COLOR = { mcq: 'bg-sky-100 text-sky-700', short: 'bg-emerald-100 text-emerald-700', long: 'bg-violet-100 text-violet-700' }

function QuestionCard({ q, index, onChange, onDelete }) {
  const opts = (() => { try { return JSON.parse(q.options || '[]') } catch { return [] } })()

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold">
            {index + 1}
          </span>
          <select value={q.question_type} onChange={e => onChange({ ...q, question_type: e.target.value })}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400">
            <option value="mcq">MCQ</option>
            <option value="short">Short</option>
            <option value="long">Long</option>
          </select>
          <span className="text-xs text-slate-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
          <input type="number" min={1} max={20} value={q.marks}
            onChange={e => onChange({ ...q, marks: parseInt(e.target.value) || 1 })}
            className="w-14 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400" />
        </div>
        <button onClick={onDelete} className="text-slate-300 hover:text-rose-500 flex-shrink-0"><X className="w-4 h-4" strokeWidth={2} /></button>
      </div>

      {/* Question text */}
      <textarea value={q.question_text} onChange={e => onChange({ ...q, question_text: e.target.value })}
        rows={2}
        className="mt-3 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
        placeholder="Question text..." />

      {/* MCQ options */}
      {q.question_type === 'mcq' && (
        <div className="mt-3 space-y-2">
          {['A', 'B', 'C', 'D'].map((letter, i) => (
            <div key={letter} className="flex items-center gap-2">
              <button
                onClick={() => onChange({ ...q, correct_option: letter })}
                className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition ${
                  q.correct_option === letter ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-400'
                }`}
                title="Mark as correct"
              >{letter}</button>
              <input
                value={opts[i] || ''}
                onChange={e => {
                  const newOpts = [...(opts.length === 4 ? opts : ['', '', '', ''])]
                  newOpts[i] = e.target.value
                  onChange({ ...q, options: JSON.stringify(newOpts) })
                }}
                placeholder={`Option ${letter}`}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-1">Click the letter circle to mark the correct answer</p>
        </div>
      )}
    </div>
  )
}

export default function ExamBuilder({ exam, onClose, onPublished }) {
  const { showToast } = useNotification()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [extracted, setExtracted] = useState(false)
  const [proctoringEnabled, setProctoringEnabled] = useState(exam.proctoring_enabled || false)

  // A mock/placeholder extraction (no document to read, missing API key, or the
  // AI call failed) is otherwise indistinguishable from a real one in the UI —
  // flag it loudly so a teacher never unknowingly publishes placeholder
  // questions to students, with the actual reason so they know what to do.
  const warnIfMock = (qs) => {
    if (qs.some(q => q.question_text?.includes('add your OPENAI_API_KEY'))) {
      if (!exam.question_paper_url) {
        showToast('These are placeholder questions — this exam has no question paper uploaded, so there was nothing for AI to extract from. Upload a question paper and use the re-extract button, or edit these questions directly to write your own.', 'error', 10000)
      } else {
        showToast('These are placeholder questions, not real AI-extracted ones — check the OPENAI_API_KEY is set, then use the re-extract button to try again.', 'error', 9000)
      }
    }
  }

  const extract = async () => {
    setLoading(true)
    try {
      const res = await api.post(`/exams/${exam.id}/extract-questions`)
      setQuestions(res.data.map(q => ({ ...q, _dirty: false })))
      setExtracted(true)
      warnIfMock(res.data)
    } catch (err) {
      showToast(getErrorMessage(err, 'Extraction failed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadExisting = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/exams/${exam.id}/questions`)
      if (res.data.length > 0) {
        setQuestions(res.data)
        setExtracted(true)
        warnIfMock(res.data)
      } else {
        await extract()
      }
    } catch {
      await extract()
    } finally {
      setLoading(false)
    }
  }

  // "Edit Questions" (exam already published) should open straight into the
  // question list, not the first-time "Extract Questions with AI" splash —
  // that splash stays reserved for "Setup Questions" on a brand-new exam,
  // since that path triggers a real AI extraction call.
  const initialLoadRef = useRef(false)
  useEffect(() => {
    // React.StrictMode double-invokes effects in dev — guard so loadExisting()
    // (and its warnIfMock toast) only actually runs once per mount, not twice.
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    if (exam.is_structured) loadExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateQuestion = (index, updated) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...updated, _dirty: true } : q))
  }

  const deleteQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      id: null,
      exam_id: exam.id,
      question_number: prev.length + 1,
      question_type: 'short',
      question_text: '',
      options: null,
      correct_option: null,
      marks: 1,
      order_index: prev.length,
      _dirty: true,
      _new: true,
    }])
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const payload = {
          question_number: i + 1,
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options ? JSON.parse(q.options) : null,
          correct_option: q.correct_option || null,
          marks: q.marks,
          order_index: i,
        }
        if (q._new || !q.id) {
          const res = await api.post(`/exams/${exam.id}/questions`, payload)
          setQuestions(prev => prev.map((sq, si) => si === i ? { ...res.data, _dirty: false } : sq))
        } else if (q._dirty) {
          await api.put(`/exams/${exam.id}/questions/${q.id}`, payload)
          setQuestions(prev => prev.map((sq, si) => si === i ? { ...sq, _dirty: false, _new: false } : sq))
        }
      }
      showToast('Questions saved!', 'success')
    } catch (err) {
      showToast(getErrorMessage(err, 'Save failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    if (questions.length === 0) { showToast('Add at least one question first', 'error'); return }
    setPublishing(true)
    try {
      await saveAll()
      await api.post(`/exams/${exam.id}/publish-structured`)
      if (proctoringEnabled !== exam.proctoring_enabled) {
        await api.post(`/exams/${exam.id}/toggle-proctoring`)
      }
      onPublished()
      onClose()
    } catch (err) {
      showToast(getErrorMessage(err, 'Publish failed'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-primary text-white px-6 py-4 rounded-t-2xl flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold font-display">Exam Builder</h2>
              <p className="text-violet-200 text-sm mt-0.5">{exam.title} · {exam.subject}</p>
            </div>
            <button onClick={onClose} className="text-violet-200 hover:text-white"><X className="w-5 h-5" strokeWidth={2} /></button>
          </div>
          {questions.length > 0 && (
            <div className="flex gap-6 mt-3 text-sm text-violet-100">
              <span>{questions.length} questions</span>
              <span>{totalMarks} marks total</span>
              <span>{questions.filter(q => q.question_type === 'mcq').length} MCQ · {questions.filter(q => q.question_type !== 'mcq').length} open</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!extracted ? (
            <div className="text-center py-16">
              <Bot className="w-14 h-14 mx-auto mb-4 text-slate-300" strokeWidth={1.5} />
              <h3 className="text-xl font-bold font-display text-slate-900 mb-2">Convert to Structured Exam</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                AI will extract questions from your uploaded question paper. You can review and edit them before publishing.
              </p>
              <button onClick={loadExisting} disabled={loading}
                className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl text-sm">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" strokeWidth={2} /> {loading ? 'Extracting questions...' : 'Extract Questions with AI'}
                </span>
              </button>
              {!exam.question_paper_url && (
                <p className="text-xs text-amber-600 mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 inline-block">
                  No question paper uploaded — will generate placeholder questions
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id || `new-${i}`}
                  q={q}
                  index={i}
                  onChange={(updated) => updateQuestion(i, updated)}
                  onDelete={() => deleteQuestion(i)}
                />
              ))}

              <button onClick={addQuestion}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl py-4 text-slate-400 hover:border-violet-400 hover:text-violet-500 text-sm font-medium transition">
                + Add Question
              </button>

              {/* Proctoring toggle */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" strokeWidth={2} /> AI Proctoring</p>
                  <p className="text-xs text-slate-400 mt-0.5">Enable live camera monitoring for this exam</p>
                </div>
                <button
                  onClick={() => setProctoringEnabled(p => !p)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${proctoringEnabled ? 'bg-primary' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${proctoringEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {extracted && (
          <div className="flex items-center gap-3 px-6 py-4 bg-white border-t border-slate-200 flex-shrink-0">
            <button onClick={extract} disabled={loading}
              className="border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-50 font-medium px-3 py-2 rounded-xl text-sm"
              title="Re-extract questions from PDF using AI">
              {loading ? '...' : <RotateCcw className="w-4 h-4" strokeWidth={2} />}
            </button>
            <button onClick={saveAll} disabled={saving}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 font-medium px-5 py-2 rounded-xl text-sm inline-flex items-center gap-1.5">
              {saving ? 'Saving...' : <><Save className="w-4 h-4" strokeWidth={2} /> Save Draft</>}
            </button>
            <button onClick={publish} disabled={publishing || questions.length === 0}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm inline-flex items-center justify-center gap-1.5">
              {publishing ? 'Publishing...' : <><Rocket className="w-4 h-4" strokeWidth={2} /> Publish Structured Exam</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
